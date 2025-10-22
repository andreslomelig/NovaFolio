// apps/api/src/storage.ts
import path from "node:path";
import fs from "node:fs";

/** Devuelve el directorio absoluto donde se guardan los archivos */
export function resolveStorageDir(): string {
  const configured = process.env.STORAGE_DIR || "data/uploads";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

/** Crea el directorio si no existe y lo devuelve */
export function ensureStorageDir(): string {
  const dir = resolveStorageDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Convierte /files/<basename> a ruta absoluta del disco */
export function pathFromStorageUrl(storageUrl: string): string {
  // Esperamos algo como "/files/<nombre>"
  const base = path.basename(storageUrl);
  return path.join(resolveStorageDir(), base);
}
