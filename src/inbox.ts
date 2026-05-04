import { readFile } from "node:fs/promises";
import type { InboxEntry } from "./types.js";

const BRACKET_RE = /【(.+?)】/;

export async function parseInbox(filePath: string): Promise<InboxEntry[]> {
  const content = await readFile(filePath, "utf-8");
  return parseInboxContent(content);
}

export function parseInboxContent(content: string): InboxEntry[] {
  const sections = content.split(/^---$/m);
  const entries: InboxEntry[] = [];

  for (const section of sections) {
    const lines = section
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) continue;

    const contextLines: string[] = [];
    const sentenceLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("#")) continue;
      if (line.startsWith("> ")) {
        contextLines.push(line.slice(2));
      } else {
        sentenceLines.push(line);
      }
    }

    if (sentenceLines.length === 0) continue;

    const rawSentence = sentenceLines.join("\n");
    const bracketMatch = rawSentence.match(BRACKET_RE);

    const entry: InboxEntry = {
      sentence: rawSentence.replace(/【(.+?)】/g, "$1"),
    };

    if (bracketMatch) {
      entry.markedWord = bracketMatch[1];
    }

    if (contextLines.length > 0) {
      entry.context = contextLines.join("\n");
    }

    entries.push(entry);
  }

  return entries;
}

export async function archiveProcessed(
  _filePath: string,
  _archivePath: string,
  _entries: InboxEntry[],
): Promise<void> {}
