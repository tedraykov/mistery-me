"use client";

import { useState } from "react";
import { ReadAloud } from "@/components/ReadAloud";

/** The intro story everyone reads (and can hear) once roles open. */
export function IntroEditor({
  intro,
  introAudio,
  tts,
  busy,
  onSave,
}: {
  intro: string;
  introAudio: string | null;
  tts: boolean;
  busy: boolean;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(intro);
  const [saved, setSaved] = useState(false);
  const dirty = text !== intro;

  async function save() {
    if (await onSave(text)) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="panel stack">
      <div className="eyebrow">Играчите го виждат щом се отвори за роли</div>
      <h2>📜 Историята</h2>
      <label className="field">
        <span>Уводът, с който започва вечерта</span>
        <textarea
          value={text}
          maxLength={10000}
          style={{ minHeight: 260 }}
          placeholder="Събота вечер. Иван събира старите приятели във вилата си край Боровец…"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={busy || !dirty}>
          {busy ? "Запазваме…" : saved ? "✓ Запазено" : "Запази увода"}
        </button>
        {!dirty && <ReadAloud src={introAudio} label="Чуй увода" />}
      </div>
      {!tts && (
        <p className="hint">
          Четенето на глас е изключено — задай ELEVENLABS_API_KEY на сървъра, за да го включиш.
        </p>
      )}
    </div>
  );
}
