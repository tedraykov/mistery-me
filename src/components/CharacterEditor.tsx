"use client";

import { useState } from "react";
import { CharacterCard } from "@/components/CharacterCard";
import { victimClues } from "@/lib/format";
import type { CharacterRow } from "@/lib/types";

export interface CharacterDraft {
  name: string;
  description: string;
  isCulprit: boolean;
  isVictim: boolean;
}

export const emptyDraft = (): CharacterDraft => ({
  name: "",
  description: "",
  isCulprit: false,
  isVictim: false,
});

export const draftFrom = (c: CharacterRow): CharacterDraft => ({
  name: c.name,
  description: c.description,
  isCulprit: c.is_culprit === 1,
  isVictim: c.is_victim === 1,
});

const MAX_DESCRIPTION = 8000;

/**
 * Read a .txt as text. Files saved on Bulgarian Windows (Notepad, Word "Plain text") are often
 * UTF-16 or Windows-1251 rather than UTF-8, so detect those instead of showing mojibake.
 */
async function readText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder("utf-16le").decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder("utf-16be").decode(bytes);
  else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1251").decode(bytes);
    }
  }
  return text.replace(/\r\n?/g, "\n").trim();
}

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
    if (file.size > 1_000_000) {
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
      name: draft.name.trim() ? draft.name : file.name.replace(/\.[^.]+$/, "").slice(0, 80),
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

  const clueCount = draft.isVictim ? victimClues(draft.description).length : 0;

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
            isVictim: draft.isVictim,
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
            draft.isVictim
              ? "Иван, 40 г., домакинът на вечерта.\n\nТвоята история…\n\nУлика 1: Под саксията на терасата има ключ за избата.\n\nУлика 2: …"
              : "ИТ консултант, 35 г. Двойка с Ива.\n\nСпокоен, наблюдателен, обичаш да стоиш отстрани и да гледаш хората.\n\nТвоята тайна: преди година зае от Иван 6000 лв. за стартъп, който се провали…"
          }
          onChange={(e) => set("description", e.target.value)}
        />
        {draft.isVictim ? (
          <span className={clueCount > 0 ? "hint" : "hint hint-warn"}>
            Всеки абзац, който започва с „Улика“, е улика — таймерът ти ги подава една по една.{" "}
            <b>Намерени улики: {clueCount}</b>
          </span>
        ) : (
          <span className="hint">
            Всичко, което играчът трябва да знае — кой е, история, тайна, цел. Празен ред започва нов
            абзац.
          </span>
        )}
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

      <div className="stack-sm">
        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.isVictim}
            onChange={(e) =>
              setDraft({
                ...draft,
                isVictim: e.target.checked,
                isCulprit: e.target.checked ? false : draft.isCulprit,
              })
            }
          />
          ☠️ Това е убитият — играе го водещият, в описанието му са уликите
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.isCulprit}
            onChange={(e) =>
              setDraft({
                ...draft,
                isCulprit: e.target.checked,
                isVictim: e.target.checked ? false : draft.isVictim,
              })
            }
          />
          🔪 Този герой е виновният (вижда се само от теб, до разкритието)
        </label>
      </div>

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
