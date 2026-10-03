import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { load } from "cheerio";

const routesDir = new URL("../.evidence/routes/", import.meta.url);
const assetManifestPath = new URL("../.evidence/asset-manifest.json", import.meta.url);
const outputJsonPath = new URL("../.evidence/motion-inventory.json", import.meta.url);
const outputMarkdownPath = new URL("../.evidence/motion-inventory.md", import.meta.url);

const sectionNames = [
  "Hero",
  "Features",
  "Step",
  "Product",
  "Feature Card 04",
  "AI Automation",
  "Stats",
  "Use Case",
  "Pricing",
  "Reviews",
  "FAQs",
  "CTA",
  "Accordion Wrapper",
];

const ignoredFocusProperties = new Set(["outline", "outline-offset"]);

function framerNames(path = "") {
  return [...path.matchAll(/data-framer-name="([^"]+)"/g)].map((match) => match[1]);
}

function sectionFromPath(path = "") {
  const names = framerNames(path);
  const matched = names.find((name) => sectionNames.includes(name));
  if (matched) return matched;
  if (names.includes("Nav")) return "Navigation";
  if (names.some((name) => ["Footer", "Socials", "Email"].includes(name))) return "Footer";
  return "Shared";
}

function summarizeChanges(entries = [], { focus = false } = {}) {
  return entries
    .map((entry) => {
      const changes = Object.entries(entry.changes ?? {})
        .filter(([property]) => !focus || !ignoredFocusProperties.has(property))
        .map(([property, value]) => ({ property, from: value.from, to: value.to }));
      return changes.length ? { target: entry.nodePath ?? ":self", changes } : null;
    })
    .filter(Boolean);
}

function compactFrame(frame) {
  if (!frame || typeof frame !== "object") return {};
  const keep = ["opacity", "transform", "filter", "clipPath", "backgroundColor", "offsetDistance"];
  return Object.fromEntries(keep.filter((property) => frame[property] != null).map((property) => [property, frame[property]]));
}

function summarizeAnimation(animation) {
  const frames = Array.isArray(animation.keyframes) ? animation.keyframes : [];
  return {
    source: animation.source,
    section: sectionFromPath(animation.target),
    target: framerNames(animation.target).slice(-5).join(" > ") || animation.target,
    timing: animation.timing
      ? {
          delay: animation.timing.delay,
          duration: animation.timing.duration,
          easing: animation.timing.easing,
          iterations: animation.timing.iterations,
          fill: animation.timing.fill,
        }
      : null,
    from: compactFrame(frames[0]),
    to: compactFrame(frames[frames.length - 1]),
  };
}

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeDom(cleanDom) {
  const $ = load(cleanDom);
  return $("[data-framer-name]")
    .toArray()
    .map((element) => $(element).attr("data-framer-name"))
    .filter((name, index, names) => name && names.indexOf(name) === index);
}

