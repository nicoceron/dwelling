import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4322";
const strict = process.argv.includes("--strict");
const routeFilter = process.argv.find((argument) => argument.startsWith("--route="))?.slice("--route=".length);
const viewportFilter = process.argv.find((argument) => argument.startsWith("--viewport="))?.slice("--viewport=".length);
const selectionIsComplete = !routeFilter && !viewportFilter;
const coreViewports = new Set(["desktop", "tablet", "mobile"]);
const evidenceRoot = path.join(projectRoot, ".evidence");
const [manifest, metadata] = await Promise.all([
  fs.readFile(path.join(evidenceRoot, "route-manifest.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(evidenceRoot, "metadata.json"), "utf8").then(JSON.parse),
]);
const targetRatio = metadata.validationPolicy.screenshotPixelDifferenceRatio;
const allCaptures = manifest.flatMap(({ route, captures }) => captures.map((capture) => ({ route, capture })));
const selectedCaptures = allCaptures.filter(({ route, capture }) =>
  (!routeFilter || route === routeFilter) && (!viewportFilter || capture.viewport.name === viewportFilter),
);
if (!selectedCaptures.length) throw new Error("The route and viewport filters matched no source captures.");
const expectedCoreCount = allCaptures.filter(({ capture }) => coreViewports.has(capture.viewport.name)).length;
const expectedStateCount = allCaptures.reduce((sum, { capture }) => sum + capture.states.length, 0);
const actualRoot = path.join(evidenceRoot, "visual-actual");
const diffRoot = path.join(evidenceRoot, "visual-diff");
const stateActualRoot = path.join(evidenceRoot, "visual-state-actual");
const stateDiffRoot = path.join(evidenceRoot, "visual-state-diff");

await Promise.all([actualRoot, diffRoot, stateActualRoot, stateDiffRoot].map((directory) =>
  fs.mkdir(directory, { recursive: true }),
));

function routeName(route) {
  return route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9._-]+/g, "__");
}

function padded(source, width, height) {
  const result = new PNG({ width, height });
  result.data.fill(255);
  PNG.bitblt(source, result, 0, 0, source.width, source.height, 0, 0);
  return result;
}

function relative(filePath) {
  return path.relative(projectRoot, filePath);
}

function unexpectedRuntimeErrors(route, errors) {
  return errors.filter((message) => !(
    route === "/404" &&
    message === "Failed to load resource: the server responded with a status of 404 (Not Found)"
  ));
}

async function compareScreenshots(oraclePath, actualPath, diffPath) {
  const [oracleBuffer, actualBuffer] = await Promise.all([fs.readFile(oraclePath), fs.readFile(actualPath)]);
  const oracle = PNG.sync.read(oracleBuffer);
  const actual = PNG.sync.read(actualBuffer);
  const compareWidth = Math.max(oracle.width, actual.width);
  const compareHeight = Math.max(oracle.height, actual.height);
  const oraclePadded = padded(oracle, compareWidth, compareHeight);
  const actualPadded = padded(actual, compareWidth, compareHeight);
  const diff = new PNG({ width: compareWidth, height: compareHeight });
  const differingPixels = pixelmatch(
    oraclePadded.data,
    actualPadded.data,
    diff.data,
    compareWidth,
    compareHeight,
    { threshold: 0.12, includeAA: false },
  );
  await fs.writeFile(diffPath, PNG.sync.write(diff));
  return {
    ratio: differingPixels / (compareWidth * compareHeight),
    differingPixels,
    oracle: { width: oracle.width, height: oracle.height },
    actual: { width: actual.width, height: actual.height },
    oraclePath: relative(oraclePath),
    actualPath: relative(actualPath),
    diffPath: relative(diffPath),
  };
}

