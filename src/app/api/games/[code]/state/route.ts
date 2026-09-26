import { asCreator, currentPlayer, errorResponse, findGame, requireCreator } from "@/lib/auth";
import { run } from "@/lib/db";
import { buildSetupView, viewForPlayer } from "@/lib/state";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    if (asCreator(req)) return Response.json(buildSetupView(await requireCreator(code)));

    const game = findGame(code);
    if (!game) return Response.json({ error: "Играта не е намерена" }, { status: 404 });

    const player = await currentPlayer(game);
    if (!player) return Response.json({ error: "Не сте в тази игра", needJoin: true }, { status: 401 });

    run("UPDATE players SET last_seen = ? WHERE id = ?", Date.now(), player.id);
    return Response.json(viewForPlayer(game, player));
  } catch (e) {
    return errorResponse(e);
  }
}
