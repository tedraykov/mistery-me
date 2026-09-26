#!/usr/bin/env node
/**
 * Generate a murder mystery with your local Claude Code (your subscription, not an API key) and
 * upload it as a new game.
 *
 *   npm run mystery -- Иван, Ива, Тео, Мария [--victim Иван] [--notes "90-те, вила в Боровец"]
 *   npm run mystery -- --from generated/2026-09-27-….json      # re-upload a saved generation
 *
 * The story never goes to the terminal: whoever runs this may be playing. Claude Code runs
 * headless (`claude -p`) with the system prompt in prompts/mystery-generator.md, the result is
 * saved under generated/ and uploaded, and only the game code, names and links are printed.
 *
 * Env: MYSTERY_APP_URL (default https://mistery.tedraykov.me), MYSTERY_PROMPT_FILE,
 *      MYSTERY_MODEL (passed to `claude --model`).
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_URL = (process.env.MYSTERY_APP_URL || "https://mistery.tedraykov.me").replace(/\/+$/, "");
const PROMPT_FILE = path.resolve(
  ROOT,
  process.env.MYSTERY_PROMPT_FILE || "prompts/mystery-generator.md",
);

// The app reads these limits; see src/lib/textFile.ts and the game PATCH route.
const MAX_DESCRIPTION = 8000;
const MAX_INTRO = 10000;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    solution: { type: "string" },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "intro", "solution", "characters"],
  additionalProperties: false,
};

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/* ── Arguments ──────────────────────────────────────────────────── */

function parseArgs(argv) {
  const opts = { names: [], victim: "", notes: "", title: "", from: "" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--victim") opts.victim = argv[++i] ?? "";
    else if (a === "--notes") opts.notes = argv[++i] ?? "";
    else if (a === "--title") opts.title = argv[++i] ?? "";
    else if (a === "--from") opts.from = argv[++i] ?? "";
    else rest.push(a);
  }
  // "Иван, Ива Петрова, Тео" keeps two-word names; without commas every word is a name.
  const raw = rest.join(" ");
  const parts = /[,\n]/.test(raw) ? raw.split(/[,\n]/) : raw.split(/\s+/);
  opts.names = [...new Set(parts.map((n) => n.trim().normalize("NFC")).filter(Boolean))];
  return opts;
}

/* ── Generation ─────────────────────────────────────────────────── */

/** The app parses the story mechanically, so these rules sit on top of your system prompt. */
function task({ names, victim, notes }) {
  return `Създай мистерия за убийство за тези гости. Всеки гост получава точно един герой със същото име:
${names.map((n) => `- ${n}`).join("\n")}

${victim ? `Убитият е ${victim}.` : "Избери сам кой от гостите е убитият."}
${notes ? `\nБележки от домакина:\n${notes}\n` : ""}
Приложението чете отговора ти машинно, затова тези правила са задължителни и са с предимство пред всичко останало:
1. Пиши всичко на български.
2. \`characters\` съдържа точно по един запис за всеки гост, в същия ред, с \`name\`, копирано точно.
3. Точно един герой е убитият. Неговото \`description\` започва с думата „УБИТ“ на отделен първи ред. Играчът с тази роля води играта: описанието му му казва, че е убитият и водещ, и съдържа уликите.
4. Поне един герой е убиецът. Неговото \`description\` започва с „УБИЕЦ“ на отделен първи ред. Никое друго описание не започва с някоя от тези две думи.
5. Уликите са абзаци в описанието на убития, всеки започва с „Улика 1:“, „Улика 2:“… в реда, в който се четат на глас — по една на всеки 25 минути. Ако системните указания не казват друго, напиши 6 улики. Всяка улика е един абзац, без празни редове вътре. Никой друг абзац не започва с „Улика“.
6. Всяко описание е обикновен текст — абзаци, разделени с празен ред, без Markdown — до 7000 знака. Това е единственото, което играчът чете: кой е, тайната му, какво знае и целта му.
7. \`intro\` е историята, която всички четат в началото (обикновен текст, до 9000 знака). Не издава убиеца.
8. \`solution\` се разкрива накрая: какво се е случило наистина и как уликите сочат убиеца.
9. \`title\` е кратко заглавие на мистерията.`;
}

