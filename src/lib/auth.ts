import { cookies } from "next/headers";
import { get } from "./db";
import type { GameRow, PlayerRow } from "./types";

const YEAR = 60 * 60 * 24 * 365;

/** Held by the browser that created the game (named "gm" from before the victim ran games). */
export const gmCookie = (code: string) => `mm_gm_${code}`;
export const playerCookie = (code: string) => `mm_pl_${code}`;

export function findGame(code: string): GameRow | undefined {
  return get<GameRow>("SELECT * FROM games WHERE code = ?", code);
}

export async function setGmCookie(code: string, gmToken: string): Promise<void> {
  (await cookies()).set(gmCookie(code), gmToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR,
  });
}

export async function setPlayerCookie(code: string, playerToken: string): Promise<void> {
  (await cookies()).set(playerCookie(code), playerToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR,
  });
}

export async function isCreator(game: GameRow): Promise<boolean> {
  const jar = await cookies();
  return jar.get(gmCookie(game.code))?.value === game.gm_token;
}

export async function currentPlayer(game: GameRow): Promise<PlayerRow | undefined> {
  const jar = await cookies();
  const tok = jar.get(playerCookie(game.code))?.value;
  if (!tok) return undefined;
  return get<PlayerRow>(
    "SELECT * FROM players WHERE game_id = ? AND token = ?",
    game.id,
    tok,
  );
}

/** The player holding the victim's role runs the game. */
export function isHost(game: GameRow, player: PlayerRow | undefined): boolean {
  if (!player?.character_id) return false;
  return Boolean(
    get("SELECT 1 FROM characters WHERE id = ? AND game_id = ? AND is_victim = 1", player.character_id, game.id),
  );
}

/**
 * The creator's page sends `?as=creator`; everything else acts as a player. The same browser can
 * be both, since the creator may also be playing.
 */
export function asCreator(req: Request): boolean {
  return new URL(req.url).searchParams.get("as") === "creator";
}

export function requireGame(code: string): GameRow {
  const game = findGame(code);
  if (!game) throw new HttpError(404, "Играта не е намерена");
  return game;
}

/** Route-handler guard for the creator's setup page. */
export async function requireCreator(code: string): Promise<GameRow> {
  const game = requireGame(code);
  if (!(await isCreator(game))) throw new HttpError(403, "Само създателят на играта може да прави това");
  return game;
}

/** Route-handler guard: the caller holds the victim's role. */
export async function requireHost(code: string): Promise<{ game: GameRow; player: PlayerRow }> {
  const game = requireGame(code);
  const player = await currentPlayer(game);
  if (!player || !isHost(game, player)) {
    throw new HttpError(403, "Само водещият (убитият) може да прави това");
  }
  return { game, player };
}

/** Creator (from the setup page) or host — the two who may edit characters and the intro. */
export async function requireEditor(
  req: Request,
  code: string,
): Promise<{ game: GameRow; actor: "creator" | "host"; player?: PlayerRow }> {
  if (asCreator(req)) return { game: await requireCreator(code), actor: "creator" };
  const { game, player } = await requireHost(code);
  return { game, actor: "host", player };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: "Вътрешна грешка" }, { status: 500 });
}
