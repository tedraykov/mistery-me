/** GM textareas are plain text. Split into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/g, "").trim())
    .filter(Boolean);
}

export type RoleMarker = "culprit" | "victim" | null;

// The first word of a description marks the killer or the victim. The exact words the GM uses
// ("УБИЕЦ", "УБИТ") plus their feminine and definite forms, in any letter case.
const CULPRIT_WORDS = new Set(["УБИЕЦ", "УБИЕЦЪТ", "УБИЙЦА", "УБИЙЦАТА"]);
const VICTIM_WORDS = new Set(["УБИТ", "УБИТИЯТ", "УБИТА", "УБИТАТА"]);

/** "УБИЕЦ …" → culprit, "УБИТ …" → victim, anything else → null. Leading emoji are ignored. */
export function roleMarker(description: string): RoleMarker {
  const word = /^[^\p{L}]*(\p{L}+)/u.exec(description)?.[1].toUpperCase();
  if (!word) return null;
  if (CULPRIT_WORDS.has(word)) return "culprit";
  if (VICTIM_WORDS.has(word)) return "victim";
  return null;
}

/** How often the victim is reminded to read the next clue. */
export const CLUE_INTERVAL_MS = 25 * 60 * 1000;

/**
 * The victim's clues are paragraphs of their description that start with "Улика", e.g.
 * "Улика 1: Под саксията има ключ…". Leading emoji or "#" are allowed.
 */
export function victimClues(description: string): string[] {
  return paragraphs(description).filter((p) => /^[^\p{L}]*улика/iu.test(p));
}

/** First letter of a name, for the round avatar in cast lists. */
export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export const PHASE_LABEL: Record<string, string> = {
  setup: "Подготовка",
  lobby: "Разпределяне на роли",
  playing: "Играта върви",
  voting: "Гласуване",
  revealed: "Разкритие",
};

export const PHASE_HINT: Record<string, string> = {
  setup: "Само ти виждаш играта. Напиши героите, после отвори за играчи.",
  lobby: "Играчите влизат с кода и си избират роля.",
  playing: "Всички четат ролите си и играят. На всеки 25 минути убитият чете нова улика.",
  voting: "Играчите посочват кой според тях е убиецът.",
  revealed: "Решението и гласовете са видими за всички.",
};
