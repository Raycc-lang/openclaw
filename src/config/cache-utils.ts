import fs from "node:fs";

export function resolveCacheTtlMs(params: {
  envValue: string | undefined;
  defaultTtlMs: number;
}): number {
  const { envValue, defaultTtlMs } = params;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return defaultTtlMs;
}

export function isCacheEnabled(ttlMs: number): boolean {
  return ttlMs > 0;
}

export function getFileMtimeMs(filePath: string): number | undefined {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
}

export type FileStatSnapshot = { mtimeMs: number; size: number };

/** Return mtime + size in a single statSync call for cache-invalidation guards. */
export function getFileStatSnapshot(filePath: string): FileStatSnapshot | undefined {
  try {
    const st = fs.statSync(filePath);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return undefined;
  }
}
