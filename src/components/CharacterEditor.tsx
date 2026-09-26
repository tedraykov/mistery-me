"use client";

import { useState } from "react";
import { CharacterCard } from "@/components/CharacterCard";
import { roleMarker, victimClues } from "@/lib/format";
import { MAX_DESCRIPTION, MAX_FILE_BYTES, nameFromFile, readText } from "@/lib/textFile";
import type { CharacterRow } from "@/lib/types";

export interface CharacterDraft {
  name: string;
  description: string;
}

export const emptyDraft = (): CharacterDraft => ({
  name: "",
  description: "",
});

export const draftFrom = (c: CharacterRow): CharacterDraft => ({
  name: c.name,
  description: c.description,
});

export function CharacterEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  onDelete,
  busy,
  saveLabel,
}: {
  draft: CharacterDraft;
  setDraft: (d: CharacterDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  busy: boolean;
  saveLabel: string;
}) {
  const [preview, setPreview] = useState(false);
  const [fileNote, setFileNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) =>
    setDraft({ ...draft, [key]: value });

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileNote({ ok: false, text: "Файлът е твърде голям." });
      return;
    }
    const text = await readText(file);
    if (!text) {
      setFileNote({ ok: false, text: "Файлът е празен." });
      return;
    }
    setDraft({
      ...draft,
      // An empty name is taken from the file name: "Тео.txt" → "Тео".
      name: draft.name.trim() ? draft.name : nameFromFile(file),
      description: text.slice(0, MAX_DESCRIPTION),
    });
    setFileNote(
      text.length > MAX_DESCRIPTION
        ? {
            ok: false,
            text: `„${file.name}“ е зареден, но е по-дълъг от ${MAX_DESCRIPTION} знака — краят е отрязан.`,
          }
        : { ok: true, text: `✓ Заредено от „${file.name}“. Прегледай и запази.` },
    );
  }

  // Killer / victim are read from the description's first word, not chosen separately.
  const marker = roleMarker(draft.description);
  const clueCount = marker === "victim" ? victimClues(draft.description).length : 0;

  if (preview) {
    return (
      <div className="stack">
        <button className="btn btn-sm btn-ghost" onClick={() => setPreview(false)}>
          ← Обратно към редакцията
        </button>
        <CharacterCard
          c={{
            id: "preview",
            claimed: false,
            isVictim: marker === "victim",
            name: draft.name || "БЕЗ ИМЕ",
            description: draft.description,
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <label className="field">
        <span>Име</span>
        <input
          type="text"
          value={draft.name}
          maxLength={80}
          placeholder="Тео"
          onChange={(e) => set("name", e.target.value)}
        />
      </label>

      <label className="field">
        <span>Описание</span>
        <textarea
          value={draft.description}
          maxLength={MAX_DESCRIPTION}
          style={{ minHeight: 260 }}
          placeholder={
            "ИТ консултант, 35 г. Двойка с Ива.\n\nСпокоен, наблюдателен, обичаш да стоиш отстрани и да гледаш хората.\n\nТвоята тайна: преди година зае от Иван 6000 лв. за стартъп, който се провали…"
          }
          onChange={(e) => set("description", e.target.value)}
        />
        <span className="hint">
          Всичко, което играчът трябва да знае — кой е, история, тайна, цел. Празен ред започва нов
          абзац. Започни с „УБИЕЦ“ за убиеца или с „УБИТ“ за убития (него го играеш ти, а уликите
          са абзаците му, започващи с „Улика“).
        </span>
      </label>

      <div className="row row-tight">
        <label className="btn btn-sm">
          📄 Качи от .txt файл
          <input type="file" accept=".txt,text/plain" hidden onChange={upload} disabled={busy} />
        </label>
        {fileNote ? (
          <span className={fileNote.ok ? "hint" : "hint hint-warn"}>{fileNote.text}</span>
        ) : (
          <span className="hint">Заменя текста в описанието.</span>
        )}
      </div>

      {marker === "culprit" && (
        <div className="notice">
          🔪 <b>Убиецът.</b> Разпознат по „УБИЕЦ“ в началото. Вижда се само от теб до разкритието.
        </div>
      )}
      {marker === "victim" && (
        <div className="notice">
          ☠️ <b>Убитият</b> — играеш го ти, никой играч не може да го избере.{" "}
          <span className={clueCount > 0 ? "" : "hint-warn"}>
            Намерени улики: <b>{clueCount}</b>
          </span>
          {clueCount === 0 && " — започни абзаците с уликите с „Улика“."}
        </div>
      )}

      <div className="row">
        <button className="btn btn-primary" onClick={onSave} disabled={busy || !draft.name.trim()}>
          {busy ? "Запазваме…" : saveLabel}
        </button>
        <button className="btn btn-sm" onClick={() => setPreview(true)} disabled={busy}>
          👁️ Преглед
        </button>
        <span className="spacer" />
        {onCancel && (
          <button className="btn btn-sm btn-ghost" onClick={onCancel} disabled={busy}>
            Отказ
          </button>
        )}
        {onDelete && (
          <button className="btn btn-sm btn-danger" onClick={onDelete} disabled={busy}>
            Изтрий
          </button>
        )}
      </div>
    </div>
  );
}
