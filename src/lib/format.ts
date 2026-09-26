/** GM textareas are plain text. Split into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/g, "").trim())
    .filter(Boolean);
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
  playing: "Всички четат ролите си и играят. Пускай улики когато решиш.",
  voting: "Играчите посочват кой според тях е убиецът.",
  revealed: "Решението и гласовете са видими за всички.",
};
