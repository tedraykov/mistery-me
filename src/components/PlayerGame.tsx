"use client";

import Link from "next/link";
import { useState } from "react";
import { CharacterCard } from "@/components/CharacterCard";
import { ReadAloud } from "@/components/ReadAloud";
import { PHASE_LABEL, initial, paragraphs } from "@/lib/format";
import { mutate, useGameState } from "@/lib/useGameState";
import type { PlayerView } from "@/lib/types";

type Tab = "story" | "role" | "cast";

export function PlayerGame({ code }: { code: string }) {
  const { state, error, loading, apply } = useGameState(code);
  const [tabChoice, setTab] = useState<Tab>("role");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <main className="shell center" style={{ paddingTop: 80 }}>
        <p className="muted">Отваряме досието…</p>
      </main>
    );
  }

  if (error || !state || state.view !== "player") {
    return (
      <main className="shell stack center" style={{ paddingTop: 70 }}>
        <h1>🚪</h1>
        <p className="alert">{error ?? "Тази игра не е достъпна от тук."}</p>
        <Link href="/" className="btn">
          Към началото
        </Link>
      </main>
    );
  }

  const v: PlayerView = state;
  // The victim is the game master's role: listed in the cast, but nobody can pick or accuse them.
  const pickable = v.cast.filter((c) => !c.isVictim);

  async function claim(characterId: string) {
    setBusy(characterId);
    setActionError(null);
    const res = await mutate(`/api/games/${code}/claim`, "POST", { characterId });
    if (res.ok) apply(res.view);
    else setActionError(res.error);
    setBusy(null);
  }

  async function release() {
    setBusy("release");
    const res = await mutate(`/api/games/${code}/claim`, "POST", { characterId: "" });
    if (res.ok) apply(res.view);
    else setActionError(res.error);
    setBusy(null);
  }

  /* ── Waiting for the game master ─────────────────────────────── */
  if (v.game.phase === "setup") {
    return (
      <main className="shell stack center" style={{ paddingTop: 60 }}>
        <div className="eyebrow">{v.game.code}</div>
        <h1>{v.game.title}</h1>
        <p className="muted">🕯️ Водещият още подготвя случая. Остани на тази страница.</p>
        <p className="faint">Страницата се обновява сама.</p>
      </main>
    );
  }

  /* ── Role picking ────────────────────────────────────────────── */
  if (!v.me) {
    return (
      <main className="shell stack">
        <GameHeader view={v} />
        <IntroPanel view={v} />
        <div className="panel stack">
          <div className="eyebrow">Стъпка 1</div>
          <h2>Кой си ти?</h2>
          <p className="muted">
            Избери своя герой. Само ти ще виждаш неговата история, тайна и цел.
          </p>
          {actionError && <div className="alert">{actionError}</div>}
          {pickable.length === 0 ? (
            <div className="notice">Водещият още не е добавил герои.</div>
          ) : (
            <div className="pick">
              {pickable.map((c) => (
                <button
                  key={c.id}
                  className="pick-item"
                  disabled={c.claimed || busy !== null}
                  onClick={() => claim(c.id)}
                >
                  <span className="em">{initial(c.name)}</span>
                  <span className="nm" style={{ flex: 1 }}>
                    {c.name}
                  </span>
                  {c.claimed ? (
                    <span className="badge">Заето</span>
                  ) : (
                    <span className="badge badge-amber">Това съм аз</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  /* ── In game ─────────────────────────────────────────────────── */
  const me = v.me;
  // The story tab only exists while there is an intro.
  const tab = tabChoice === "story" && !v.intro.trim() ? "role" : tabChoice;
  return (
    <main className="shell stack">
      <GameHeader view={v} />

      <div className="tabs" role="tablist">
        {v.intro.trim() && (
          <button role="tab" aria-selected={tab === "story"} className="tab" onClick={() => setTab("story")}>
            Историята
          </button>
        )}
        <button role="tab" aria-selected={tab === "role"} className="tab" onClick={() => setTab("role")}>
          Моята роля
        </button>
        <button role="tab" aria-selected={tab === "cast"} className="tab" onClick={() => setTab("cast")}>
          Кой кой е
        </button>
      </div>

      {actionError && <div className="alert">{actionError}</div>}

      {tab === "story" && <IntroPanel view={v} />}

      {tab === "role" && (
        <>
          <CharacterCard c={me} />
          <button className="btn btn-ghost btn-sm" onClick={release} disabled={busy !== null}>
            Това не е моята роля — освободи я
          </button>
        </>
      )}

      {tab === "cast" && (
        <div className="pick">
          {v.cast.map((c) => (
            <div key={c.id} className="pick-item" style={{ cursor: "default" }}>
              <span className="em">{initial(c.name)}</span>
              <span className="nm" style={{ flex: 1 }}>
                {c.name}
              </span>
              {c.id === me.id && <span className="badge badge-amber">Ти</span>}
              {c.isVictim && <span className="badge badge-violet">☠️ Убитият</span>}
            </div>
          ))}
        </div>
      )}

      {v.game.phase === "voting" && <VotePanel view={v} code={code} apply={apply} />}
      {v.game.phase === "revealed" && <RevealPanel view={v} />}
    </main>
  );
}

function GameHeader({ view }: { view: PlayerView }) {
  return (
    <header className="stack-sm" style={{ marginTop: 8 }}>
      <div className="row row-tight">
        <span className="badge">{view.game.code}</span>
        <span className="badge badge-amber">{PHASE_LABEL[view.game.phase]}</span>
      </div>
      <h1>{view.game.title}</h1>
    </header>
  );
}

function IntroPanel({ view }: { view: PlayerView }) {
  if (!view.intro.trim()) return null;
  return (
    <div className="panel stack-sm">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="eyebrow">📜 Историята</div>
        <ReadAloud src={view.introAudio} />
      </div>
      <div className="section-body">
        {paragraphs(view.intro).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

function VotePanel({
  view,
  code,
  apply,
}: {
  view: PlayerView;
  code: string;
  apply: (v: PlayerView) => void;
}) {
  const [choice, setChoice] = useState(view.myVote?.characterId ?? "");
  const [reason, setReason] = useState(view.myVote?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await mutate(`/api/games/${code}/vote`, "POST", {
      characterId: choice,
      reason,
    });
    if (res.ok && res.view.view === "player") {
      apply(res.view);
      setSaved(true);
    } else if (!res.ok) setError(res.error);
    setBusy(false);
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <div className="eyebrow">Финал</div>
      <h2>⚖️ Кой го е направил?</h2>
      {view.myVote && !saved && (
        <div className="notice">Гласувал си за {nameOf(view, view.myVote.characterId)}. Можеш да смениш избора си.</div>
      )}
      {saved && <div className="notice">✓ Гласът ти е записан.</div>}
      <label className="field">
        <span>Твоето обвинение</span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">— избери —</option>
          {view.cast
            .filter((c) => c.id !== view.me?.id && !c.isVictim)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span>Защо? (по желание)</span>
        <textarea
          value={reason}
          maxLength={2000}
          placeholder="Терасата беше празна в 22:15…"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && <div className="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy || !choice}>
        {busy ? "Записваме…" : view.myVote ? "Смени гласа" : "Обвини"}
      </button>
    </form>
  );
}

function RevealPanel({ view }: { view: PlayerView }) {
  const max = Math.max(1, ...(view.tally ?? []).map((t) => t.votes));
  const culprits = view.cast.filter((c) => view.culpritIds?.includes(c.id));

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="eyebrow">Разкритие</div>
        <h2>🕯️ Какво се случи наистина</h2>
        {culprits.length > 0 && (
          <div className="row row-tight">
            {culprits.map((c) => (
              <span key={c.id} className="badge badge-blood">
                {c.name} — виновен
              </span>
            ))}
          </div>
        )}
        <div className="section-body">
          {paragraphs(view.solution ?? "").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {!view.solution?.trim() && <p className="muted">Водещият не е записал решение.</p>}
        </div>
      </div>

      {view.tally && view.tally.length > 0 && (
        <div className="panel stack-sm">
          <div className="eyebrow">Гласовете</div>
          {view.tally.map((t) => (
            <div key={t.characterId} className="bar-row">
              <span>{nameOf(view, t.characterId)}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(t.votes / max) * 100}%` }} />
              </span>
              <span className="muted">{t.votes}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function nameOf(view: PlayerView, characterId: string): string {
  const c = view.cast.find((x) => x.id === characterId);
  return c?.name ?? "—";
}
