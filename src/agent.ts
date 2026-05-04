import Anthropic from "@anthropic-ai/sdk";
import type { Config, CardSuggestion } from "./types.js";
import { buildPrompt, buildDefinitionOnlyPrompt } from "./prompts.js";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

interface AgentResult {
  suggestions: CardSuggestion[];
  inputTokens: number;
  outputTokens: number;
}

async function callLLM(
  system: string,
  user: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in LLM response");
  }

  return {
    text: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

function parseSuggestions(text: string): CardSuggestion[] {
  const cleaned = text
    .trim()
    .replace(/^```json?\s*/, "")
    .replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);

  if (Array.isArray(parsed)) return parsed;
  return [parsed];
}

export async function generateCards(
  sentence: string,
  knownWords: Set<string>,
  config: Config,
  context?: string,
): Promise<AgentResult> {
  const { system, user } = buildPrompt(sentence, config, context);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await callLLM(system, user);
      const allSuggestions = parseSuggestions(response.text);
      const suggestions = allSuggestions.filter((s) => !knownWords.has(s.word));

      return {
        suggestions,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      };
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw new Error(
    `Failed to parse LLM response after 2 attempts: ${lastError?.message}`,
  );
}

export async function generateDefinition(
  sentence: string,
  word: string,
  config: Config,
  context?: string,
): Promise<AgentResult> {
  const { system, user } = buildDefinitionOnlyPrompt(
    sentence,
    word,
    config,
    context,
  );

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await callLLM(system, user);
      const suggestions = parseSuggestions(response.text);

      return {
        suggestions,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      };
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw new Error(
    `Failed to parse LLM response after 2 attempts: ${lastError?.message}`,
  );
}
