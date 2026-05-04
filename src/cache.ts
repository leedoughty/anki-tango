import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CACHE_DIR = join(homedir(), ".anki-tango");
const CACHE_FILE = join(CACHE_DIR, "cache.json");

const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_TTL_MS = ONE_HOUR_MS;

interface CacheData {
  deckName: string;
  timestamp: number;
  words: string[];
}

export async function getCachedWords(
  deckName: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<Set<string> | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const data: CacheData = JSON.parse(raw);

    if (data.deckName !== deckName) return null;
    if (Date.now() - data.timestamp > ttlMs) return null;

    return new Set(data.words);
  } catch {
    return null;
  }
}

export async function setCachedWords(
  deckName: string,
  words: Set<string>,
): Promise<void> {
  const data: CacheData = {
    deckName,
    timestamp: Date.now(),
    words: [...words],
  };

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
}
