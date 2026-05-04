import { describe, it, expect } from "vitest";
import { parseInbox, parseInboxContent } from "../src/inbox.js";
import { join } from "node:path";

const FIXTURE_PATH = join(import.meta.dirname, "fixtures", "sample-inbox.md");

describe("parseInbox", () => {
  it("parses the sample fixture file", async () => {
    const entries = await parseInbox(FIXTURE_PATH);
    expect(entries).toHaveLength(3);
  });

  it("throws on missing file", async () => {
    await expect(parseInbox("/nonexistent/file.md")).rejects.toThrow();
  });
});

describe("parseInboxContent", () => {
  it("extracts sentences separated by ---", () => {
    const content = `---\nfirst sentence\n---\nsecond sentence\n---`;
    const entries = parseInboxContent(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].sentence).toBe("first sentence");
    expect(entries[1].sentence).toBe("second sentence");
  });

  it("extracts marked word from 【】brackets", () => {
    const content = `---\nゴミの【分別】にご協力ください\n---`;
    const entries = parseInboxContent(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].markedWord).toBe("分別");
    expect(entries[0].sentence).toBe("ゴミの分別にご協力ください");
  });

  it("extracts context from blockquotes", () => {
    const content = `---\n傘を持っていったほうがいいよ\n> 天気予報を見て\n---`;
    const entries = parseInboxContent(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].sentence).toBe("傘を持っていったほうがいいよ");
    expect(entries[0].context).toBe("天気予報を見て");
  });

  it("handles multiple blockquote lines", () => {
    const content = `---\nsome sentence\n> context line 1\n> context line 2\n---`;
    const entries = parseInboxContent(content);
    expect(entries[0].context).toBe("context line 1\ncontext line 2");
  });

  it("skips header lines starting with #", () => {
    const content = `# Anki Inbox\n---\nfirst sentence\n---`;
    const entries = parseInboxContent(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].sentence).toBe("first sentence");
  });

  it("skips empty sections", () => {
    const content = `---\n\n---\nactual sentence\n---`;
    const entries = parseInboxContent(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].sentence).toBe("actual sentence");
  });

  it("returns empty array for empty file", () => {
    const entries = parseInboxContent("");
    expect(entries).toHaveLength(0);
  });

  it("returns empty array for file with only headers", () => {
    const entries = parseInboxContent("# Anki Inbox\n---\n---");
    expect(entries).toHaveLength(0);
  });

  it("handles entries without markedWord or context", () => {
    const content = `---\nこの製品は品切れになっております\n---`;
    const entries = parseInboxContent(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].sentence).toBe("この製品は品切れになっております");
    expect(entries[0].markedWord).toBeUndefined();
    expect(entries[0].context).toBeUndefined();
  });

  it("parses the full sample fixture content", () => {
    const content = `# Anki Inbox

---
ゴミの【分別】にご協力ください
---
傘を持っていったほうがいいよ
> 天気予報を見て
---
この製品は品切れになっております
---
`;
    const entries = parseInboxContent(content);
    expect(entries).toHaveLength(3);

    expect(entries[0].sentence).toBe("ゴミの分別にご協力ください");
    expect(entries[0].markedWord).toBe("分別");
    expect(entries[0].context).toBeUndefined();

    expect(entries[1].sentence).toBe("傘を持っていったほうがいいよ");
    expect(entries[1].markedWord).toBeUndefined();
    expect(entries[1].context).toBe("天気予報を見て");

    expect(entries[2].sentence).toBe("この製品は品切れになっております");
    expect(entries[2].markedWord).toBeUndefined();
    expect(entries[2].context).toBeUndefined();
  });
});
