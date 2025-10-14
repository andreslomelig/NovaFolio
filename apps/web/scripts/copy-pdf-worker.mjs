// apps/web/scripts/copy-pdf-worker.mjs
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const candidates = [
  "node_modules/pdfjs-dist/build/pdf.worker.min.js",
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js",
  "node_modules/pdfjs-dist/build/pdf.worker.js",
];

const src = candidates
  .map(p => path.resolve(root, p))
  .find(p => fs.existsSync(p));

if (!src) {
  throw new Error("Could not find pdf.worker.*.js in pdfjs-dist. Check installed version.");
}

const destDir = path.resolve(root, "public");
const dest = path.join(destDir, "pdf.worker.min.js");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest}`);
