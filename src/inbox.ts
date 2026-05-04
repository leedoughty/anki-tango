import { readFile, writeFile, appendFile } from "node:fs/promises";
import type { InboxEntry } from "./types.js";

const BRACKET_RE = /【(.+?)】/;

export async function parseInbox(filePath: string): Promise<InboxEntry[]> {
  const content = await readFile(filePath, "utf-8");
  return parseInboxContent(content);
}

export function parseInboxContent(content: string): InboxEntry[] {
  const lines = content.split("\n");
  const entries: InboxEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;

    if (line.startsWith("> ") && entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      const contextLine = line.slice(2);
      lastEntry.context = lastEntry.context
        ? lastEntry.context + "\n" + contextLine
        : contextLine;
      continue;
    }

    const bracketMatch = line.match(BRACKET_RE);

    const entry: InboxEntry = {
      sentence: line.replace(/【(.+?)】/g, "$1"),
    };

    if (bracketMatch) {
      entry.markedWord = bracketMatch[1];
    }

    entries.push(entry);
  }

  return entries;
}

export async function archiveProcessed(
  filePath: string,
  archivePath: string,
  processedEntries: InboxEntry[],
): Promise<void> {
  const processedSentences = new Set(processedEntries.map((e) => e.sentence));

  const allEntries = await parseInbox(filePath);
  const remaining = allEntries.filter(
    (e) => !processedSentences.has(e.sentence),
  );

  const archiveLines = processedEntries.map((e) => e.sentence);
  await appendFile(archivePath, archiveLines.join("\n") + "\n", "utf-8");

  const header = remaining.length === 0 ? "" : remaining.map((e) => e.sentence).join("\n") + "\n";
  await writeFile(filePath, header, "utf-8");
}
