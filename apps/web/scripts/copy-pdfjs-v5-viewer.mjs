import fs from "fs";
import path from "path";

const root = process.cwd();
const nm = path.join(root, "node_modules", "pdfjs-dist");
const webDir = path.join(nm, "web");
const buildDir = path.join(nm, "build");
const dest = path.join(root, "public", "pdfjs-v5");

function x(p){ return fs.existsSync(p); }
function ensure(d){ fs.mkdirSync(d, { recursive: true }); }
function copyDir(src, dst){
  ensure(dst);
  for(const e of fs.readdirSync(src)){
    const s = path.join(src, e), d = path.join(dst, e);
    const st = fs.statSync(s);
    if(st.isDirectory()) copyDir(s, d); else { ensure(path.dirname(d)); fs.copyFileSync(s, d); }
  }
}

if (!x(webDir)) { console.error("pdfjs web/ not found:", webDir); process.exit(1); }
if (!x(buildDir)) { console.error("pdfjs build/ not found:", buildDir); process.exit(1); }

console.log("[pdfjs-v5] Copying viewer →", dest);
copyDir(webDir, dest);

// Asegura que los builds estén junto al visor
for(const f of ["pdf.mjs","pdf.worker.min.mjs","pdf.worker.mjs","pdf.js","pdf.worker.js"]){
  const s = path.join(buildDir, f);
  if(x(s)){ ensure(dest); fs.copyFileSync(s, path.join(dest, f)); }
}
console.log("[pdfjs-v5] Done");
