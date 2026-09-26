import { currentPlayer, errorResponse, findGame, isGm } from "@/lib/auth";
import { run } from "@/lib/db";
import { buildGmView, buildPlayerView } from "@/lib/state";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = findGame(code);
    if (!game) return Response.json({ error: "Играта не е намерена" }, { status: 404 });

    if (await isGm(game)) return Response.json(buildGmView(game));

    const player = await currentPlayer(game);
    if (!player) return Response.json({ error: "Не сте в тази игра", needJoin: true }, { status: 401 });

    run("UPDATE players SET last_seen = ? WHERE id = ?", Date.now(), player.id);
    return Response.json(buildPlayerView(game, player));
  } catch (e) {
    return errorResponse(e);
  }
}
