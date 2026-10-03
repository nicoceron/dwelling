import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import chain from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";
import { streamObject } from "stream-json/streamers/stream-object.js";

const cliArgs = process.argv.slice(2);
const sourceArgument =
  cliArgs.find((argument) => !argument.startsWith("--")) ??
  process.env.RECONSTRUCTION_SOURCE;
if (!sourceArgument) {
  throw new Error(
    "Pass the exported standalone.html path or set RECONSTRUCTION_SOURCE.",
  );
}
const sourcePath = path.resolve(sourceArgument);
const metadataOnly = cliArgs.includes("--metadata-only");
const projectRoot = path.resolve(import.meta.dirname, "..");
const evidenceRoot = path.join(projectRoot, ".evidence");
const routeRoot = path.join(evidenceRoot, "routes");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const auditAssetRoot = path.join(evidenceRoot, "assets", "by-hash");
const publicRoot = path.join(projectRoot, "public");

const evidenceMarker = Buffer.from('<script id="reconstruction-evidence"');
const scriptClose = Buffer.from("</script>");

function safeRouteName(route) {
  if (route === "/") return "home";
  return route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9._-]+/g, "__");
}

function safeStateName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function* evidenceJsonChunks() {
  const input = fs.createReadStream(sourcePath, { highWaterMark: 1024 * 1024 });
  let started = false;
  let pending = Buffer.alloc(0);

  try {
    for await (const chunk of input) {
      let data = pending.length ? Buffer.concat([pending, chunk]) : chunk;

      if (!started) {
        const markerIndex = data.indexOf(evidenceMarker);
        if (markerIndex === -1) {
          const keep = Math.min(data.length, evidenceMarker.length - 1);
          pending = data.subarray(data.length - keep);
          continue;
        }

        const tagEnd = data.indexOf(0x3e, markerIndex + evidenceMarker.length);
        if (tagEnd === -1) {
          pending = data.subarray(markerIndex);
          continue;
        }

        started = true;
        data = data.subarray(tagEnd + 1);
      }

      const closeIndex = data.indexOf(scriptClose);
      if (closeIndex !== -1) {
        if (closeIndex > 0) yield data.subarray(0, closeIndex);
        return;
      }

      const keep = Math.min(data.length, scriptClose.length - 1);
      const emitLength = data.length - keep;
      if (emitLength > 0) yield data.subarray(0, emitLength);
      pending = data.subarray(emitLength);
    }
  } finally {
    input.destroy();
  }

  throw new Error(`Evidence script closing tag was not found in ${sourcePath}`);
}

function evidenceStream() {
  return Readable.from(evidenceJsonChunks());
}

async function runPipeline(stages, onItem) {
  const pipeline = chain([evidenceStream(), parser(), ...stages]);
  for await (const item of pipeline) await onItem(item);
}

async function writeJson(filePath, value) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decodeDataUrl(dataUrl) {
  const separator = dataUrl.indexOf(",");
  if (separator === -1) throw new Error("Malformed data URL");
  const metadata = dataUrl.slice(5, separator);
  const body = dataUrl.slice(separator + 1);
  return metadata.endsWith(";base64")
    ? Buffer.from(body, "base64")
    : Buffer.from(decodeURIComponent(body), "utf8");
}

function extensionFor(contentType) {
  return (
    {
      "image/avif": ".avif",
      "image/gif": ".gif",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/svg+xml": ".svg",
      "image/webp": ".webp",
      "font/otf": ".otf",
      "font/ttf": ".ttf",
      "font/woff": ".woff",
      "font/woff2": ".woff2",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
    }[contentType] ?? ".bin"
  );
}

function isProductionAsset(asset) {
  return ["image", "font", "video", "audio"].includes(asset.kind) ||
    /^(?:image|font|video|audio)\//.test(asset.contentType);
}

async function extractMetadata() {
  const metadata = {};
  const pipeline = chain([evidenceStream(), parser(), streamObject()]);
  try {
    for await (const { key, value } of pipeline) {
      metadata[key] = value;
      // `routes` follows `designTokens` and contains the giant screenshot payloads.
      // Stopping here preserves streaming memory use while retaining all policy/meta fields.
      if (key === "designTokens") break;
    }
  } finally {
    pipeline.destroy();
  }
  await writeJson(path.join(evidenceRoot, "metadata.json"), metadata);
  return metadata;
}

async function extractAssetManifest() {
  const assets = [];
  await runPipeline(
    [pick({ filter: "assets" }), streamArray()],
    ({ value }) => {
      assets.push(value);
    },
  );
  await writeJson(path.join(evidenceRoot, "asset-manifest.json"), assets);
  return assets;
}

