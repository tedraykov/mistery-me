"use client";

import { useState } from "react";
import { MAX_DESCRIPTION, MAX_FILE_BYTES, nameFromFile, readText } from "@/lib/textFile";

const ADDED_IN_THIS_BATCH = "";

/**
 * Bulk upload: one character per .txt file — the file name is the name, the contents the
 * description. A file named like an existing character updates it instead of adding a duplicate.
 */
export function ImportTxt({
  characters,
  busy,
  save,
}: {
  characters: { id: string; name: string }[];
  busy: boolean;
  /** Create (`id` null) or update a character; resolves to whether it was saved. */
  save: (id: string | null, name: string, description: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function importFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ""; // so picking the same files again still fires
    if (files.length === 0) return;
    setNote(null);

    const existing = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c.id]));
    // Numbered file names ("2 Ива.txt", "10 Тео.txt") keep their order; the number is dropped.
    files.sort((a, b) => a.name.localeCompare(b.name, "bg", { numeric: true }));

    let added = 0;
    let updated = 0;
    const problems: string[] = [];
    for (const file of files) {
      const name = nameFromFile(file);
      if (!name || file.size > MAX_FILE_BYTES) {
        problems.push(`„${file.name}“ — твърде голям или без име`);
        continue;
      }
      const text = await readText(file);
      if (!text) {
        problems.push(`„${file.name}“ — празен`);
        continue;
      }
      const id = existing.get(name.toLowerCase());
      if (id === ADDED_IN_THIS_BATCH) {
        problems.push(`„${file.name}“ — още един файл със същото име, пропуснат`);
        continue;
      }
      if (text.length > MAX_DESCRIPTION) {
        problems.push(`„${file.name}“ — отрязан до ${MAX_DESCRIPTION} знака`);
      }
      if (!(await save(id ?? null, name, text.slice(0, MAX_DESCRIPTION)))) {
        problems.push(`„${file.name}“ — не се запази`);
        continue;
      }
      if (id) updated++;
      else {
        added++;
        existing.set(name.toLowerCase(), ADDED_IN_THIS_BATCH);
      }
    }

    const summary = [added && `добавени ${added}`, updated && `обновени ${updated}`]
      .filter(Boolean)
      .join(", ");
    setNote({
      ok: problems.length === 0,
      text: [summary && `✓ Героите са ${summary}.`, ...problems].filter(Boolean).join(" · "),
    });
  }

  return (
    <div className="stack-sm">
      {note && <span className={note.ok ? "hint" : "hint hint-warn"}>{note.text}</span>}
      <label className="btn" aria-disabled={busy}>
        📂 Качи .txt файлове
        <input
          type="file"
          accept=".txt,text/plain"
          multiple
          hidden
          onChange={importFiles}
          disabled={busy}
        />
      </label>
    </div>
  );
}
