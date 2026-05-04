# anki-tango

AI-powered CLI tool that automatically generates Anki flashcards from sentences you encounter in the wild.

Dump sentences into a markdown file, and anki-tango will identify unknown vocabulary, generate definitions in your personal style, and push formatted cards to Anki.

## How it works

1. You collect sentences in an Obsidian markdown file (your "inbox")
2. anki-tango sends each sentence to Claude, which identifies words worth learning
3. It cross-references against your existing Anki deck to skip words you already know
4. For each new word, it generates a definition in the most memorable format
5. You review each card interactively, then it pushes accepted cards to Anki

The definition style is chosen per-word from four options:

| Style   | When                                | Example                             |
| ------- | ----------------------------------- | ----------------------------------- |
| `emoji` | Concrete/visual concepts            | `☂️🌂`                              |
| `ja`    | Nuance best expressed monolingually | `種類ごとに分けること`              |
| `en`    | Clearest as a translation           | `to consider; to examine carefully` |
| `ascii` | Visual but emojis don't cover it    | `→ ← ↑ ↓`                           |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Anki](https://apps.ankiweb.net/) with [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
git clone https://github.com/leedoughty/anki-tango.git
cd anki-tango
npm install
```

Set your API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

## Quick start

### 1. Create a config

```bash
npm run dev -- init
```

This walks you through setting your deck name, note type, field names, and (most importantly) your example cards.

### 2. Create an inbox file

```
ゴミの分別にご協力ください
傘を持っていったほうがいいよ
この製品は品切れになっております
```

One sentence per line. Headers and blank lines are ignored.

Optional features:

- Wrap a word in `【】` to pre-select it (skips word identification): `ゴミの【分別】にご協力ください`
- Add a `> ` line after a sentence as a context hint for the AI: `> 天気予報を見て`

### 3. Process it

```bash
npm run dev -- process inbox.md
```

You'll see an interactive review for each sentence:

```
1/3  ゴミの分別にご協力ください

   Found: 分別 「ぶんべつ」
   Style: ja (monolingual)

   種類ごとに分けること

   [a]ccept  [e]dit  [s]kip  >
```

Accepted cards are pushed to Anki and archived out of your inbox.

## Commands

### `npm run dev -- process <file>`

Process all sentences in an inbox file. Interactive review for each card.

### `npm run dev -- add "<sentence>"`

Quick single-sentence mode.

```bash
npm run dev -- add "傘を持っていったほうがいいよ"
npm run dev -- add "ゴミの分別にご協力ください" --word 分別
```

### `npm run dev -- sync`

Force-refresh the known words cache from AnkiConnect.

### `npm run dev -- init`

Interactive setup to create a `.ankitango.yml` config file.

### Global flags

| Flag              | Description                                  |
| ----------------- | -------------------------------------------- |
| `--dry-run`       | Show generated cards without pushing to Anki |
| `--verbose`       | Show LLM reasoning and token counts          |
| `--config <path>` | Use a specific config file                   |

## Configuration

anki-tango reads from `.ankitango.yml`, searching the current directory first, then your home directory.

```yaml
target_language: ja
native_language: en
level: "JLPT N2"

deck: "Japanese::Sentences"
note_type: "Sentence"

# "word" is optional — omit it to combine the word into the definition field
fields:
  sentence: "Sentence"
  # word: "Word"
  definition: "Definition"

examples:
  - sentence: "ゴミの分別にご協力ください"
    word: "分別"
    style: ja
    definition: "種類ごとに分けること"
  - sentence: "傘を持っていったほうがいいよ"
    word: "傘"
    style: emoji
    definition: "☂️🌂"
  - sentence: "この件について検討させていただきます"
    word: "検討"
    style: en
    definition: "to consider; to examine carefully"
  - sentence: "矢印の方向に進んでください"
    word: "矢印"
    style: ascii
    definition: "→ ← ↑ ↓"
  - sentence: "彼は頑固な性格だ"
    word: "頑固"
    style: ja
    definition: "自分の考えを絶対に変えない様子"

# style_hints: "Prefer emoji for concrete nouns. Use monolingual Japanese for abstract concepts."
```

### The examples are the most important part

The few-shot examples teach the AI your personal definition style. Without them, you'll get generic definitions. With good examples, you'll get cards that feel like you wrote them.

Add at least 5 examples. Include a mix of styles. The AI will learn when to use emoji vs monolingual vs English from your examples.

### Language flexibility

anki-tango isn't hardcoded to Japanese. Change `target_language` and `level` to study any language — the AI handles word identification and definition generation for whatever language you throw at it.

## How the cache works

To avoid querying thousands of notes from AnkiConnect on every run, anki-tango caches your known words list at `~/.anki-tango/cache.json` with a 1-hour TTL. Run `npm run dev -- sync` to force a refresh.

## License

MIT
