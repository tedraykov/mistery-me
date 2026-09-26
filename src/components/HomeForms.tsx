"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeCodeClient } from "@/lib/codeClient";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Кодът е точно 6 символа");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/games/${code}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Няма игра с този код");
      setBusy(false);
      return;
    }
    router.push(`/game/${code}`);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span>Код на играта</span>
        <input
          type="text"
          className="code-input"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXXXX"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(normalizeCodeClient(e.target.value))}
        />
      </label>
      {error && <div className="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy || code.length !== 6}>
        {busy ? "Влизаме…" : "Влез в играта"}
      </button>
    </form>
  );
}

export function CreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Не успяхме да създадем играта");
      setBusy(false);
      return;
    }
    router.push(`/gm/${data.code}`);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span>Име на мистерията</span>
        <input
          type="text"
          placeholder="Убийство на вилата"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      {error && <div className="alert">{error}</div>}
      <button className="btn" disabled={busy}>
        {busy ? "Създаваме…" : "Създай игра"}
      </button>
      <p className="hint">
        Ти ставаш водещ: пишеш героите, техните тайни и решението. Играчите влизат с 6-символен код.
      </p>
    </form>
  );
}
