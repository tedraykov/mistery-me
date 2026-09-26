import { currentPlayer, errorResponse, findGame, isGm, setPlayerCookie } from "@/lib/auth";
import { run, touchGame } from "@/lib/db";
import { id, token } from "@/lib/ids";
import { buildGmView, buildPlayerView } from "@/lib/state";

/** Page bootstrap: resolves who the caller is, joining them as a new player if needed. */
export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = findGame(code);
    if (!game) return Response.json({ error: "Няма игра с този код" }, { status: 404 });

    if (await isGm(game)) return Response.json(buildGmView(game));

    let player = await currentPlayer(game);
    if (!player) {
      const now = Date.now();
      const playerToken = token();
      const playerId = id();
      run(
        `INSERT INTO players (id, game_id, token, character_id, joined_at, last_seen)
         VALUES (?, ?, ?, NULL, ?, ?)`,
        playerId,
        game.id,
        playerToken,
        now,
        now,
      );
      await setPlayerCookie(code, playerToken);
      touchGame(game.id);
      player = {
        id: playerId,
        game_id: game.id,
        token: playerToken,
        character_id: null,
        joined_at: now,
        last_seen: now,
      };
    }

    return Response.json(buildPlayerView(game, player));
  } catch (e) {
    return errorResponse(e);
  }
}
