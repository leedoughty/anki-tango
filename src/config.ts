import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Config, StyleExample } from "./types.js";

const DEFAULTS: Config = {
  target_language: "ja",
  native_language: "en",
  level: "JLPT N2",
  deck: "Japanese",
  note_type: "Basic",
  fields: {
    sentence: "Front",
    definition: "Back",
  },
  examples: [],
};

const CONFIG_FILENAME = ".ankitango.yml";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveConfigPath(
  explicitPath?: string,
): Promise<string | null> {
  if (explicitPath) {
    if (await fileExists(explicitPath)) return explicitPath;
    throw new Error(`Config file not found: ${explicitPath}`);
  }

  const cwdPath = join(process.cwd(), CONFIG_FILENAME);
  if (await fileExists(cwdPath)) return cwdPath;

  const homePath = join(homedir(), CONFIG_FILENAME);
  if (await fileExists(homePath)) return homePath;

  return null;
}

function validateConfig(config: Config): void {
  if (!config.deck) throw new Error("Config missing required field: deck");
  if (!config.note_type)
    throw new Error("Config missing required field: note_type");
  if (!config.fields?.sentence)
    throw new Error("Config missing required field: fields.sentence");
  if (!config.fields?.definition)
    throw new Error("Config missing required field: fields.definition");
}

export async function loadConfig(configPath?: string): Promise<Config> {
  const resolvedPath = await resolveConfigPath(configPath);

  if (!resolvedPath) {
    return { ...DEFAULTS };
  }

  const raw = await readFile(resolvedPath, "utf-8");
  const parsed = parseYaml(raw) ?? {};

  const config: Config = {
    ...DEFAULTS,
    ...parsed,
    fields: {
      ...DEFAULTS.fields,
      ...parsed.fields,
    },
  };

  validateConfig(config);
  return config;
}

function askQuestion(
  rl: ReturnType<typeof createInterface>,
  question: string,
  fallback: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${question} [${fallback}]: `, (answer) => {
      resolve(answer.trim() || fallback);
    });
  });
}

function askFreeform(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${question}: `, (answer) => {
      resolve(answer.trim());
    });
  });
}

const VALID_STYLES = new Set(["emoji", "ja", "en", "ascii"]);

export async function initConfig(targetPath: string): Promise<void> {
  if (await fileExists(targetPath)) {
    throw new Error(`Config file already exists: ${targetPath}`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("\nLet's set up your anki-tango config.\n");

    const deck = await askQuestion(rl, "Anki deck name", "Japanese");
    const noteType = await askQuestion(rl, "Anki note type", "Basic");
    const sentenceField = await askQuestion(rl, "Sentence field name", "Front");
    const wordField = await askFreeform(
      rl,
      "Word field name (leave empty to combine word into definition)",
    );
    const definitionField = await askQuestion(
      rl,
      "Definition field name",
      "Back",
    );
    const level = await askQuestion(rl, "Your approximate level", "JLPT N2");

    console.log("\nNow add some example cards to teach the AI your style.");
    console.log(
      "Add at least 5 examples. Press Enter with an empty sentence to finish.\n",
    );
    console.log("Styles: emoji, ja (monolingual), en (English), ascii\n");

    const examples: StyleExample[] = [];
    let exampleNum = 1;

    while (true) {
      const sentence = await askFreeform(
        rl,
        `Example ${exampleNum} — sentence (empty to finish)`,
      );
      if (!sentence) break;

      const word = await askFreeform(rl, `  word`);
      if (!word) break;

      const style = await askFreeform(rl, `  style (emoji/ja/en/ascii)`);
      if (!VALID_STYLES.has(style)) {
        console.log(`  Invalid style "${style}", skipping this example.`);
        continue;
      }

      const definition = await askFreeform(rl, `  definition`);
      if (!definition) break;

      examples.push({
        sentence,
        word,
        style: style as StyleExample["style"],
        definition,
      });
      exampleNum++;
      console.log();
    }

    if (examples.length < 5) {
      console.log(
        `\nYou added ${examples.length} example(s). 5+ is recommended for best results.`,
      );
      console.log("You can add more later by editing the config file.\n");
    }

    const fields: Record<string, string> = {
      sentence: sentenceField,
      definition: definitionField,
    };
    if (wordField) {
      fields.word = wordField;
    }

    const config = {
      target_language: "ja",
      native_language: "en",
      level,
      deck,
      note_type: noteType,
      fields,
      examples,
    };

    await writeFile(targetPath, stringifyYaml(config), "utf-8");
    console.log(`Config written to ${targetPath}`);
  } finally {
    rl.close();
  }
}
