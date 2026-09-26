import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  gm_token    TEXT NOT NULL,
  phase       TEXT NOT NULL DEFAULT 'setup',
  solution    TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id          TEXT PRIMARY KEY,
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  pair        TEXT NOT NULL DEFAULT '',
  about       TEXT NOT NULL DEFAULT '',
  secret      TEXT NOT NULL DEFAULT '',
  knows       TEXT NOT NULL DEFAULT '',
  goal        TEXT NOT NULL DEFAULT '',
  important   TEXT NOT NULL DEFAULT '',
  is_culprit  INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_characters_game ON characters(game_id);

CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  game_id       TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  character_id  TEXT REFERENCES characters(id) ON DELETE SET NULL,
  joined_at     INTEGER NOT NULL,
  last_seen     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_token ON players(game_id, token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_character ON players(character_id);

CREATE TABLE IF NOT EXISTS clues (
  id            TEXT PRIMARY KEY,
  game_id       TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  target        TEXT NOT NULL DEFAULT 'all',
  released_at   INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clues_game ON clues(game_id);

CREATE TABLE IF NOT EXISTS votes (
  game_id       TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (game_id, player_id)
);
`;

function open(): DatabaseSync {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "mistery.sqlite"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// Next dev-mode hot reload re-evaluates modules; keep one handle per process.
const globalForDb = globalThis as unknown as { __misteryDb?: DatabaseSync };
export const db: DatabaseSync = (globalForDb.__misteryDb ??= open());

export function all<T>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function get<T>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): void {
  db.prepare(sql).run(...(params as never[]));
}

export function touchGame(gameId: string): void {
  run("UPDATE games SET updated_at = ? WHERE id = ?", Date.now(), gameId);
}
