"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CharacterEditor,
  type CharacterDraft,
  draftFrom,
  emptyDraft,
} from "@/components/CharacterEditor";
import { PHASE_HINT, PHASE_LABEL, paragraphs } from "@/lib/format";
import { mutate, useGameState } from "@/lib/useGameState";
import { PHASES, type GmView, type Phase } from "@/lib/types";

type Tab = "cast" | "clues" | "solution" | "votes";

export function GmDashboard({ code }: { code: string }) {
  const { state, error, loading, apply } = useGameState(code, 4000);
  const [tab, setTab] = useState<Tab>("cast");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function send(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setActionError(null);
    const res = await mutate(path, method, body);
    if (res.ok) apply(res.view);
    else setActionError(res.error);
    setBusy(false);
    return res.ok;
  }

  if (loading) {
    return (
      <main className="shell center" style={{ paddingTop: 80 }}>
        <p className="muted">Отваряме случая…</p>
      </main>
    );
  }

  if (error || !state) {
    return (
      <main className="shell stack center" style={{ paddingTop: 70 }}>
        <h1>🔒</h1>
        <p className="alert">{error ?? "Няма достъп."}</p>
        <Link href="/" className="btn">
          Към началото
        </Link>
      </main>
    );
  }

  if (state.view !== "gm") {
    return (
      <main className="shell stack center" style={{ paddingTop: 70 }}>
        <h1>🔒</h1>
        <p className="notice">
          Този браузър не е водещият на играта. Ако си играч, отвори играта като играч.
        </p>
        <Link href={`/game/${code}`} className="btn btn-primary">
          Влез като играч
        </Link>
      </main>
    );
  }

  const v: GmView = state;

  return (
    <main className="shell shell-wide stack">
      <GmHeader view={v} busy={busy} send={send} />

      <div className="tabs" role="tablist">
        {(
          [
            ["cast", `Герои (${v.characters.length})`],
            ["clues", `Улики (${v.clues.length})`],
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

      {tab === "cast" && <CastTab view={v} busy={busy} send={send} code={code} />}
      {tab === "clues" && <CluesTab view={v} busy={busy} send={send} code={code} />}
      {tab === "solution" && <SolutionTab view={v} busy={busy} send={send} code={code} />}
      {tab === "votes" && <VotesTab view={v} busy={busy} send={send} code={code} />}
    </main>
  );
}

type Send = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<boolean>;

/* ── Header: code, share link, phase control ───────────────────── */
function GmHeader({ view, busy, send }: { view: GmView; busy: boolean; send: Send }) {
  const [copied, setCopied] = useState<string | null>(null);
  const code = view.game.code;
  const joinUrl = typeof window === "undefined" ? "" : `${window.location.origin}/game/${code}`;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <header className="stack" style={{ marginTop: 8 }}>
      <div className="row row-tight">
        <span className="badge badge-amber">Водещ</span>
        <span className="badge">
          👥 {view.playerCount} {view.playerCount === 1 ? "играч" : "играчи"}
        </span>
      </div>
      <h1>{view.game.title}</h1>

      <div className="panel stack-sm">
        <div className="eyebrow">Код за присъединяване</div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="code-display">{code}</span>
          <div className="row row-tight">
            <button className="btn btn-sm" onClick={() => copy(code, "code")}>
              {copied === "code" ? "✓ Копиран" : "Копирай кода"}
            </button>
            <button className="btn btn-sm" onClick={() => copy(joinUrl, "link")}>
              {copied === "link" ? "✓ Копиран" : "Копирай линка"}
            </button>
          </div>
        </div>
        <p className="hint">Играчите отварят сайта, въвеждат кода и си избират роля.</p>
      </div>

      <div className="panel stack-sm">
        <div className="eyebrow">Фаза на играта</div>
        <div className="row row-tight">
          {PHASES.map((p) => (
            <button
              key={p}
              className={`btn btn-sm ${view.game.phase === p ? "btn-primary" : ""}`}
              disabled={busy}
              onClick={() => send(`/api/games/${view.game.code}`, "PATCH", { phase: p })}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="hint">{PHASE_HINT[view.game.phase]}</p>
      </div>
    </header>
  );
}

/* ── Cast ──────────────────────────────────────────────────────── */
function CastTab({
  view,
  busy,
  send,
  code,
}: {
  view: GmView;
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
      {view.characters.length === 0 && !adding && (
        <div className="notice">
          Още няма герои. Добави по един за всеки участник — с история, тайна и цел.
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
          <div key={c.id} className="pick-item" style={{ cursor: "default" }}>
            <span className="em">{c.emoji || "🎭"}</span>
            <span className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
              <span className="nm">{c.name}</span>
              {c.role && <span className="faint">{c.role}</span>}
              <span className="row row-tight" style={{ marginTop: 2 }}>
                {c.claimed ? (
                  <span className="badge badge-teal">Заета от играч</span>
                ) : (
                  <span className="badge">Свободна</span>
                )}
                {c.is_culprit === 1 && <span className="badge badge-blood">🔪 Виновен</span>}
                {!c.secret.trim() && <span className="badge">Без тайна</span>}
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
        <div className="sticky-bar">
          <button className="btn btn-primary" onClick={startAdd} disabled={busy}>
            + Добави герой
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Clues ─────────────────────────────────────────────────────── */
function CluesTab({
  view,
  busy,
  send,
  code,
}: {
  view: GmView;
  busy: boolean;
  send: Send;
  code: string;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("all");

  async function add() {
    if (await send(`/api/games/${code}/clues`, "POST", { title, body, target })) {
      setTitle("");
      setBody("");
      setTarget("all");
    }
  }

  return (
    <div className="stack">
      <div className="notice">
        Улика стои скрита докато не я пуснеш. Щом я пуснеш, се появява при играчите сама — без да
        презареждат.
      </div>

      {view.clues.map((c) => (
        <div key={c.id} className="panel stack-sm">
          <div className="row row-tight">
            {c.released_at ? (
              <span className="badge badge-teal">Пусната</span>
            ) : (
              <span className="badge">Чернова</span>
            )}
            <span className="badge badge-violet">
              {c.target === "all" ? "📣 Всички" : `✉️ ${c.targetName}`}
            </span>
          </div>
          {c.title && <h3>{c.title}</h3>}
          <div className="section-body">
            {paragraphs(c.body).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="row row-tight">
            <button
              className={`btn btn-sm ${c.released_at ? "" : "btn-primary"}`}
              disabled={busy}
              onClick={() => send(`/api/games/${code}/clues/${c.id}`, "PATCH", { released: !c.released_at })}
            >
              {c.released_at ? "Скрий отново" : "🚀 Пусни сега"}
            </button>
            <span className="spacer" />
            <button
              className="btn btn-sm btn-danger"
              disabled={busy}
              onClick={() => send(`/api/games/${code}/clues/${c.id}`, "DELETE")}
            >
              Изтрий
            </button>
          </div>
        </div>
      ))}

      <div className="panel stack">
        <div className="eyebrow">Нова улика</div>
        <label className="field">
          <span>Заглавие</span>
          <input
            type="text"
            value={title}
            maxLength={160}
            placeholder="Намерен е ключ в саксията"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Текст</span>
          <textarea
            value={body}
            placeholder="Под саксията на терасата има ключ за избата. По него има кръв…"
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label className="field">
          <span>За кого</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">📣 Всички играчи</option>
            {view.characters.map((c) => (
              <option key={c.id} value={c.id}>
                ✉️ Само за {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={add} disabled={busy || !body.trim()}>
          Запази като чернова
        </button>
      </div>
    </div>
  );
}

/* ── Solution ──────────────────────────────────────────────────── */
function SolutionTab({
  view,
  busy,
  send,
  code,
}: {
  view: GmView;
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
                🔪 {c.emoji} {c.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="notice">
            Не си отбелязал виновен. Отвори герой в „Герои“ и сложи чекчето „Този герой е
            виновният“.
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
  view: GmView;
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
