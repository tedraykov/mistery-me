import { bullets, paragraphs } from "@/lib/format";
import type { CharacterPrivate } from "@/lib/types";

function Prose({ text }: { text: string }) {
  return (
    <div className="section-body">
      {paragraphs(text).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Bullets({ text }: { text: string }) {
  return (
    <div className="section-body">
      <ul>
        {bullets(text).map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  icon,
  title,
  variant,
  children,
}: {
  icon: string;
  title: string;
  variant?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`section ${variant ?? ""}`}>
      <div className="section-title">
        <span className="ico">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

export function CharacterCard({ c }: { c: CharacterPrivate }) {
  return (
    <article className="card">
      <header className="card-head">
        <div className="row" style={{ gap: 14, alignItems: "center" }}>
          {c.emoji && <span className="card-emoji">{c.emoji}</span>}
          <span className="card-name">{c.name}</span>
        </div>
        <div className="card-meta">
          {c.role && (
            <span>
              Роля: <b>{c.role}</b>
            </span>
          )}
          {c.pair && (
            <span>
              Двойка с: <b>{c.pair}</b>
            </span>
          )}
        </div>
      </header>

      {c.about.trim() && (
        <Section icon="👤" title="За теб">
          <Prose text={c.about} />
        </Section>
      )}
      {c.secret.trim() && (
        <Section icon="🤫" title="Твоята тайна" variant="section-secret">
          <Prose text={c.secret} />
        </Section>
      )}
      {c.knows.trim() && (
        <Section icon="🧠" title="Какво знаеш" variant="section-knows">
          <Bullets text={c.knows} />
        </Section>
      )}
      {c.goal.trim() && (
        <Section icon="🎯" title="Твоята цел" variant="section-goal">
          <Prose text={c.goal} />
        </Section>
      )}
      {c.important.trim() && (
        <Section icon="⚠️" title="Важно" variant="section-warn">
          <Bullets text={c.important} />
        </Section>
      )}
    </article>
  );
}
