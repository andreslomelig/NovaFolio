import path from "node:path";
import fs from "node:fs";

export function resolveStorageDir(): string {
  // Acepta rutas relativas o absolutas desde .env
  const configured = process.env.STORAGE_DIR || "data/uploads";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

export function ensureStorageDir(): string {
  const dir = resolveStorageDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
