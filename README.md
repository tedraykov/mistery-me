# 🕯️ Мистерия — web mystery party game

A self-hosted web app for running a murder-mystery party. Whoever creates a game uploads the
characters as `.txt` files **without seeing their roles** — so they can play too. Players join with
a 6-character code, claim a role, and see **only their own** card. The player who picks the
**victim** becomes the host: they alone see every role, run the phases, and read out the clues
hidden in the victim's description when a 25-minute timer (only on their phone) tells them to.
Then voting, and finally the solution. The intro and the clues can be read aloud through
ElevenLabs.

### Three kinds of people

| | Where | Sees | Can |
|---|---|---|---|
| **Създател** (creator) | `/gm/КОД` | names only, and whether a victim, a killer and a solution were recognised | upload / replace / delete characters, write the intro, upload the solution blind, open roles (`setup` ⇄ `lobby`) |
| **Водещ** (host) = the player holding the victim | `/game/КОД` | every character's description, the killer, votes | everything: phases, clue timer, solution, editing characters |
| **Играч** (player) | `/game/КОД` | their own card, the intro, the cast list | pick a role, vote |

The creator can also play: „Влез като играч“ joins the same game from the same browser. Requests
from the creator's page carry `?as=creator`, so a browser that is both never mixes the two up.

UI language: **Bulgarian**.

---

## How it plays

| | |
|---|---|
| **1. Подготовка** | The creator makes a game, gets a 6-char code, uploads one `.txt` per character (the victim's holds the clues) and writes the intro story („Увод“). Nobody can see the roles. |
| **2. Разпределяне на роли** | Players type the code, read the intro and pick a character. Whoever picks the victim becomes the host and gets the host panel. |
| **3. Играта върви** | The host starts the game. Everyone reads their own card; every 25 minutes the host's timer rings and shows the victim's next clue to read out (or earlier, if they choose). |
| **4. Гласуване** | Each player (not the host) accuses someone and optionally writes why. The host watches the tally live. |
| **5. Разкритие** | The solution, the real culprit(s) and the full vote tally become visible to everyone. |

A character is just a name and one free-text description (blank line = new paragraph) holding
everything the player needs — who they are, backstory, secret, goal.

**Uploading:** „📂 Качи .txt файлове“ takes many files at once — one character per file. The file
name is the name (`Тео.txt` → Тео; a leading number only sets the order: `01 - Тео.txt` → Тео), the
contents the description. A file named like an existing character replaces its description instead
of adding a duplicate. `Увод.txt` and `Решение.txt` set the intro and the solution (the creator can
upload the solution but never read it back). UTF-8, UTF-16 and Windows-1251 are all read correctly.

### The victim and the clue timer

Killer and victim aren't chosen with a switch — they are read from the **first word of the
description** (any letter case, leading emoji ignored):

| First word | Means |
|---|---|
| `УБИЕЦ` (also `УБИЕЦЪТ`, `УБИЙЦА`, `УБИЙЦАТА`) | 🔪 the killer — shown to everyone at the reveal |
| `УБИТ` (also `УБИТИЯТ`, `УБИТА`, `УБИТАТА`) | ☠️ the victim — there should be exactly one |

The flags are recomputed every time a description is saved (and once on boot). The creator only
learns *that* a victim and a killer were recognised, never who the killer is.

The player who picks the victim is the host: they see their own card under „☠️ Моята роля“, every
other card under „Герои“, and can't be accused or vote.

Clues live in the victim's description — every paragraph that starts with „Улика“:

```
Улика 1: Под саксията на терасата има ключ за избата.

Улика 2: В избата мирише на бензин.
```

When the host moves the game to „Играта върви“, a 25-minute timer starts on their screen (it is
never sent to anyone else). When it runs out it chimes, vibrates, keeps the screen awake and shows the
next clue; „✓ Прочетох я“ starts the next 25 minutes. „Прочети по-рано“ stops the countdown to read
a clue before time. The timer is kept on the server, so a refresh doesn't lose it. The interval is `CLUE_INTERVAL_MS` in `src/lib/format.ts`.

The host's character editor has a **👁️ Преглед** button to see the rendered card before saving.

---

## Stack

- **Next.js 16** (App Router) + React 19, TypeScript
- **SQLite via Node's built-in `node:sqlite`** — no native modules, nothing to compile
- Hand-written CSS, no UI framework
- Identity is cookie-based: no accounts, no passwords. The creator's browser holds the creator
  token; each player's browser holds a player token (the host is simply the player holding the
  victim). Clearing cookies loses access to that role.
- Clients poll `/api/games/:code/state` every 3–4s, so phase changes land without a refresh.

## Read-aloud (ElevenLabs)

Set `ELEVENLABS_API_KEY` and a **🔊 Чуй** button appears next to the intro story (for everyone)
and next to the clue on the host's timer. Without the key the buttons simply don't show.

- Each distinct text is synthesized once and cached as an mp3 in `$DATA_DIR/tts/`, so ten phones
  replaying a clue cost one API call. Editing a text generates a fresh file on next play.
- The next clue is synthesized in the background as soon as its 25 minutes start, so it plays
  instantly when it's due.
- Players can only fetch the intro, and only once the game has left setup. Clue audio is host-only.
- `ELEVENLABS_VOICE_ID` picks the voice (default: premade "George"); `ELEVENLABS_MODEL_ID`
  defaults to `eleven_multilingual_v2`, which handles Bulgarian. The intro is capped at 10 000
  characters, the model's per-request limit.

