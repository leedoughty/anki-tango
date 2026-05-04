import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCachedWords, setCachedWords } from "../src/cache.js";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CACHE_DIR = join(homedir(), ".anki-tango");
const CACHE_FILE = join(CACHE_DIR, "cache.json");

vi.mock("node:fs/promises");

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);

beforeEach(() => {
  vi.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
});

describe("getCachedWords", () => {
  it("returns cached words when cache is fresh", async () => {
    const cacheData = {
      deckName: "Japanese",
      timestamp: Date.now() - 1000,
      words: ["分別", "提示"],
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(cacheData));

    const result = await getCachedWords("Japanese");
    expect(result).toEqual(new Set(["分別", "提示"]));
  });

  it("returns null when cache is stale", async () => {
    const cacheData = {
      deckName: "Japanese",
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      words: ["分別"],
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(cacheData));

    const result = await getCachedWords("Japanese");
    expect(result).toBeNull();
  });

  it("returns null when deck name does not match", async () => {
    const cacheData = {
      deckName: "Chinese",
      timestamp: Date.now() - 1000,
      words: ["分別"],
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(cacheData));

    const result = await getCachedWords("Japanese");
    expect(result).toBeNull();
  });

  it("returns null when cache file does not exist", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await getCachedWords("Japanese");
    expect(result).toBeNull();
  });

  it("respects custom TTL", async () => {
    const cacheData = {
      deckName: "Japanese",
      timestamp: Date.now() - 10_000,
      words: ["分別"],
    };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(cacheData));

    const result = await getCachedWords("Japanese", 5000);
    expect(result).toBeNull();
  });
});

describe("setCachedWords", () => {
  it("writes cache file with correct structure", async () => {
    const words = new Set(["分別", "提示"]);
    await setCachedWords("Japanese", words);

    expect(mockMkdir).toHaveBeenCalledWith(CACHE_DIR, { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledOnce();

    const writtenData = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(writtenData.deckName).toBe("Japanese");
    expect(writtenData.timestamp).toBeTypeOf("number");
    expect(writtenData.words).toEqual(expect.arrayContaining(["分別", "提示"]));
  });
});
