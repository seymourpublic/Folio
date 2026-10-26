// Tier B: real Chromium (via Playwright), driving the built package exactly as a browser
// consumer would — proves the DOM/Canvas-dependent half of the engine (pdf.js loading,
// rendering-backed extraction/export, the configureEngine asset-path override) actually works,
// not just that it typechecks. OCR/barcode recognition is intentionally not exercised here (see
// README) — network-dependent asset downloads make it flaky as an automated gate.
import { chromium } from "playwright";
import * as esbuild from "esbuild";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(dir, ".tmp");

async function main() {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(dir, "browser-entry.mjs")],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    outfile: path.join(tmpDir, "bundle.js"),
  });

  const workerSrcPath = path.join(
    path.dirname(fileURLToPath(await import.meta.resolve("pdfjs-dist/package.json"))),
    "build",
    "pdf.worker.min.mjs"
  );
  await fs.copyFile(workerSrcPath, path.join(tmpDir, "pdf.worker.min.mjs"));

  await fs.writeFile(
    path.join(tmpDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/bundle.js"></script></body></html>`
  );

  const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm" };
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const filePath = path.join(tmpDir, urlPath === "/" ? "/index.html" : urlPath);
      const body = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  const port = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });

  console.log("Tier B: browser (Playwright/Chromium) smoke test");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction("window.__SMOKE_DONE__ === true", { timeout: 30_000 });

    const fatal = await page.evaluate("window.__SMOKE_FATAL__ ?? null");
    const results = await page.evaluate("window.__SMOKE_RESULTS__");

    for (const r of results) {
      console.log(`  ${r.ok ? "ok" : "FAIL"} - ${r.name}${r.ok ? "" : `\n    ${r.error}`}`);
    }

    if (fatal) {
      console.error(`Tier B: fatal error during setup: ${fatal}`);
      process.exitCode = 1;
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.error(`Tier B: ${failed.length} of ${results.length} checks failed`);
      process.exitCode = 1;
    } else {
      console.log(`Tier B: ${results.length} checks passed`);
    }
    if (consoleErrors.length > 0) {
      console.log("Tier B: page console errors (informational):");
      for (const e of consoleErrors) console.log(`    ${e}`);
    }
  } finally {
    await browser.close();
    server.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
