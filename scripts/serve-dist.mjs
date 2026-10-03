import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = join(projectRoot, "dist");
const port = Number(process.argv[2] ?? 4326);
const host = "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

function resolveRequest(pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.(\/|\\|$))+/, "");
  const relativePath = safePath.replace(/^\/+/, "");
  const direct = join(distRoot, relativePath);
  const candidates = pathname === "/"
    ? [join(distRoot, "index.html")]
    : [direct, `${direct}.html`, join(direct, "index.html")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
  let filePath = resolveRequest(requestUrl.pathname);
  let status = requestUrl.pathname === "/404" || requestUrl.pathname === "/404/" ? 404 : 200;
  if (!filePath) {
    filePath = join(distRoot, "404.html");
    status = 404;
  }
  response.writeHead(status, {
    "content-type": contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  process.stdout.write(`Serving dist at http://${host}:${port}\n`);
});
