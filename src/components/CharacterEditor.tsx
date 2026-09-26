"use client";

import { useState } from "react";
import { CharacterCard } from "@/components/CharacterCard";
import type { CharacterRow } from "@/lib/types";

export interface CharacterDraft {
  emoji: string;
  name: string;
  role: string;
  pair: string;
  about: string;
  secret: string;
  knows: string;
  goal: string;
  important: string;
  isCulprit: boolean;
}

export const emptyDraft = (): CharacterDraft => ({
  emoji: "",
  name: "",
  role: "",
  pair: "",
  about: "",
  secret: "",
  knows: "",
  goal: "",
  important: "",
  isCulprit: false,
});

export const draftFrom = (c: CharacterRow): CharacterDraft => ({
  emoji: c.emoji,
  name: c.name,
  role: c.role,
  pair: c.pair,
  about: c.about,
  secret: c.secret,
  knows: c.knows,
  goal: c.goal,
  important: c.important,
  isCulprit: c.is_culprit === 1,
});

const SECTIONS: {
  key: keyof CharacterDraft;
  icon: string;
  label: string;
  placeholder: string;
  hint?: string;
}[] = [
  {
    key: "about",
    icon: "👤",
    label: "За теб",
    placeholder: "Спокоен, наблюдателен, обичаш да стоиш отстрани и да гледаш хората…",
  },
  {
    key: "secret",
    icon: "🤫",
    label: "Твоята тайна",
    placeholder: "Преди година зае от Иван 6000 лв. за стартъп, който се провали…",
  },
  {
    key: "knows",
    icon: "🧠",
    label: "Какво знаеш",
    placeholder: "Пушеше на входните стъпала 22:10–22:30.\nВ 22:15 мина покрай терасата — беше празна.",
    hint: "Всеки нов ред става отделна точка.",
  },
  {
    key: "goal",
    icon: "🎯",
    label: "Твоята цел",
    placeholder: "Открий кой уби Иван. Дългът ти е мотив — признай го, но обясни…",
  },
  {
    key: "important",
    icon: "⚠️",
    label: "Важно",
    placeholder: "Дългът към Иван те прави заподозрян — но си невинен.",
    hint: "Всеки нов ред става отделна точка.",
  },
];

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
            emoji: draft.emoji,
            name: draft.name || "БЕЗ ИМЕ",
            role: draft.role,
            pair: draft.pair,
            about: draft.about,
            secret: draft.secret,
            knows: draft.knows,
            goal: draft.goal,
            important: draft.important,
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
        <label className="field" style={{ width: 84, flexShrink: 0 }}>
          <span>Емоджи</span>
          <input
            type="text"
            value={draft.emoji}
            maxLength={8}
            placeholder="🚬"
            style={{ textAlign: "center", fontSize: 20 }}
            onChange={(e) => set("emoji", e.target.value)}
          />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span>Име</span>
          <input
            type="text"
            value={draft.name}
            maxLength={80}
            placeholder="ТЕО"
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Роля</span>
          <input
            type="text"
            value={draft.role}
            maxLength={160}
            placeholder="ИТ консултант, 35 г."
            onChange={(e) => set("role", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Двойка с</span>
          <input
            type="text"
            value={draft.pair}
            maxLength={160}
            placeholder="Ива ❤️"
            onChange={(e) => set("pair", e.target.value)}
          />
        </label>
      </div>

      {SECTIONS.map((s) => (
        <label className="field" key={s.key}>
          <span>
            {s.icon} {s.label}
          </span>
          <textarea
            value={draft[s.key] as string}
            placeholder={s.placeholder}
            onChange={(e) => set(s.key, e.target.value as never)}
          />
          {s.hint && <span className="hint">{s.hint}</span>}
        </label>
      ))}

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