async function openCapture(browser, route, viewport, reducedMotion, runtimeErrors) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion,
    colorScheme: "light",
  });
  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    // Looping source videos can keep range requests active indefinitely.
    // The load event covers the initial document, CSS, and images; fonts are
    // awaited separately below, before any screenshot is taken.
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function fullPageResult(browser, route, capture) {
  const { name } = capture.viewport;
  const runtimeErrors = [];
  const oraclePath = path.join(evidenceRoot, capture.screenshot);
  const actualPath = path.join(actualRoot, `${routeName(route)}--${name}.png`);
  const diffPath = path.join(diffRoot, `${routeName(route)}--${name}.png`);
  let context;
  try {
    const opened = await openCapture(browser, route, capture.viewport, "reduce", runtimeErrors);
    ({ context } = opened);
    const { page } = opened;
    const developmentToolbarPresent = await page.locator("astro-dev-toolbar").count() > 0;
    await page.locator("video").evaluateAll((videos) => {
      videos.forEach((video) => {
        if (!(video instanceof HTMLVideoElement)) return;
        video.pause();
        if (video.readyState >= 1) video.currentTime = 0;
      });
    });
    await page.waitForTimeout(100);
    const headingGeometry = await page.locator("h2").evaluateAll((headings) => headings.map((heading) => ({
      text: heading.textContent?.replace(/\s+/g, " ").trim() ?? "",
      y: Math.round(heading.getBoundingClientRect().top + window.scrollY),
    })));
    const footerGeometry = await page.locator(".site-footer").evaluateAll((footers) => footers.map((footer) => {
      const rect = footer.getBoundingClientRect();
      return { y: Math.round(rect.top + window.scrollY), height: Math.round(rect.height) };
    }));
    await page.screenshot({ path: actualPath, fullPage: true, animations: "disabled" });
    const comparison = await compareScreenshots(oraclePath, actualPath, diffPath);
    return { route, viewport: name, ...comparison, runtimeErrors, headingGeometry, footerGeometry, developmentToolbarPresent };
  } catch (error) {
    return {
      route, viewport: name, ratio: 1, differingPixels: null,
      oraclePath: relative(oraclePath), actualPath: relative(actualPath), diffPath: relative(diffPath),
      runtimeErrors, headingGeometry: [], footerGeometry: [], error: String(error),
    };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function activateCapturedInteraction(page, route, capture, state) {
  // The manifest stores interaction counts; the source route JSON stores the
  // actual control labels and activation outcomes at the captured viewport.
  const sourceRoute = JSON.parse(await fs.readFile(path.join(evidenceRoot, "routes", `${routeName(route)}.json`), "utf8"));
  const sourceCapture = sourceRoute.captures.find((item) => item.viewport.name === capture.viewport.name);
  const interaction = sourceCapture?.interactions?.find((item) => item.path === state.target);
  const label = interaction?.label;
  if (!label || interaction.activation?.outcome !== "changed") {
    return { status: "unreproduced", sourceLabel: label ?? null, reason: "Source activation has no matched changed control." };
  }

  let locator;
  let selectedAttribute;
  if (route === "/" && label === "Follow-ups") {
    locator = page.getByRole("tab", { name: label, exact: true });
    selectedAttribute = "aria-selected";
  } else if (route === "/faqs" && label === "Is Worklane suitable for remote teams?") {
    locator = page.getByRole("button", { name: label, exact: true });
    selectedAttribute = "aria-expanded";
  } else {
    return { status: "unreproduced", sourceLabel: label, reason: "No source-grounded native action is mapped for this control." };
  }

  try {
    if (await locator.count() !== 1) {
      return { status: "unreproduced", sourceLabel: label, reason: "Native control is missing or ambiguous." };
    }
    const before = await locator.getAttribute(selectedAttribute);
    await locator.click();
    const after = await locator.getAttribute(selectedAttribute);
    return {
      status: before !== after && after === "true" ? "reproduced" : "state-mismatch",
      sourceLabel: label,
      nativeControl: selectedAttribute,
      before,
      after,
      reason: before !== after && after === "true" ? null : "Native control did not change to the captured active state.",
      locator,
    };
  } catch (error) {
    return { status: "unreproduced", sourceLabel: label, reason: String(error) };
  }
}

async function scrollToSourcePosition(page, sourceScrollY) {
  await page.evaluate((y) => window.scrollTo({ top: y, left: 0, behavior: "instant" }), sourceScrollY);
  await page.waitForTimeout(700);
  return page.evaluate(() => ({
    scrollY: window.scrollY,
    documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    maxScrollY: Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight),
  }));
}

async function stateResults(browser, route, capture) {
  const results = [];
  const runtimeErrors = [];
  let context;
  try {
    const opened = await openCapture(browser, route, capture.viewport, "no-preference", runtimeErrors);
    ({ context } = opened);
    const { page } = opened;
    const developmentToolbarPresent = await page.locator("astro-dev-toolbar").count() > 0;
    await page.waitForTimeout(100);
    for (const state of capture.states) {
      const fileStem = `${routeName(route)}--${capture.viewport.name}--${state.label}`;
      const oraclePath = path.join(evidenceRoot, state.screenshot);
      const actualPath = path.join(stateActualRoot, `${fileStem}.png`);
      const diffPath = path.join(stateDiffRoot, `${fileStem}.png`);
      let activation = null;
      try {
        if (state.kind === "interaction") activation = await activateCapturedInteraction(page, route, capture, state);
        const actionLocator = activation?.locator;
        if (activation) delete activation.locator;
        const position = await scrollToSourcePosition(page, state.scrollY);
        const scrollDeltaCssPixels = Math.round(position.scrollY - state.scrollY);
        let targetVisibleInCapture = null;
        if (actionLocator) {
          targetVisibleInCapture = await actionLocator.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < window.innerHeight;
          });
        }
        await page.screenshot({ path: actualPath, fullPage: false, animations: "allow" });
        const comparison = await compareScreenshots(oraclePath, actualPath, diffPath);
        const mismatchReasons = [];
        if (Math.abs(scrollDeltaCssPixels) > 2) mismatchReasons.push("source-scroll-position-unreachable");
        if (activation && activation.status !== "reproduced") mismatchReasons.push("interaction-not-reproduced");
        if (comparison.ratio > targetRatio) mismatchReasons.push("pixel-ratio-above-policy");
        if (unexpectedRuntimeErrors(route, runtimeErrors).length) mismatchReasons.push("runtime-errors");
        results.push({
          route, viewport: capture.viewport.name, label: state.label, kind: state.kind,
          ...comparison,
          sourceScrollY: state.scrollY, actualScrollY: position.scrollY, scrollDeltaCssPixels,
          sourceDocumentHeight: capture.documentSize.height, actualDocumentHeight: position.documentHeight,
          documentHeightDeltaCssPixels: position.documentHeight - capture.documentSize.height,
          actualMaxScrollY: position.maxScrollY,
          activation, targetVisibleInCapture, mismatchReasons, runtimeErrors: [...runtimeErrors],
          developmentToolbarPresent,
        });
      } catch (error) {
        results.push({
          route, viewport: capture.viewport.name, label: state.label, kind: state.kind,
          ratio: 1, differingPixels: null,
          oraclePath: relative(oraclePath), actualPath: relative(actualPath), diffPath: relative(diffPath),
          sourceScrollY: state.scrollY, activation, mismatchReasons: ["capture-error"],
          runtimeErrors: [...runtimeErrors], error: String(error),
        });
      }
    }
  } catch (error) {
    for (const state of capture.states) {
      results.push({
        route, viewport: capture.viewport.name, label: state.label, kind: state.kind,
        ratio: 1, differingPixels: null, sourceScrollY: state.scrollY, oraclePath: state.screenshot,
        mismatchReasons: ["capture-error"], runtimeErrors: [...runtimeErrors], error: String(error),
      });
    }
  } finally {
    if (context) await context.close().catch(() => {});
  }
  return results;
}

