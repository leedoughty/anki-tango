#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { parseInbox } from "./inbox.js";
import { isConnected } from "./anki.js";

const program = new Command();

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
    try {
      const config = await loadConfig(opts.config);
      if (opts.verbose) {
        console.log(
          chalk.gray(
            `Loaded config: deck="${config.deck}", note_type="${config.note_type}"`,
          ),
        );
      }

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
        if (entry.markedWord) {
          console.log(chalk.gray(`   Marked word: ${entry.markedWord}`));
        }
        if (entry.context) {
          console.log(chalk.gray(`   Context: ${entry.context}`));
        }
        console.log();
      }

      console.log(
        chalk.gray("(Full processing will be implemented in Phase 2)"),
      );
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
    try {
      const config = await loadConfig(opts.config);
      console.log(chalk.blue(`Sentence: ${sentence}`));
      if (cmdOpts.word) {
        console.log(chalk.gray(`Target word: ${cmdOpts.word}`));
      }
      console.log(
        chalk.gray("(Full processing will be implemented in Phase 2)"),
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
      const connected = await isConnected();
      if (!connected) {
        console.error(
          chalk.red(
            "Could not connect to AnkiConnect. Is Anki running with the AnkiConnect add-on installed?",
          ),
        );
        process.exit(1);
      }
      console.log(chalk.gray("(Sync will be implemented in Phase 2)"));
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