async function extractAssetBodies(assets) {
  const byBlob = new Map();
  for (const asset of assets) {
    const group = byBlob.get(asset.blobIndex) ?? [];
    group.push(asset);
    byBlob.set(asset.blobIndex, group);
  }

  let verified = 0;
  let localized = 0;
  await runPipeline(
    [pick({ filter: "assetBlobs" }), streamArray()],
    async ({ key, value }) => {
      const body = decodeDataUrl(value.dataUrl);
      const sha256 = crypto.createHash("sha256").update(body).digest("hex");
      if (sha256 !== value.sha256 || body.length !== value.bytes) {
        throw new Error(
          `Asset blob ${key} failed verification: expected ${value.sha256}/${value.bytes}, received ${sha256}/${body.length}`,
        );
      }

      const auditPath = path.join(
        auditAssetRoot,
        `${value.sha256}${extensionFor(value.contentType)}`,
      );
      await fsPromises.mkdir(path.dirname(auditPath), { recursive: true });
      await fsPromises.writeFile(auditPath, body);
      verified += 1;

      for (const asset of byBlob.get(key) ?? []) {
        if (!isProductionAsset(asset)) continue;
        const relativePath = asset.localPath.replace(/^\/+/, "");
        if (relativePath.includes("..")) throw new Error(`Unsafe asset path: ${asset.localPath}`);
        const destination = path.join(publicRoot, relativePath);
        await fsPromises.mkdir(path.dirname(destination), { recursive: true });
        await fsPromises.writeFile(destination, body);
        localized += 1;
      }
    },
  );
  return { verified, localized };
}

async function extractRoutes() {
  const summaries = [];
  let screenshotCount = 0;
  await runPipeline(
    [pick({ filter: "routes" }), streamArray()],
    async ({ value: route }) => {
      const routeName = safeRouteName(route.route);
      const captures = [];
      for (const capture of route.captures ?? []) {
        const viewportName = safeStateName(capture.viewport.name);
        const initialPath = path.join(
          screenshotRoot,
          routeName,
          `${viewportName}--initial.png`,
        );
        await fsPromises.mkdir(path.dirname(initialPath), { recursive: true });
        await fsPromises.writeFile(initialPath, decodeDataUrl(capture.fullPageScreenshot));
        screenshotCount += 1;

        const states = [];
        for (let index = 0; index < (capture.states ?? []).length; index += 1) {
          const state = capture.states[index];
          const statePath = path.join(
            screenshotRoot,
            routeName,
            `${viewportName}--${String(index + 1).padStart(2, "0")}--${safeStateName(state.label)}.png`,
          );
          await fsPromises.writeFile(statePath, decodeDataUrl(state.screenshot));
          screenshotCount += 1;
          states.push({ ...state, screenshot: path.relative(evidenceRoot, statePath) });
        }

        captures.push({
          ...capture,
          fullPageScreenshot: path.relative(evidenceRoot, initialPath),
          states,
        });
      }

      const portableRoute = { ...route, captures };
      await writeJson(path.join(routeRoot, `${routeName}.json`), portableRoute);
      summaries.push({
        route: route.route,
        url: route.url,
        title: route.title,
        description: route.description,
        captures: captures.map((capture) => ({
          viewport: capture.viewport,
          documentSize: capture.documentSize,
          screenshot: capture.fullPageScreenshot,
          states: capture.states.map((state) => ({
            label: state.label,
            kind: state.kind,
            scrollY: state.scrollY,
            target: state.target,
            screenshot: state.screenshot,
          })),
          nodes: capture.nodes.length,
          interactions: capture.interactions.length,
          animations: capture.animations.length,
          diagnostics: capture.diagnostics.length,
        })),
      });
    },
  );
  await writeJson(path.join(evidenceRoot, "route-manifest.json"), summaries);
  return { routes: summaries.length, screenshots: screenshotCount };
}

await fsPromises.mkdir(evidenceRoot, { recursive: true });
await fsPromises.mkdir(publicRoot, { recursive: true });

console.log(`Reading reconstruction evidence from ${sourcePath}`);
const metadata = await extractMetadata();
console.log(`Captured ${metadata.coverage?.capturedRoutes?.length ?? 0} route metadata records`);
if (!metadataOnly) {
  const assets = await extractAssetManifest();
  console.log(`Indexed ${assets.length} asset aliases`);
  const assetResult = await extractAssetBodies(assets);
  console.log(`Verified ${assetResult.verified} deduplicated blobs and localized ${assetResult.localized} production asset aliases`);
  const routeResult = await extractRoutes();
  console.log(`Extracted ${routeResult.routes} routes and ${routeResult.screenshots} screenshots`);
}
