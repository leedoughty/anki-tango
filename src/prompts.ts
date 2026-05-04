import type { Config } from "./types.js";

const SYSTEM_PROMPT = `You are an Anki card generation assistant for language learners.

Given a sentence, you:
1. Identify which words are worth making flashcards for
2. Generate a definition in the most memorable format

For word identification, consider:
- Is this a useful word the learner will encounter again?
- Is this word used in an interesting or new context?
- Is this a set phrase or compound worth learning as a unit?
- Skip very common grammar/particles

For definition style, choose the most memorable format:
- emoji: concrete/visual meaning captured well by emojis
- ja: Japanese monolingual definition — use when nuance is hard to translate or staying in target language benefits the learner
- en: English (or native language) — when it's the clearest, most efficient option
- ascii: ASCII art or symbols — when visual but emojis don't cover it

Keep definitions concise. One line, two max.

Also provide a "furigana" field with the full sentence annotated in Anki furigana format.
In this format, kanji words are followed by their reading in square brackets, with a space before each annotated word.
Example: " 傘[かさ]を 持[も]っていったほうがいいよ"

Respond in JSON format as an array of CardSuggestion objects:
[{ "word": "...", "reading": "...", "furigana": "...", "style": "...", "definition": "...", "reasoning": "..." }]

Return ONLY valid JSON, no markdown fences, no preamble.`;

const DEFINITION_ONLY_SYSTEM_PROMPT = `You are an Anki card generation assistant for language learners.

Given a sentence and a specific word, generate a definition in the most memorable format.

For definition style, choose the most memorable format:
- emoji: concrete/visual meaning captured well by emojis
- ja: Japanese monolingual definition — use when nuance is hard to translate or staying in target language benefits the learner
- en: English (or native language) — when it's the clearest, most efficient option
- ascii: ASCII art or symbols — when visual but emojis don't cover it

Keep definitions concise. One line, two max.

Also provide a "furigana" field with the full sentence annotated in Anki furigana format.
In this format, kanji words are followed by their reading in square brackets, with a space before each annotated word.
Example: " 傘[かさ]を 持[も]っていったほうがいいよ"

Respond in JSON format as a single CardSuggestion object:
{ "word": "...", "reading": "...", "furigana": "...", "style": "...", "definition": "...", "reasoning": "..." }

Return ONLY valid JSON, no markdown fences, no preamble.`;

function formatExamples(config: Config): string {
  if (config.examples.length === 0) return "";

  const formatted = config.examples
    .map(
      (ex) =>
        `Sentence: ${ex.sentence}\nWord: ${ex.word}\nStyle: ${ex.style}\nDefinition: ${ex.definition}`,
    )
    .join("\n\n");

  return `Here are examples of the user's preferred card style:\n\n${formatted}\n\n`;
}

export function buildPrompt(
  sentence: string,
  config: Config,
  context?: string,
): { system: string; user: string } {
  let user = formatExamples(config);

  if (config.style_hints) {
    user += `Style guidance: ${config.style_hints}\n\n`;
  }

  user += `The user is approximately ${config.level} level. Focus on words that would be new or challenging at this level.\n\n`;
  user += `Sentence: ${sentence}`;

  if (context) {
    user += `\nContext: ${context}`;
  }

  return { system: SYSTEM_PROMPT, user };
}

export function buildDefinitionOnlyPrompt(
  sentence: string,
  word: string,
  config: Config,
  context?: string,
): { system: string; user: string } {
  let user = formatExamples(config);

  if (config.style_hints) {
    user += `Style guidance: ${config.style_hints}\n\n`;
  }

  user += `Generate a definition for the word "${word}" as used in this sentence.\n\n`;
  user += `Sentence: ${sentence}`;

  if (context) {
    user += `\nContext: ${context}`;
  }

  return { system: DEFINITION_ONLY_SYSTEM_PROMPT, user };
}
