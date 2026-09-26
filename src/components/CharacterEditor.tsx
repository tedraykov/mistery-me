"use client";

import { useState } from "react";
import { CharacterCard } from "@/components/CharacterCard";
import type { CharacterRow } from "@/lib/types";

export interface CharacterDraft {
  name: string;
  description: string;
  isCulprit: boolean;
}

export const emptyDraft = (): CharacterDraft => ({
  name: "",
  description: "",
  isCulprit: false,
});

export const draftFrom = (c: CharacterRow): CharacterDraft => ({
  name: c.name,
  description: c.description,
  isCulprit: c.is_culprit === 1,
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
  const set = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) =>
    setDraft({ ...draft, [key]: value });

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
          maxLength={8000}
          style={{ minHeight: 260 }}
          placeholder={
            "ИТ консултант, 35 г. Двойка с Ива.\n\nСпокоен, наблюдателен, обичаш да стоиш отстрани и да гледаш хората.\n\nТвоята тайна: преди година зае от Иван 6000 лв. за стартъп, който се провали…"
          }
          onChange={(e) => set("description", e.target.value)}
        />
        <span className="hint">
          Всичко, което играчът трябва да знае — кой е, история, тайна, цел. Празен ред започва нов абзац.
        </span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={draft.isCulprit}
          onChange={(e) => set("isCulprit", e.target.checked)}
        />
        🔪 Този герой е виновният (вижда се само от теб, до разкритието)
      </label>

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
