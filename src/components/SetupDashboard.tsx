"use client";

import Link from "next/link";
import { useState } from "react";
import { JoinLine, PhaseStepper, type Send } from "@/components/GameChrome";
import { ImportTxt } from "@/components/ImportTxt";
import { IntroEditor } from "@/components/IntroEditor";
import { initial } from "@/lib/format";
import { MAX_DESCRIPTION, MAX_FILE_BYTES, readText } from "@/lib/textFile";
import { mutate, useGameState } from "@/lib/useGameState";
import type { Phase, SetupView } from "@/lib/types";

type Tab = "cast" | "intro";

const CREATOR_PHASES: Phase[] = ["setup", "lobby"];

/** Every request from this page acts as the creator, even if this browser is also a player. */
const asCreator = (path: string) => `${path}${path.includes("?") ? "&" : "?"}as=creator`;

/**
 * The creator's page. They upload the characters blind — names only, never the descriptions or
 * who the killer is — so they can play too. Whoever picks the victim runs the game from there.
 */
export function SetupDashboard({ code }: { code: string }) {
  const { state, error, loading, apply } = useGameState(code, 4000, true);
  const [tab, setTab] = useState<Tab>("cast");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const send: Send = async (path, method, body) => {
    setBusy(true);
    setActionError(null);
    const res = await mutate(asCreator(path), method, body);
    if (res.ok) apply(res.view);
    else setActionError(res.error);
    setBusy(false);
    return res.ok;
  };

  if (loading) {
    return (
      <main className="shell center" style={{ paddingTop: 80 }}>
        <p className="muted">Отваряме случая…</p>
      </main>
    );
  }

  if (error || !state || state.view !== "setup") {
    return (
      <main className="shell stack center" style={{ paddingTop: 70 }}>
        <h1>🔒</h1>
        <p className="notice">
          {error ?? "Тази игра е създадена от друг браузър."} Ако играеш, влез като играч.
        </p>
        <Link href={`/game/${code}`} className="btn btn-primary">
          Влез като играч
        </Link>
      </main>
    );
  }

  const v: SetupView = state;
  const canSwitch = CREATOR_PHASES.includes(v.game.phase);
  const hint =
    v.game.phase === "setup"
      ? "Качи героите и увода. Когато си готов, отвори за играчи."
      : v.game.phase === "lobby"
        ? v.hostName
          ? `${v.hostName} (убитият) е избран — играчът с тази роля води играта и я стартира.`
          : "Играчите избират роли. Който избере убития, ще води играта."
        : `Играта се води от ${v.hostName ?? "убития"}.`;

  return (
    <main className="shell shell-wide stack">
      <header className="stack" style={{ marginTop: 8 }}>
        <div className="stack-sm">
          <h1>{v.game.title}</h1>
          <JoinLine code={code} playerCount={v.playerCount} badge="Създател" />
        </div>
        <PhaseStepper
          phase={v.game.phase}
          allowed={canSwitch ? CREATOR_PHASES : []}
          busy={busy}
          hint={hint}
          onSelect={(phase) => send(`/api/games/${code}`, "PATCH", { phase })}
        />
      </header>

      <div className="tabs" role="tablist">
        {(
          [
            ["cast", `Герои (${v.characters.length})`],
            ["intro", "Увод"],
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

      {tab === "cast" && <CastList view={v} busy={busy} send={send} code={code} />}
      {tab === "intro" && (
        <IntroEditor
          intro={v.game.intro}
          introAudio={v.introAudio}
          tts={v.tts}
          busy={busy}
          onSave={(intro) => send(`/api/games/${code}`, "PATCH", { intro })}
        />
      )}
    </main>
  );
}

function CastList({
  view,
  busy,
  send,
  code,
}: {
  view: SetupView;
  busy: boolean;
  send: Send;
  code: string;
}) {
  async function replace(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || file.size > MAX_FILE_BYTES) return;
    const text = await readText(file);
    if (text) {
      await send(`/api/games/${code}/characters/${id}`, "PATCH", {
        description: text.slice(0, MAX_DESCRIPTION),
      });
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Да изтрием ли „${name}“? Това не може да се върне.`)) return;
    await send(`/api/games/${code}/characters/${id}`, "DELETE");
  }

  return (
    <div className="stack">
      <div className="notice">
        🙈 Не виждаш ролите — описанията и кой е убиецът са скрити, за да можеш и ти да играеш.
        Вижда ги само играчът, който избере убития: той води играта.
      </div>

      {view.characters.length > 0 && <Checks view={view} />}

      {view.characters.length === 0 && (
        <div className="notice">
          Качи героите като .txt файлове — по един файл за герой. Името на файла става име на героя,
          а текстът — описание. Описанието на убития започва с „УБИТ“, на убиеца — с „УБИЕЦ“.
        </div>
      )}

      {view.characters.map((c) => (
        <div key={c.id} className="pick-item cast-row" style={{ cursor: "default" }}>
          <span className="em">{initial(c.name)}</span>
          <span className="stack" style={{ gap: 3, flex: "1 1 150px", minWidth: 0 }}>
            <span className="nm">{c.name}</span>
            <span className="row row-tight" style={{ marginTop: 2 }}>
              {c.isVictim && <span className="badge badge-violet">☠️ Убитият · води играта</span>}
              {c.claimed ? (
                <span className="badge badge-teal">Заета от играч</span>
              ) : (
                <span className="badge">Свободна</span>
              )}
              {c.empty && <span className="badge badge-blood">Празно описание</span>}
            </span>
          </span>
          <span className="row row-tight">
            <label className="btn btn-sm" aria-disabled={busy}>
              Замени от .txt
              <input
                type="file"
                accept=".txt,text/plain"
                hidden
                disabled={busy}
                onChange={(e) => replace(c.id, e)}
              />
            </label>
            <button
              className="btn btn-sm btn-danger"
              disabled={busy}
              onClick={() => remove(c.id, c.name)}
            >
              Изтрий
            </button>
          </span>
        </div>
      ))}

      <div className="sticky-bar row" style={{ alignItems: "flex-end" }}>
        <ImportTxt
          characters={view.characters}
          busy={busy}
          save={(id, name, description) =>
            id
              ? send(`/api/games/${code}/characters/${id}`, "PATCH", { description })
              : send(`/api/games/${code}/characters`, "POST", { name, description })
          }
        />
        <span className="spacer" />
        <Link href={`/game/${code}`} className="btn btn-ghost">
          Влез като играч →
        </Link>
      </div>
    </div>
  );
}

/** Whether the upload has exactly one victim and at least one killer — without saying who. */
function Checks({ view }: { view: SetupView }) {
  return (
    <div className="panel stack-sm">
      <div className="eyebrow">Проверка на файловете</div>
      {view.victimCount === 1 ? (
        <span>✓ Убитият е разпознат („УБИТ“ в началото на описанието).</span>
      ) : view.victimCount === 0 ? (
        <span className="hint-warn">
          ⚠️ Никое описание не започва с „УБИТ“ — без убит няма кой да води играта.
        </span>
      ) : (
        <span className="hint-warn">
          ⚠️ {view.victimCount} описания започват с „УБИТ“ — трябва да е само едно.
        </span>
      )}
      {view.culpritCount > 0 ? (
        <span>✓ Убиецът е разпознат („УБИЕЦ“ в началото на описанието) — кой е, не ти казваме.</span>
      ) : (
        <span className="hint-warn">⚠️ Никое описание не започва с „УБИЕЦ“.</span>
      )}
    </div>
  );
}
