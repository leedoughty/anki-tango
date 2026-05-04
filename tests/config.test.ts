import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

const mockReadFile = vi.mocked(fs.readFile);
const mockAccess = vi.mocked(fs.access);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadConfig", () => {
  it("returns defaults when no config file exists", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const config = await loadConfig();
    expect(config.target_language).toBe("ja");
    expect(config.native_language).toBe("en");
    expect(config.level).toBe("JLPT N2");
    expect(config.deck).toBe("Japanese");
    expect(config.note_type).toBe("Basic");
    expect(config.fields.sentence).toBe("Front");
    expect(config.fields.word).toBe("Word");
    expect(config.fields.definition).toBe("Back");
    expect(config.examples).toEqual([]);
  });

  it("merges user config with defaults", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockReadFile.mockResolvedValueOnce(`
deck: "Japanese::Sentences"
note_type: "Sentence"
fields:
  sentence: "Sentence"
  word: "Word"
  definition: "Definition"
`);

    const config = await loadConfig("/path/to/config.yml");
    expect(config.deck).toBe("Japanese::Sentences");
    expect(config.note_type).toBe("Sentence");
    expect(config.target_language).toBe("ja");
    expect(config.fields.sentence).toBe("Sentence");
  });

  it("preserves default fields not overridden by user", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockReadFile.mockResolvedValueOnce(`
deck: "Japanese"
note_type: "Basic"
fields:
  sentence: "MySentence"
`);

    const config = await loadConfig("/path/to/config.yml");
    expect(config.fields.sentence).toBe("MySentence");
    expect(config.fields.word).toBe("Word");
    expect(config.fields.definition).toBe("Back");
  });

  it("throws when explicit config path does not exist", async () => {
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    await expect(loadConfig("/nonexistent/config.yml")).rejects.toThrow(
      "Config file not found",
    );
  });

  it("loads examples from config", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockReadFile.mockResolvedValueOnce(`
deck: "Japanese"
note_type: "Basic"
fields:
  sentence: "Front"
  word: "Word"
  definition: "Back"
examples:
  - sentence: "テスト"
    word: "テスト"
    style: en
    definition: "test"
`);

    const config = await loadConfig("/path/to/config.yml");
    expect(config.examples).toHaveLength(1);
    expect(config.examples[0].word).toBe("テスト");
    expect(config.examples[0].style).toBe("en");
  });

  it("includes style_hints when present", async () => {
    mockAccess.mockResolvedValueOnce(undefined);
    mockReadFile.mockResolvedValueOnce(`
deck: "Japanese"
note_type: "Basic"
fields:
  sentence: "Front"
  word: "Word"
  definition: "Back"
style_hints: "Prefer emoji for concrete nouns"
`);

    const config = await loadConfig("/path/to/config.yml");
    expect(config.style_hints).toBe("Prefer emoji for concrete nouns");
  });
});