function summary(results) {
  const compared = results.filter((result) => !result.error);
  return {
    passed: results.filter((result) => !result.error && result.ratio <= targetRatio && !(result.mismatchReasons?.length)).length,
    failed: results.filter((result) => result.error || result.ratio > targetRatio || result.mismatchReasons?.length).length,
    averageRatio: compared.length ? compared.reduce((sum, result) => sum + result.ratio, 0) / compared.length : null,
    worstRatio: compared.length ? Math.max(...compared.map((result) => result.ratio)) : null,
  };
}

let browser = await chromium.launch();
const fullPageResults = [];
const viewportStateResults = [];
try {
  for (const [index, { route, capture }] of selectedCaptures.entries()) {
    if (!browser.isConnected()) browser = await chromium.launch();
    const fullPage = await fullPageResult(browser, route, capture);
    fullPageResults.push(fullPage);
    console.log(`${route} ${capture.viewport.name} full page: ${(fullPage.ratio * 100).toFixed(3)}%${fullPage.error ? ` (${fullPage.error})` : ""}`);
    if (!browser.isConnected()) browser = await chromium.launch();
    const states = await stateResults(browser, route, capture);
    viewportStateResults.push(...states);
    console.log(`${route} ${capture.viewport.name} states: ${states.filter((state) => state.ratio <= targetRatio && !state.mismatchReasons.length).length}/${states.length} at or below ${(targetRatio * 100).toFixed(2)}%`);
    // Fresh browsers bound resource growth while the 72 captured viewport sizes
    // and long full-page PNGs are compared. Each capture uses isolated contexts.
    if ((index + 1) % 8 === 0 && index + 1 < selectedCaptures.length) {
      if (browser.isConnected()) await browser.close();
      browser = await chromium.launch();
    }
  }
} finally {
  if (browser.isConnected()) await browser.close();
}

