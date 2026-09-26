"use client";

import { useState } from "react";
import {
  CharacterEditor,
  type CharacterDraft,
  draftFrom,
  emptyDraft,
} from "@/components/CharacterEditor";
import { CharacterCard } from "@/components/CharacterCard";
import { ClueTimerPanel } from "@/components/ClueTimer";
import { JoinLine, PhaseStepper, type Send } from "@/components/GameChrome";
import { ImportTxt } from "@/components/ImportTxt";
import { IntroEditor } from "@/components/IntroEditor";
import { initial, paragraphs } from "@/lib/format";
import { mutate } from "@/lib/useGameState";
import type { GameView, HostView } from "@/lib/types";

type Tab = "victim" | "cast" | "intro" | "solution" | "votes";

/**
 * The player who picked the victim runs the game from here: phases, the clue timer, and every
 * character's full description — nobody else sees those.
 */
export function HostDashboard({
  code,
  view: v,
  apply,
}: {
  code: string;
  view: HostView;
  apply: (view: GameView) => void;
}) {
  const [tab, setTab] = useState<Tab>("victim");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const send: Send = async (path, method, body) => {
    setBusy(true);
    setActionError(null);
    const res = await mutate(path, method, body);
    if (res.ok) apply(res.view);
    else setActionError(res.error);
    setBusy(false);
    return res.ok;
  };

  return (
    <main className="shell shell-wide stack">
      <header className="stack" style={{ marginTop: 8 }}>
        <div className="stack-sm">
          <h1>{v.game.title}</h1>
          <JoinLine code={code} playerCount={v.playerCount} badge="☠️ Водещ" />
        </div>
        <PhaseStepper
          phase={v.game.phase}
          busy={busy}
          onSelect={(phase) => send(`/api/games/${code}`, "PATCH", { phase })}
        />
      </header>

      <div className="tabs" role="tablist">
        {(
          [
            ["victim", "☠️ Моята роля"],
            ["cast", `Герои (${v.characters.length})`],
            ["intro", "Увод"],
            ["solution", "Решение"],
            ["votes", `Гласове (${v.voterCount})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            className="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {actionError && <div className="alert">{actionError}</div>}

      {v.timer && <ClueTimerPanel timer={v.timer} busy={busy} send={send} code={code} />}

      {tab === "victim" && <VictimTab view={v} />}
      {tab === "cast" && <CastTab view={v} busy={busy} send={send} code={code} />}
      {tab === "intro" && (
        <IntroEditor
          intro={v.game.intro}
          introAudio={v.introAudio}
          tts={v.tts}
          busy={busy}
          onSave={(intro) => send(`/api/games/${code}`, "PATCH", { intro })}
        />
      )}
      {tab === "solution" && <SolutionTab view={v} busy={busy} send={send} code={code} />}
      {tab === "votes" && <VotesTab view={v} busy={busy} send={send} code={code} />}
    </main>
  );
}

/* ── Cast ──────────────────────────────────────────────────────── */
function CastTab({
  view,
  busy,
  send,
  code,
}: {
  view: HostView;
  busy: boolean;
  send: Send;
  code: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft());
  const [adding, setAdding] = useState(false);

  function startEdit(id: string) {
    const c = view.characters.find((x) => x.id === id);
    if (!c) return;
    setAdding(false);
    setEditing(id);
    setDraft(draftFrom(c));
  }

  function startAdd() {
    setEditing(null);
    setAdding(true);
    setDraft(emptyDraft());
  }

  async function saveNew() {
    if (await send(`/api/games/${code}/characters`, "POST", draft)) {
      setAdding(false);
      setDraft(emptyDraft());
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (await send(`/api/games/${code}/characters/${editing}`, "PATCH", draft)) setEditing(null);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Да изтрием ли „${name}“? Това не може да се върне.`)) return;
    if (await send(`/api/games/${code}/characters/${id}`, "DELETE")) setEditing(null);
  }

  async function move(index: number, dir: -1 | 1) {
    const list = view.characters;
    const target = list[index + dir];
    const self = list[index];
    if (!target || !self) return;
    await send(`/api/games/${code}/characters/${self.id}`, "PATCH", {
      sortOrder: target.sort_order,
    });
    await send(`/api/games/${code}/characters/${target.id}`, "PATCH", {
      sortOrder: self.sort_order,
    });
  }

  return (
    <div className="stack">
      {view.characters.filter((c) => c.is_victim === 1).length > 1 && (
        <div className="alert">
          Повече от един герой започва с „УБИТ“. Убитият трябва да е само един — остави думата само в
          неговото описание.
        </div>
      )}

      {view.characters.length === 0 && !adding && (
        <div className="notice">
          Още няма герои. Качи ги като .txt файлове — името на файла става име на героя, а текстът
          описание.
        </div>
      )}

      {view.characters.map((c, i) =>
        editing === c.id ? (
          <div key={c.id} className="panel stack">
            <div className="eyebrow">Редакция</div>
            <CharacterEditor
              draft={draft}
              setDraft={setDraft}
              onSave={saveEdit}
              onCancel={() => setEditing(null)}
              onDelete={() => remove(c.id, c.name)}
              busy={busy}
              saveLabel="Запази промените"
            />
          </div>
        ) : (
          <div key={c.id} className="pick-item cast-row" style={{ cursor: "default" }}>
            <span className="em">{initial(c.name)}</span>
            <span className="stack" style={{ gap: 3, flex: "1 1 150px", minWidth: 0 }}>
              <span className="nm">{c.name}</span>
              <span className="row row-tight" style={{ marginTop: 2 }}>
                {c.is_victim === 1 ? (
                  <span className="badge badge-violet">☠️ Убитият — ти</span>
                ) : c.claimed ? (
                  <span className="badge badge-teal">Заета от играч</span>
                ) : (
                  <span className="badge">Свободна</span>
                )}
                {c.is_culprit === 1 && <span className="badge badge-blood">🔪 Виновен</span>}
                {!c.description.trim() && <span className="badge">Без описание</span>}
              </span>
            </span>
            <span className="row row-tight">
              <button
                className="btn btn-sm btn-ghost"
                title="Нагоре"
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                className="btn btn-sm btn-ghost"
                title="Надолу"
                disabled={busy || i === view.characters.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button className="btn btn-sm" onClick={() => startEdit(c.id)} disabled={busy}>
                Редактирай
              </button>
            </span>
          </div>
        ),
      )}

      {adding ? (
        <div className="panel stack">
          <div className="eyebrow">Нов герой</div>
          <CharacterEditor
            draft={draft}
            setDraft={setDraft}
            onSave={saveNew}
            onCancel={() => setAdding(false)}
            busy={busy}
            saveLabel="Добави героя"
          />
        </div>
      ) : (
        <div className="sticky-bar row" style={{ alignItems: "flex-end" }}>
          <button className="btn btn-primary" onClick={startAdd} disabled={busy}>
            + Добави герой
          </button>
          <ImportTxt
            characters={view.characters}
            busy={busy}
            save={(id, name, description) =>
              id
                ? send(`/api/games/${code}/characters/${id}`, "PATCH", { description })
                : send(`/api/games/${code}/characters`, "POST", { name, description })
            }
            saveGame={(field, text) => send(`/api/games/${code}`, "PATCH", { [field]: text })}
          />
        </div>
      )}
    </div>
  );
}

/* ── The victim — the host's own role ──────────────────────────── */
function VictimTab({ view }: { view: HostView }) {
  const victim = view.characters.find((c) => c.is_victim === 1);
  if (!victim) {
    return (
      <div className="notice">
        Никой герой не започва с „УБИТ“. Добави го в началото на описанието на убития в „Герои“ —
        уликите му са абзаците, започващи с „Улика“.
      </div>
    );
  }
  return (
    <CharacterCard
      c={{ ...victim, claimed: false, isVictim: true }}
      cluesRead={view.game.cluesRead}
    />
  );
}

/* ── Solution ──────────────────────────────────────────────────── */
function SolutionTab({
  view,
  busy,
  send,
  code,
}: {
  view: HostView;
  busy: boolean;
  send: Send;
  code: string;
}) {
  const [text, setText] = useState(view.game.solution);
  const [saved, setSaved] = useState(false);
  const culprits = view.characters.filter((c) => c.is_culprit === 1);

  async function save() {
    if (await send(`/api/games/${code}`, "PATCH", { solution: text })) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="eyebrow">Само за теб — до фаза „Разкритие“</div>
        <h2>🕯️ Как е станало наистина</h2>
        {culprits.length > 0 ? (
          <div className="row row-tight">
            {culprits.map((c) => (
              <span key={c.id} className="badge badge-blood">
                🔪 {c.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="notice">
            Няма разпознат убиец. Започни описанието на убиеца в „Герои“ с „УБИЕЦ“.
          </div>
        )}
        <label className="field">
          <span>Разказът на финала</span>
          <textarea
            value={text}
            style={{ minHeight: 220 }}
            placeholder="Вальо слязъл в избата в 22:18…"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Запазваме…" : saved ? "✓ Запазено" : "Запази решението"}
          </button>
          <span className="spacer" />
          {view.game.phase !== "revealed" && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => send(`/api/games/${code}`, "PATCH", { phase: "revealed" })}
            >
              🎭 Разкрий на всички
            </button>
          )}
        </div>
        {view.game.phase === "revealed" && (
          <div className="notice">
            Играта е в „Разкритие“ — всички играчи виждат решението и гласовете.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Votes ─────────────────────────────────────────────────────── */
function VotesTab({
  view,
  busy,
  send,
  code,
}: {
  view: HostView;
  busy: boolean;
  send: Send;
  code: string;
}) {
  const max = Math.max(1, ...view.votes.map((t) => t.votes));

  return (
    <div className="stack">
      {view.game.phase !== "voting" && view.game.phase !== "revealed" && (
        <div className="notice">
          Гласуването е затворено. Превключи на фаза „Гласуване“, за да могат играчите да обвиняват.
        </div>
      )}

      {view.votes.length === 0 ? (
        <div className="notice">Още никой не е гласувал.</div>
      ) : (
        <div className="panel stack">
          <div className="eyebrow">
            {view.voterCount} от {view.playerCount} гласуваха
          </div>
          {view.votes.map((t) => (
            <div key={t.characterId} className="stack-sm">
              <div className="bar-row">
                <span>{t.characterName}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(t.votes / max) * 100}%` }} />
                </span>
                <span className="muted">{t.votes}</span>
              </div>
              {t.reasons.map((r, i) => (
                <p key={i} className="faint" style={{ paddingLeft: 4, fontStyle: "italic" }}>
                  „{r}“
                </p>
              ))}
              <hr className="divider" />
            </div>
          ))}
          <button
            className="btn btn-sm btn-danger"
            disabled={busy}
            onClick={() => {
              if (confirm("Да изчистим ли всички гласове?"))
                send(`/api/games/${code}/vote`, "DELETE");
            }}
          >
            Изчисти гласовете
          </button>
        </div>
      )}
    </div>
  );
}
