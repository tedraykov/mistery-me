import { cookies } from "next/headers";
import { get } from "./db";
import type { GameRow, PlayerRow } from "./types";

const YEAR = 60 * 60 * 24 * 365;

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

export async function isGm(game: GameRow): Promise<boolean> {
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

/** Route-handler guard: resolves the game + asserts the caller is its game master. */
export async function requireGm(code: string): Promise<GameRow> {
  const game = findGame(code);
  if (!game) throw new HttpError(404, "Играта не е намерена");
  if (!(await isGm(game))) throw new HttpError(403, "Само водещият може да прави това");
  return game;
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
