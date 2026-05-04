import { readFile, copyFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse as parseYaml } from "yaml";
import type { Config } from "./types.js";

const DEFAULTS: Config = {
  target_language: "ja",
  native_language: "en",
  level: "JLPT N2",
  deck: "Japanese",
  note_type: "Basic",
  fields: {
    sentence: "Front",
    word: "Word",
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
  if (!config.fields?.word)
    throw new Error("Config missing required field: fields.word");
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

export async function initConfig(targetPath: string): Promise<void> {
  const templatePath = new URL(
    "../../templates/default-config.yml",
    import.meta.url,
  ).pathname;
  await copyFile(templatePath, targetPath);
}
