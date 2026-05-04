export interface Config {
  target_language: string;
  native_language: string;
  level: string;
  deck: string;
  note_type: string;
  fields: {
    sentence: string;
    word: string;
    definition: string;
  };
  examples: StyleExample[];
  style_hints?: string;
}

export interface StyleExample {
  sentence: string;
  word: string;
  style: "emoji" | "ja" | "en" | "ascii";
  definition: string;
}

export interface InboxEntry {
  sentence: string;
  markedWord?: string;
  context?: string;
}

export interface CardSuggestion {
  word: string;
  reading: string;
  style: "emoji" | "ja" | "en" | "ascii";
  definition: string;
  reasoning: string;
}

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
}
