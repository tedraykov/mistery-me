# 🕯️ Мистерия — web mystery party game

A self-hosted web app for running a murder-mystery party. The game master writes the
introduction story and a plain-text description for each character; players join with a
6-character code, claim their role, and see **only their own** card. The GM also plays the
**victim**, whose description holds the clues: every 25 minutes a timer (only the GM sees it)
reminds them to read the next one aloud. Then voting, and finally the solution. The intro and the
clues can be read aloud through ElevenLabs.

UI language: **Bulgarian**.

---

## How it plays

| | |
|---|---|
| **1. Подготовка** | GM creates a game, gets a 6-char code, writes the intro story („Увод“), one character per guest, and the victim — their own role, with the clues in its description. Nobody else can see anything yet. |
| **2. Разпределяне на роли** | Players open the site, type the code, read the intro, and pick their character from the cast list. A taken role can't be picked twice. |
| **3. Играта върви** | Everyone reads their own card. Every 25 minutes the GM's timer rings and shows the victim's next clue to read out; they can also read one early. |
| **4. Гласуване** | Each player accuses someone and optionally writes why. The GM watches the tally live. |
| **5. Разкритие** | The solution, the real culprit(s) and the full vote tally become visible to everyone. |

A character is just a name and one free-text description (blank line = new paragraph) holding
everything the player needs — who they are, backstory, secret, goal. The description can also be
uploaded from a `.txt` file (UTF-8, UTF-16 or Windows-1251).

### The victim and the clue timer

Killer and victim aren't chosen with a switch — they are read from the **first word of the
description** (any letter case, leading emoji ignored):

| First word | Means |
|---|---|
| `УБИЕЦ` (also `УБИЕЦЪТ`, `УБИЙЦА`, `УБИЙЦАТА`) | 🔪 the killer — shown to everyone at the reveal |
| `УБИТ` (also `УБИТИЯТ`, `УБИТА`, `УБИТАТА`) | ☠️ the victim — there should be exactly one |

The flags are recomputed every time a description is saved (and once on boot); the editor shows
what it recognised as you type.

The GM plays the victim: players see them in the cast but can't pick or accuse them, and the GM
gets their card under „☠️ Моята роля“.

Clues live in the victim's description — every paragraph that starts with „Улика“:

```
Улика 1: Под саксията на терасата има ключ за избата.

Улика 2: В избата мирише на бензин.
```

When the game moves to „Играта върви“, a 25-minute timer starts on the GM's dashboard (it is
never sent to players). When it runs out it chimes, vibrates, keeps the screen awake and shows the
next clue; „✓ Прочетох я“ starts the next 25 minutes. „Прочети по-рано“ stops the countdown to read
a clue before time. The timer is kept on the server, so a refresh or a second GM device doesn't
lose it. The interval is `CLUE_INTERVAL_MS` in `src/lib/format.ts`.

The GM has a **👁️ Преглед** button to see the rendered card before saving.

---

## Stack

- **Next.js 16** (App Router) + React 19, TypeScript
- **SQLite via Node's built-in `node:sqlite`** — no native modules, nothing to compile
- Hand-written CSS, no UI framework
- Identity is cookie-based: no accounts, no passwords. The GM's browser holds the game-master
  token; each player's browser holds a player token. Clearing cookies loses access to that role.
- Clients poll `/api/games/:code/state` every 3–4s, so phase changes land without a refresh.

## Read-aloud (ElevenLabs)

Set `ELEVENLABS_API_KEY` and a **🔊 Чуй** button appears next to the intro story (GM and players)
and next to the clue on the GM's timer. Without the key the buttons simply don't show.

- Each distinct text is synthesized once and cached as an mp3 in `$DATA_DIR/tts/`, so ten phones
  replaying a clue cost one API call. Editing a text generates a fresh file on next play.
- The next clue is synthesized in the background as soon as its 25 minutes start, so it plays
  instantly when it's due.
- Players can only fetch the intro, and only once the game has left setup. Clue audio is GM-only.
- `ELEVENLABS_VOICE_ID` picks the voice (default: premade "George"); `ELEVENLABS_MODEL_ID`
  defaults to `eleven_multilingual_v2`, which handles Bulgarian. The intro is capped at 10 000
  characters, the model's per-request limit.

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

All routes are cookie-scoped; the same URL returns a different payload to the GM and to a player,
and a player's payload never contains another character's secret.

| Method | Route | Who |
|---|---|---|
| `POST` | `/api/games` | anyone → becomes GM of the new game |
| `POST` | `/api/games/:code/session` | anyone → joins as a player if not already known |
| `GET` | `/api/games/:code/state` | GM or player → role-aware view (polled) |
| `POST` | `/api/games/:code/claim` | player → claim / release a character |
| `POST` | `/api/games/:code/vote` | player → accuse (only during `voting`) |
| `DELETE` | `/api/games/:code/vote` | GM → clear the tally |
| `PATCH` | `/api/games/:code` | GM → title, phase, intro, solution, `clueRead`, `resetClues` |
| `POST` `PATCH` `DELETE` | `/api/games/:code/characters[/:id]` | GM |
| `GET` | `/api/games/:code/audio/intro` | GM, or a player once past setup → mp3 |
| `GET` | `/api/games/:code/audio/clue/:n` | GM → the victim's clue `n` as mp3 |
| `GET` | `/api/health` | anyone |

## Data model

`games` → `characters`, `players`, `votes`. The clue timer is two columns on `games`
(`clue_round_started_at`, `clues_read`); the victim is `characters.is_victim`. A player row holds a nullable
`character_id`; a unique index on it enforces that two people can't claim the same role.
Schema is applied idempotently on boot (`src/lib/db.ts`) — no migration step to run. Databases
from before the plain-text characters get their old sections (and role / pair lines) folded into
`description` once, on first boot.
