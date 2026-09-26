import { HttpError, currentPlayer, errorResponse, findGame, isHost, requireHost } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { get, run, touchGame } from "@/lib/db";
import { buildHostView, buildPlayerView } from "@/lib/state";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = findGame(code);
    if (!game) throw new HttpError(404, "Играта не е намерена");
    if (game.phase !== "voting") throw new HttpError(409, "Гласуването не е отворено");

    const player = await currentPlayer(game);
    if (!player) throw new HttpError(401, "Не сте в тази игра");
    if (!player.character_id) throw new HttpError(409, "Първо изберете своята роля");
    if (isHost(game, player)) throw new HttpError(403, "Водещият знае отговора — той не гласува");

    const body = await json(req);
    const characterId = str(body, "characterId", { max: 64 }).trim();
    const reason = str(body, "reason", { max: 2000 }).trim();
    const accused = get<{ is_victim: number }>(
      "SELECT is_victim FROM characters WHERE id = ? AND game_id = ?",
      characterId,
      game.id,
    );
    if (!accused) throw new HttpError(404, "Няма такъв герой");
    if (accused.is_victim) throw new HttpError(400, "Убитият не може да е убиецът");

    run(
      `INSERT INTO votes (game_id, player_id, character_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(game_id, player_id)
       DO UPDATE SET character_id = excluded.character_id,
                     reason = excluded.reason,
                     created_at = excluded.created_at`,
      game.id,
      player.id,
      characterId,
      reason,
      Date.now(),
    );
    touchGame(game.id);
    return Response.json(buildPlayerView(game, player));
  } catch (e) {
    return errorResponse(e);
  }
}

/** Host-only: wipe the tally so a round can be re-voted. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { game } = await requireHost(code);
    run("DELETE FROM votes WHERE game_id = ?", game.id);
    touchGame(game.id);
    return Response.json(buildHostView(game));
  } catch (e) {
    return errorResponse(e);
  }
}
