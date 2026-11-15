import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** JSON files in the data folder. One small helper so every store persists the same way. */

export function dataDir(): string {
  return process.env.HB_DATA_DIR
    ? path.resolve(process.env.HB_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
}

export function dataFilePath(name: string): string {
  return path.join(dataDir(), `${name}.json`);
}

export function writeJsonAtomic(name: string, data: unknown): void {
  try {
    const dir = dataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const target = dataFilePath(name);
    // Unique temp name: two writers in the same process never share a temp file.
    const tmp = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, target);
  } catch (err) {
    // Keep serving from memory, but make the problem visible to the crew.
    console.error(`[holy-basil] Konnte ${name}.json nicht speichern:`, err);
  }
}

export function readJson<T>(name: string, fallback: T): T {
  try {
    const target = dataFilePath(name);
    if (!fs.existsSync(target)) return fallback;
    const raw = fs.readFileSync(target, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[holy-basil] Konnte ${name}.json nicht lesen:`, err);
    return fallback;
  }
}
