#!/usr/bin/env node

import { createInterface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { parseInbox } from "./inbox.js";
import { isConnected, getKnownWords, addNote } from "./anki.js";
import { getCachedWords, setCachedWords } from "./cache.js";
import { generateCards, generateDefinition } from "./agent.js";
import type { Config, CardSuggestion } from "./types.js";

const program = new Command();

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function ensureAnkiConnect(): Promise<void> {
  const connected = await isConnected();
  if (!connected) {
    console.error(
      chalk.red(
        "Could not connect to AnkiConnect. Is Anki running with the AnkiConnect add-on installed?",
      ),
    );
    process.exit(1);
  }
}

async function loadKnownWords(
  config: Config,
  verbose: boolean,
): Promise<Set<string>> {
  const cached = await getCachedWords(config.deck);
  if (cached) {
    if (verbose) {
      console.log(chalk.gray(`Using cached word list (${cached.size} words)`));
    }
    return cached;
  }

  if (verbose) {
    console.log(chalk.gray("Fetching known words from AnkiConnect..."));
  }

  const words = await getKnownWords(config.deck, config.fields.word);
  await setCachedWords(config.deck, words);

  if (verbose) {
    console.log(chalk.gray(`Cached ${words.size} known words`));
  }

  return words;
}

function displaySuggestion(suggestion: CardSuggestion): void {
  const styleLabels: Record<string, string> = {
    emoji: "emoji",
    ja: "monolingual",
    en: "English",
    ascii: "ASCII",
  };

  console.log(
    chalk.cyan(`   Found: ${suggestion.word} 「${suggestion.reading}」`),
  );
  console.log(
    chalk.gray(
      `   Style: ${suggestion.style} (${styleLabels[suggestion.style]})`,
    ),
  );
  console.log();
  console.log(chalk.white(`   ${suggestion.definition}`));
  console.log();
}

async function pushToAnki(
  sentence: string,
  suggestion: CardSuggestion,
  config: Config,
): Promise<void> {
  const noteId = await addNote({
    deckName: config.deck,
    modelName: config.note_type,
    fields: {
      [config.fields.sentence]: sentence,
      [config.fields.word]: suggestion.word,
      [config.fields.definition]: suggestion.definition,
    },
  });
  console.log(chalk.green(`   Added to Anki (note ${noteId})`));
}

async function handleSingleSuggestion(
  sentence: string,
  suggestion: CardSuggestion,
  config: Config,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  displaySuggestion(suggestion);

  if (verbose) {
    console.log(chalk.gray(`   Reasoning: ${suggestion.reasoning}`));
    console.log();
  }

  if (dryRun) {
    console.log(chalk.gray("   (dry run — not pushing to Anki)"));
    return;
  }

  const answer = await prompt(chalk.yellow("   [a]ccept  [e]dit  [s]kip  > "));

  switch (answer) {
    case "a": {
      await pushToAnki(sentence, suggestion, config);
      break;
    }
    case "e": {
      const newDef = await prompt(chalk.yellow("   New definition: "));
      if (newDef) {
        await pushToAnki(
          sentence,
          { ...suggestion, definition: newDef },
          config,
        );
      } else {
        console.log(chalk.gray("   Skipped (empty definition)"));
      }
      break;
    }
    case "s":
    default:
      console.log(chalk.gray("   Skipped"));
      break;
  }
}

async function handleMultipleSuggestions(
  sentence: string,
  suggestions: CardSuggestion[],
  config: Config,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  console.log(chalk.cyan(`   Found ${suggestions.length} candidates:`));
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    console.log(chalk.white(`   [${i + 1}] ${s.word} 「${s.reading}」`));
  }
  console.log();

  if (dryRun) {
    for (const s of suggestions) {
      displaySuggestion(s);
      if (verbose) {
        console.log(chalk.gray(`   Reasoning: ${s.reasoning}`));
        console.log();
      }
    }
    console.log(chalk.gray("   (dry run — not pushing to Anki)"));
    return;
  }

  const numberOptions = suggestions.map((_, i) => `[${i + 1}]`).join("  ");
  const answer = await prompt(
    chalk.yellow(`   ${numberOptions}  [a]ll  [s]kip  > `),
  );

  if (answer === "s") {
    console.log(chalk.gray("   Skipped"));
    return;
  }

  const selectedSuggestions =
    answer === "a"
      ? suggestions
      : (() => {
          const idx = parseInt(answer, 10) - 1;
          if (idx >= 0 && idx < suggestions.length) return [suggestions[idx]];
          console.log(chalk.gray("   Invalid choice, skipping"));
          return [];
        })();

  for (const suggestion of selectedSuggestions) {
    console.log();
    await handleSingleSuggestion(sentence, suggestion, config, dryRun, verbose);
  }
}

