import { paragraphs } from "@/lib/format";
import type { CharacterPrivate } from "@/lib/types";

export function CharacterCard({ c }: { c: CharacterPrivate }) {
  return (
    <article className="card">
      <header className="card-head">
        <span className="card-name">{c.name}</span>
      </header>

      {c.description.trim() && (
        <section className="section">
          <div className="section-body">
            {paragraphs(c.description).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