function sourceModuleFacts(source, file, bytes) {
  const names = [...new Set([...source.matchAll(/displayName=`([^`]+)`/g)].map((match) => match[1]))];
  if (!names.length) return null;
  return {
    file,
    bytes,
    components: names,
    hoverSignals: (source.match(/hover:!0/g) ?? []).length + (source.match(/whileHover/g) ?? []).length,
    focusSignals: (source.match(/whileFocus/g) ?? []).length,
    threeSecondCycles: (source.match(/3e3/g) ?? []).length,
    durations: [...new Set([...source.matchAll(/duration:([0-9.]+)/g)].map((match) => Number(match[1])))],
    delays: [...new Set([...source.matchAll(/delay:([0-9.]+)/g)].map((match) => Number(match[1])))],
    hasAppearEffects: source.includes("data-framer-appear-id"),
  };
}

const routeFiles = (await readdir(routesDir)).filter((file) => file.endsWith(".json")).sort();
const routes = [];

for (const file of routeFiles) {
  const routeEvidence = JSON.parse(await readFile(new URL(file, routesDir), "utf8"));
  const coreCaptures = routeEvidence.captures.filter((capture) => capture.viewport.core);
  const interactions = [];
  const animations = [];

  for (const capture of coreCaptures) {
    for (const interaction of capture.interactions) {
      const hover = summarizeChanges(interaction.hover);
      const focus = summarizeChanges(interaction.focus, { focus: true });
      const activation = interaction.activation?.outcome && interaction.activation.outcome !== "skipped-unsafe"
        ? interaction.activation
        : null;
      if (!hover.length && !focus.length && !activation) continue;
      interactions.push({
        viewport: capture.viewport.name,
        section: sectionFromPath(interaction.path),
        label: interaction.label || interaction.kind,
        kind: interaction.kind,
        href: interaction.href,
        framerPath: framerNames(interaction.path),
        hover,
        focus,
        activation,
      });
    }

    animations.push(...capture.animations.map((animation) => ({ viewport: capture.viewport.name, ...summarizeAnimation(animation) })));
  }

  routes.push({
    route: routeEvidence.route,
    title: routeEvidence.title,
    sourceSections: summarizeDom(routeEvidence.cleanDom),
    captures: coreCaptures.map((capture) => ({
      viewport: capture.viewport.name,
      width: capture.viewport.width,
      height: capture.viewport.height,
      interactions: capture.interactions.length,
      animations: capture.animations.length,
      states: capture.states,
    })),
    interactions: uniqueBy(interactions, (entry) => JSON.stringify({ ...entry, viewport: undefined })),
    animations: uniqueBy(animations, (entry) => JSON.stringify({ ...entry, viewport: undefined })),
  });
}

const assetManifest = JSON.parse(await readFile(assetManifestPath, "utf8"));
const sourceModules = [];
for (const asset of assetManifest) {
  const url = asset.urls?.[0] ?? "";
  if (asset.kind !== "javascript" || !url.includes("/sites/4lxQpqQLbckNeD6tDIVAAB/") || asset.bytes < 8000) continue;
  const sourcePath = new URL(`../.evidence/assets/by-hash/${asset.sha256}.bin`, import.meta.url);
  const source = await readFile(sourcePath, "utf8").catch(() => null);
  if (!source) continue;
  const facts = sourceModuleFacts(source, basename(asset.localPath), asset.bytes);
  if (facts) sourceModules.push(facts);
}

const totals = {
  routes: routes.length,
  coreCaptures: routes.reduce((total, route) => total + route.captures.length, 0),
  sourceInteractions: routes.reduce((total, route) => total + route.interactions.length, 0),
  sourceAnimations: routes.reduce((total, route) => total + route.animations.length, 0),
  sourceModules: sourceModules.length,
  sourceHoverSignals: sourceModules.reduce((total, module) => total + module.hoverSignals, 0),
  sourceThreeSecondCycles: sourceModules.reduce((total, module) => total + module.threeSecondCycles, 0),
};

const inventory = {
  generatedAt: new Date().toISOString(),
  source: "Captured reconstruction evidence and localized Framer module blobs",
  totals,
  sourceModules,
  routes,
};

await writeFile(outputJsonPath, `${JSON.stringify(inventory, null, 2)}\n`);

const lines = [
  "# Captured motion inventory",
  "",
  `Generated from ${totals.routes} routes and ${totals.coreCaptures} core viewport captures.`,
  "",
  `- Distinct captured interactive state records: ${totals.sourceInteractions}`,
  `- Distinct captured animation records: ${totals.sourceAnimations}`,
  `- Localized source modules with named components: ${totals.sourceModules}`,
  `- Source hover signals in named modules: ${totals.sourceHoverSignals}`,
  `- Source three-second variant-cycle transitions: ${totals.sourceThreeSecondCycles}`,
  "",
  "## Routes",
  "",
  "| Route | Core captures | Interactions | Animations |",
  "| --- | ---: | ---: | ---: |",
  ...routes.map((route) => `| ${route.route} | ${route.captures.length} | ${route.interactions.length} | ${route.animations.length} |`),
  "",
  "## Named source modules",
  "",
  "| Module | Components | Hover signals | 3s cycles | Appear effects |",
  "| --- | --- | ---: | ---: | --- |",
  ...sourceModules.map((module) => `| ${module.file} | ${module.components.join(", ")} | ${module.hoverSignals} | ${module.threeSecondCycles} | ${module.hasAppearEffects ? "yes" : "no"} |`),
  "",
];

await writeFile(outputMarkdownPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ output: outputJsonPath.pathname, markdown: outputMarkdownPath.pathname, totals }, null, 2));