async function processSentence(
  sentence: string,
  knownWords: Set<string>,
  config: Config,
  opts: { dryRun: boolean; verbose: boolean },
  markedWord?: string,
  context?: string,
): Promise<void> {
  try {
    let result;

    if (markedWord) {
      result = await generateDefinition(sentence, markedWord, config, context);
    } else {
      result = await generateCards(sentence, knownWords, config, context);
    }

    if (opts.verbose) {
      console.log(
        chalk.gray(
          `   Tokens: ${result.inputTokens} in / ${result.outputTokens} out`,
        ),
      );
    }

    if (result.suggestions.length === 0) {
      console.log(chalk.gray("   No new words found for this sentence."));
      return;
    }

    if (result.suggestions.length === 1) {
      await handleSingleSuggestion(
        sentence,
        result.suggestions[0],
        config,
        opts.dryRun,
        opts.verbose,
      );
    } else {
      await handleMultipleSuggestions(
        sentence,
        result.suggestions,
        config,
        opts.dryRun,
        opts.verbose,
      );
    }
  } catch (err) {
    console.error(chalk.red(`   Error: ${(err as Error).message}`));
  }
}

program
  .name("anki-tango")
  .description(
    "AI-powered CLI tool that generates Anki flashcards from sentences",
  )
  .version("0.1.0")
  .option("--dry-run", "show what would be generated without pushing to Anki")
  .option("--verbose", "show LLM reasoning and token counts")
  .option("--config <path>", "path to config file");

program
  .command("process")
  .description("Process an inbox file and generate flashcards")
  .argument("<file>", "path to the Obsidian markdown inbox file")
  .action(async (file: string) => {
    const opts = program.opts();
    const dryRun = Boolean(opts.dryRun);
    const verbose = Boolean(opts.verbose);

    try {
      const config = await loadConfig(opts.config);
      if (verbose) {
        console.log(
          chalk.gray(
            `Loaded config: deck="${config.deck}", note_type="${config.note_type}"`,
          ),
        );
      }

      if (!dryRun) {
        await ensureAnkiConnect();
      }

      const knownWords = dryRun
        ? new Set<string>()
        : await loadKnownWords(config, verbose);

      const entries = await parseInbox(file);
      if (entries.length === 0) {
        console.log(chalk.yellow("No sentences found in inbox."));
        return;
      }

      console.log(
        chalk.blue(`Found ${entries.length} sentence(s) in inbox.\n`),
      );

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        console.log(
          chalk.white(`${i + 1}/${entries.length}  ${entry.sentence}`),
        );
        if (entry.context) {
          console.log(chalk.gray(`   Context: ${entry.context}`));
        }
        console.log();

        await processSentence(
          entry.sentence,
          knownWords,
          config,
          { dryRun, verbose },
          entry.markedWord,
          entry.context,
        );

        console.log();
      }

      console.log(chalk.green("Done."));
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("add")
  .description("Generate a flashcard from a single sentence")
  .argument("<sentence>", "the sentence to create a card from")
  .option(
    "--word <word>",
    "specify the target word (skips word identification)",
  )
  .action(async (sentence: string, cmdOpts: { word?: string }) => {
    const opts = program.opts();
    const dryRun = Boolean(opts.dryRun);
    const verbose = Boolean(opts.verbose);

    try {
      const config = await loadConfig(opts.config);

      if (!dryRun) {
        await ensureAnkiConnect();
      }

      const knownWords = dryRun
        ? new Set<string>()
        : await loadKnownWords(config, verbose);

      console.log(chalk.white(`  ${sentence}\n`));

      await processSentence(
        sentence,
        knownWords,
        config,
        { dryRun, verbose },
        cmdOpts.word,
      );
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("sync")
  .description("Force-refresh the known words cache from AnkiConnect")
  .action(async () => {
    try {
      await ensureAnkiConnect();
      const config = await loadConfig(program.opts().config);
      const words = await getKnownWords(config.deck, config.fields.word);
      await setCachedWords(config.deck, words);
      console.log(
        chalk.green(`Cached ${words.size} words from "${config.deck}"`),
      );
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Create a .ankitango.yml config file in the current directory")
  .action(async () => {
    console.log(
      chalk.gray("(Interactive setup will be implemented in Phase 3)"),
    );
  });

program.parse();
