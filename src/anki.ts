import type { AnkiNote } from "./types.js";

const ANKI_CONNECT_URL = "http://localhost:8765";
const ANKI_CONNECT_VERSION = 6;

interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

interface AnkiConnectResponse {
  result: unknown;
  error: string | null;
}

async function invoke(
  action: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const body: AnkiConnectRequest = { action, version: ANKI_CONNECT_VERSION };
  if (params) body.params = params;

  let response: Response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Could not connect to AnkiConnect. Is Anki running with the AnkiConnect add-on installed?",
    );
  }

  const data = (await response.json()) as AnkiConnectResponse;
  if (data.error) {
    throw new Error(`AnkiConnect error: ${data.error}`);
  }
  return data.result;
}

export async function isConnected(): Promise<boolean> {
  try {
    await invoke("version");
    return true;
  } catch {
    return false;
  }
}

export async function getKnownWords(
  deckName: string,
  fieldName: string,
): Promise<Set<string>> {
  const noteIds = (await invoke("findNotes", {
    query: `deck:"${deckName}"`,
  })) as number[];

  if (noteIds.length === 0) return new Set();

  const notesInfo = (await invoke("notesInfo", { notes: noteIds })) as Array<{
    fields: Record<string, { value: string }>;
  }>;

  const words = new Set<string>();
  for (const note of notesInfo) {
    const field = note.fields[fieldName];
    if (field?.value) {
      words.add(field.value);
    }
  }
  return words;
}

export async function addNote(note: AnkiNote): Promise<number> {
  const result = await invoke("addNote", {
    note: {
      deckName: note.deckName,
      modelName: note.modelName,
      fields: note.fields,
      options: {
        allowDuplicate: false,
      },
    },
  });
  return result as number;
}
