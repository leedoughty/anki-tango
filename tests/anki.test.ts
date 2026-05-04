import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isConnected, getKnownWords, addNote } from "../src/anki.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAnkiResponse(result: unknown, error: string | null = null) {
  mockFetch.mockResolvedValueOnce({
    json: async () => ({ result, error }),
  } as Response);
}

describe("isConnected", () => {
  it("returns true when AnkiConnect responds", async () => {
    mockAnkiResponse(6);
    expect(await isConnected()).toBe(true);
  });

  it("returns false when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await isConnected()).toBe(false);
  });
});

describe("getKnownWords", () => {
  it("returns a set of words from the deck", async () => {
    mockAnkiResponse([1, 2, 3]);
    mockAnkiResponse([
      { fields: { Word: { value: "分別" } } },
      { fields: { Word: { value: "提示" } } },
      { fields: { Word: { value: "品切れ" } } },
    ]);

    const words = await getKnownWords("Japanese", "Word");
    expect(words).toEqual(new Set(["分別", "提示", "品切れ"]));
  });

  it("returns empty set for empty deck", async () => {
    mockAnkiResponse([]);
    const words = await getKnownWords("Japanese", "Word");
    expect(words).toEqual(new Set());
  });

  it("skips notes with missing field", async () => {
    mockAnkiResponse([1, 2]);
    mockAnkiResponse([
      { fields: { Word: { value: "分別" } } },
      { fields: { OtherField: { value: "something" } } },
    ]);

    const words = await getKnownWords("Japanese", "Word");
    expect(words).toEqual(new Set(["分別"]));
  });

  it("throws on connection error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(getKnownWords("Japanese", "Word")).rejects.toThrow(
      "Could not connect to AnkiConnect",
    );
  });

  it("throws on AnkiConnect error response", async () => {
    mockAnkiResponse(null, "deck was not found");
    await expect(getKnownWords("Japanese", "Word")).rejects.toThrow(
      "AnkiConnect error: deck was not found",
    );
  });
});

describe("addNote", () => {
  it("returns the new note ID", async () => {
    mockAnkiResponse(12345);
    const noteId = await addNote({
      deckName: "Japanese",
      modelName: "Basic",
      fields: { Front: "sentence", Back: "definition" },
    });
    expect(noteId).toBe(12345);
  });

  it("sends correct request body", async () => {
    mockAnkiResponse(12345);
    await addNote({
      deckName: "Japanese",
      modelName: "Sentence",
      fields: { Sentence: "test", Word: "word", Definition: "def" },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.action).toBe("addNote");
    expect(body.version).toBe(6);
    expect(body.params.note.deckName).toBe("Japanese");
    expect(body.params.note.modelName).toBe("Sentence");
    expect(body.params.note.fields).toEqual({
      Sentence: "test",
      Word: "word",
      Definition: "def",
    });
  });

  it("throws on duplicate note error", async () => {
    mockAnkiResponse(null, "cannot create note because it is a duplicate");
    await expect(
      addNote({
        deckName: "Japanese",
        modelName: "Basic",
        fields: { Front: "sentence", Back: "definition" },
      }),
    ).rejects.toThrow("AnkiConnect error");
  });
});