async function generate(opts) {
  let system;
  try {
    system = readFileSync(PROMPT_FILE, "utf8");
  } catch {
    fail(`Няма системен промпт в ${path.relative(ROOT, PROMPT_FILE)}.`);
  }
  if (!system.trim()) fail(`${path.relative(ROOT, PROMPT_FILE)} е празен.`);

  const args = [
    "-p",
    "--output-format", "json",
    "--json-schema", JSON.stringify(SCHEMA),
    "--system-prompt-file", PROMPT_FILE,
    "--tools", "",
    "--no-session-persistence",
  ];
  if (process.env.MYSTERY_MODEL) args.push("--model", process.env.MYSTERY_MODEL);

  const env = { ...process.env };
  // Running from inside Claude Code: let the child start its own session.
  delete env.CLAUDECODE;
  // An API key would take precedence over the subscription login — this runs on the subscription.
  delete env.ANTHROPIC_API_KEY;

  console.error("✍️  Claude пише мистерията (обикновено 2–6 минути)…");
  const started = Date.now();
  const ticker = setInterval(() => {
    console.error(`   …${Math.round((Date.now() - started) / 1000)} с`);
  }, 30_000);

  // Run outside the repo so the project's CLAUDE.md and settings don't leak into the story.
  const child = spawn("claude", args, { cwd: os.tmpdir(), env, stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.end(task(opts));
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const exitCode = await new Promise((resolve) => {
    child.on("error", (e) => {
      err += e.message;
      resolve(-1);
    });
    child.on("close", resolve);
  });
  clearInterval(ticker);

  let result;
  try {
    result = JSON.parse(out);
  } catch {
    fail(`claude не върна резултат (код ${exitCode}).\n${err.trim() || out.trim()}`);
  }
  if (result.is_error || result.subtype !== "success" || !result.structured_output) {
    fail(`Генерирането не успя: ${result.subtype ?? ""} ${result.result ?? err}`.trim());
  }
  console.error(`   готово за ${Math.round((Date.now() - started) / 1000)} с`);
  return result.structured_output;
}

/** Every guest must have a character, named exactly as given. */
function matchNames(story, names) {
  const byName = new Map(story.characters.map((c) => [c.name.trim().toLowerCase(), c]));
  const missing = names.filter((n) => !byName.has(n.toLowerCase()));
  if (missing.length > 0) {
    fail(`Историята няма герои за: ${missing.join(", ")}. Пусни генерирането пак.`);
  }
  return names.map((n) => ({ name: n, description: byName.get(n.toLowerCase()).description }));
}

/* ── Upload ─────────────────────────────────────────────────────── */

async function call(url, init, what) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    fail(`${what}: няма връзка с ${APP_URL} (${e.message}).`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    fail(`${what}: ${res.status} ${body.error ?? res.statusText}`);
  }
  return res;
}

async function upload(story, characters) {
  const json = { "content-type": "application/json" };

  const created = await call(
    `${APP_URL}/api/games`,
    { method: "POST", headers: json, body: JSON.stringify({ title: story.title }) },
    "Създаване на играта",
  );
  const { code } = await created.json();
  const cookie = created.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith(`mm_gm_${code}=`));
  if (!cookie) fail("Сървърът не върна ключ за създател.");
  const key = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
  const headers = { ...json, cookie };

  for (const c of characters) {
    await call(
      `${APP_URL}/api/games/${code}/characters?as=creator`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ name: c.name, description: c.description.slice(0, MAX_DESCRIPTION) }),
      },
      `Качване на „${c.name}“`,
    );
  }
  const setup = await (
    await call(
      `${APP_URL}/api/games/${code}?as=creator`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          intro: story.intro.slice(0, MAX_INTRO),
          solution: story.solution.slice(0, MAX_DESCRIPTION),
        }),
      },
      "Качване на увода и решението",
    )
  ).json();

  return { code, key, setup };
}

/* ── Main ───────────────────────────────────────────────────────── */

const opts = parseArgs(process.argv.slice(2));
let story;
let savedTo;

if (opts.from) {
  try {
    ({ story, names: opts.names } = JSON.parse(readFileSync(path.resolve(opts.from), "utf8")));
  } catch (e) {
    fail(`Не мога да прочета ${opts.from}: ${e.message}`);
  }
  savedTo = opts.from;
} else {
  if (opts.names.length < 3) fail("Дай поне 3 имена, напр.: npm run mystery -- Иван, Ива, Тео");
  if (opts.victim && !opts.names.some((n) => n.toLowerCase() === opts.victim.toLowerCase())) {
    fail(`„${opts.victim}“ не е в списъка с имена.`);
  }
  story = await generate(opts);
  if (opts.title) story.title = opts.title;

  // Keep a copy in case the upload fails (re-upload with --from). Don't open it if you're playing.
  const dir = path.join(ROOT, "generated");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  savedTo = path.join(dir, `${stamp}.json`);
  writeFileSync(savedTo, JSON.stringify({ names: opts.names, story }, null, 2));
}

const characters = matchNames(story, opts.names);
const { code, key, setup } = await upload(story, characters);

const victim = setup.characters.find((c) => c.isVictim)?.name;
const check = (ok, label) => `${ok ? "✓" : "⚠️"} ${label}`;
console.log(`
✓ „${setup.game.title}“ е създадена — код ${code}

Герои (${setup.characters.length}): ${setup.characters.map((c) => c.name).join(", ")}
${check(setup.victimCount === 1, victim ? `убит: ${victim} (той води играта)` : `убити: ${setup.victimCount}`)}
${check(setup.culpritCount > 0, `убиец: ${setup.culpritCount > 0 ? "разпознат" : "липсва"}`)}
${check(setup.hasSolution, "решение")}  ${check(setup.game.intro.trim() !== "", "увод")}

Отвори като създател (само ти — линкът е като парола):
  ${APP_URL}/api/games/${code}/creator-login?key=${encodeURIComponent(key)}
Линк за играчите:
  ${APP_URL}/game/${code}

Копие: ${path.relative(ROOT, savedTo)} (не го отваряй, ако ще играеш)`);
