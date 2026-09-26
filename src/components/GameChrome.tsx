"use client";

import { useState } from "react";
import { PHASE_HINT, PHASE_LABEL } from "@/lib/format";
import { PHASES, type Phase } from "@/lib/types";

export type Send = (
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
) => Promise<boolean>;

/** Title line under the heading: who you are here, the join code, and the player count. */
export function JoinLine({
  code,
  playerCount,
  badge,
}: {
  code: string;
  playerCount: number;
  badge: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
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
    <div className="join-line">
      <span className="badge badge-amber">{badge}</span>
      <span>
        Код <span className="code-chip">{code}</span>
      </span>
      <button className="link-btn" onClick={() => copy(code, "code")}>
        {copied === "code" ? "✓ копиран" : "копирай"}
      </button>
      <span aria-hidden>·</span>
      <button className="link-btn" onClick={() => copy(joinUrl, "link")}>
        {copied === "link" ? "✓ копиран" : "копирай линка"}
      </button>
      <span aria-hidden>·</span>
      <span>
        👥 {playerCount} {playerCount === 1 ? "играч" : "играчи"}
      </span>
    </div>
  );
}

/** The five phases as a stepper. Only phases in `allowed` can be clicked. */
export function PhaseStepper({
  phase,
  allowed = PHASES,
  busy,
  onSelect,
  hint,
}: {
  phase: Phase;
  allowed?: Phase[];
  busy: boolean;
  onSelect: (p: Phase) => void;
  hint?: string;
}) {
  const current = PHASES.indexOf(phase);
  return (
    <div className="panel stack-sm">
      <ol className="phases">
        {PHASES.map((p, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={p} className="phase" data-state={state}>
              <button
                type="button"
                disabled={busy || i === current || !allowed.includes(p)}
                aria-current={i === current ? "step" : undefined}
                onClick={() => onSelect(p)}
              >
                <span className="phase-dot">{i < current ? "✓" : i + 1}</span>
                <span className="phase-label">{PHASE_LABEL[p]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="phase-now">{PHASE_LABEL[phase]}</p>
      <p className="hint center">{hint ?? PHASE_HINT[phase]}</p>
    </div>
  );
}