const coreResults = fullPageResults.filter((result) => coreViewports.has(result.viewport));
const coreSummary = summary(coreResults);
const coreReport = {
  generatedAt: new Date().toISOString(),
  captureMode: "settled-reduced-motion",
  targetRatio,
  ...coreSummary,
  results: coreResults,
};
if (selectionIsComplete && coreResults.length === expectedCoreCount) {
  await fs.writeFile(path.join(evidenceRoot, "visual-report.json"), `${JSON.stringify(coreReport, null, 2)}\n`);
} else {
  await fs.writeFile(path.join(evidenceRoot, "visual-report.partial.json"), `${JSON.stringify(coreReport, null, 2)}\n`);
}

const fullPageSummary = summary(fullPageResults);
const stateSummary = summary(viewportStateResults);
const stateAlignmentIssues = viewportStateResults
  .filter((result) => result.mismatchReasons?.some((reason) => reason !== "pixel-ratio-above-policy" && reason !== "runtime-errors"))
  .map(({ route, viewport, label, kind, sourceScrollY, actualScrollY, activation, mismatchReasons, error }) => ({
    route, viewport, label, kind, sourceScrollY, actualScrollY,
    activation: activation?.status ?? null,
    reasons: mismatchReasons.filter((reason) => reason !== "pixel-ratio-above-policy" && reason !== "runtime-errors"),
    error,
  }));
const runtimeErrorCount = fullPageResults.reduce((sum, result) => sum + unexpectedRuntimeErrors(result.route, result.runtimeErrors).length, 0) +
  viewportStateResults.filter((result) => result.mismatchReasons?.includes("runtime-errors")).length;
const developmentToolbarCaptures = fullPageResults.filter((result) => result.developmentToolbarPresent).length;
const complete = selectionIsComplete &&
  allCaptures.length === metadata.coverage.capturedViewportCount &&
  fullPageResults.length === allCaptures.length &&
  viewportStateResults.length === expectedStateCount &&
  viewportStateResults.filter((result) => result.kind === "interaction").length === metadata.coverage.interactionStatesCaptured;
const stateReport = {
  generatedAt: new Date().toISOString(),
  captureModes: {
    fullPage: "settled-reduced-motion",
    viewportStates: "source-motion-preference-sequential-scroll",
  },
  targetRatio,
  pixelmatch: { threshold: 0.12, includeAA: false, dimensionPadding: "white" },
  sourceStateLimitations: [
    "The source manifest records scroll coordinates and final screenshots, but not exact animation or media frame timing. Viewport states are captured 700 ms after each scroll and with animations allowed; pixel differences remain failures.",
    "The homepage Follow-ups interaction screenshot is scrolled to the FAQ. The tab is activated and its DOM state is checked, but the clicked tab is outside the captured viewport, so its pixels cannot verify the interaction.",
    "Only four source interactions have screenshots. Hover and keyboard behavior needs separate functional verification; this image matrix does not claim it.",
    ...(developmentToolbarCaptures ? ["The target server injected Astro's development toolbar into captured screenshots. Run against a production preview for clean source pixel comparisons; current differences are still reported as failures."] : []),
  ],
  expected: {
    viewportCaptures: metadata.coverage.capturedViewportCount,
    viewportStates: expectedStateCount,
    interactionStates: metadata.coverage.interactionStatesCaptured,
  },
  selected: {
    viewportCaptures: selectedCaptures.length,
    viewportStates: selectedCaptures.reduce((sum, { capture }) => sum + capture.states.length, 0),
    routeFilter: routeFilter ?? null,
    viewportFilter: viewportFilter ?? null,
  },
  complete,
  stateAlignmentIssues,
  runtimeErrorCount,
  developmentToolbarCaptures,
  interactionTargetsOutsideCapturedViewport: viewportStateResults.filter((result) =>
    result.kind === "interaction" && result.targetVisibleInCapture === false,
  ).length,
  fullPage: { ...fullPageSummary, results: fullPageResults },
  viewportStates: { ...stateSummary, results: viewportStateResults },
};
const stateReportName = selectionIsComplete ? "visual-state-report.json" : "visual-state-report.partial.json";
await fs.writeFile(path.join(evidenceRoot, stateReportName), `${JSON.stringify(stateReport, null, 2)}\n`);
console.log(`Full pages ${fullPageSummary.passed}/${fullPageResults.length}; viewport states ${stateSummary.passed}/${viewportStateResults.length}; coverage ${complete ? "complete" : "partial"}; target ${(targetRatio * 100).toFixed(2)}%`);
if (strict && (fullPageSummary.failed > 0 || stateSummary.failed > 0 || runtimeErrorCount > 0 || developmentToolbarCaptures > 0 || (selectionIsComplete && !complete))) {
  process.exitCode = 1;
}