## Generating a mystery with Claude Code

Instead of writing the `.txt` files yourself, let your local Claude Code write the whole mystery
from a list of names — on your Claude subscription, no API key — and upload it as a new game:

```bash
# in Claude Code, from this repo:
/mystery Иван, Ива Петрова, Тео, Мария --victim Иван --notes "рожден ден във вила"

# or straight from the shell:
npm run mystery -- Иван, Ива Петрова, Тео, Мария --victim Иван
```

- **Your system prompt** lives in `prompts/mystery-generator.md` — style, tone, length, number of
  clues. The script adds the rules the app depends on (one character per name, `УБИТ` / `УБИЕЦ`,
  `Улика N:` paragraphs) on top of it.
- It runs `claude -p` headless (structured JSON output, no tools, outside the repo so this
  project's `CLAUDE.md` doesn't leak in), creates a game on `MYSTERY_APP_URL` (default
  `https://mistery.tedraykov.me`; set it in `.env`, e.g. `http://localhost:3000` for dev), and
  uploads the characters, intro and solution.
- **It stays blind:** only the game code, the names, the checks (victim / killer / solution / intro
  recognised) and two links are printed. The first link — `/api/games/КОД/creator-login?key=…` —
  gives your browser creator access to the new game; it works like a password.
- A copy is kept in `generated/` (gitignored) in case the upload fails:
  `npm run mystery -- --from generated/<file>.json` re-uploads it. Don't open it if you're playing.
- Names with spaces: separate names with commas. `MYSTERY_MODEL` picks the model (`claude --model`).
- If `ANTHROPIC_API_KEY` is set in your shell, the script drops it for the child process so the
  run uses your subscription.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

The database is created automatically at `./data/mistery.sqlite` (override with `DATA_DIR`).

```bash
npm run typecheck
npm run build
npm start            # production check; warns about `output: standalone` — harmless here,
                     # the Docker image runs the standalone server instead
```

## Docker

```bash
docker compose up --build       # http://localhost:3000
```

The image is a three-stage build ending in `node:24-alpine` running Next's standalone output as
the non-root `node` user, with a `/api/health` healthcheck.

## Deploying on Dokploy

1. Create an **Application** pointing at this repo (or a **Compose** service using
   `docker-compose.yml`).
2. Build type: **Dockerfile** — not Nixpacks (Dokploy's default). Nixpacks ships an old Node,
   doesn't set `DATA_DIR` (so the database misses the volume), and bakes env vars — including
   `ELEVENLABS_API_KEY` — into the image as build args.
3. **Add a persistent volume** — this is the one thing that matters:

   | | |
   |---|---|
   | Mount path (in container) | `/app/data` |
   | Type | Volume mount |

   Without it the SQLite file lives in the container's writable layer and every redeploy wipes
   all games.
4. Environment variables (both already defaulted in the image, set them only if you change
   anything):

   ```
   DATA_DIR=/app/data
   PORT=3000
   ```

   Add `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_VOICE_ID`) to enable read-aloud.
5. Set the container port to **3000** and attach your domain. Dokploy's Traefik terminates TLS.
6. Health check path: `/api/health`.
7. **Keep replicas at 1.** One SQLite file wants one writer process; scaling horizontally would
   need a different database.

### Backups

The whole game lives in one file. To grab a copy:

```bash
docker cp <container>:/app/data/mistery.sqlite ./mistery-backup.sqlite
```

---

## API surface

All routes are cookie-scoped; the same URL returns a different payload to the creator
(`?as=creator`), the host and a player. Only the host's payload contains other characters'
descriptions or the killer.

| Method | Route | Who |
|---|---|---|
| `POST` | `/api/games` | anyone → becomes the creator of the new game |
| `POST` | `/api/games/:code/session` | anyone → joins as a player if not already known |
| `GET` | `/api/games/:code/state` | creator, host or player → role-aware view (polled) |
| `POST` | `/api/games/:code/claim` | player → claim / release a character (claiming the victim makes you host) |
| `POST` | `/api/games/:code/vote` | player other than the host → accuse (only during `voting`) |
| `DELETE` | `/api/games/:code/vote` | host → clear the tally |
| `PATCH` | `/api/games/:code` | creator → title, intro, solution (write-only), `setup`⇄`lobby`; host → also every phase, `clueRead`, `resetClues` |
| `GET` | `/api/games/:code/creator-login?key=…` | holder of the creator key → creator cookie, redirect to `/gm/КОД` |
| `POST` `PATCH` `DELETE` | `/api/games/:code/characters[/:id]` | creator or host |
| `GET` | `/api/games/:code/audio/intro` | creator, or a player once past setup → mp3 |
| `GET` | `/api/games/:code/audio/clue/:n` | host → the victim's clue `n` as mp3 |
| `GET` | `/api/health` | anyone |

## Data model

`games` → `characters`, `players`, `votes`. The clue timer is two columns on `games`
(`clue_round_started_at`, `clues_read`); the victim is `characters.is_victim`. A player row holds a nullable
`character_id`; a unique index on it enforces that two people can't claim the same role.
Schema is applied idempotently on boot (`src/lib/db.ts`) — no migration step to run. Databases
from before the plain-text characters get their old sections (and role / pair lines) folded into
`description` once, on first boot.
