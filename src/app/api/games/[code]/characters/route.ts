import { errorResponse, requireGm } from "@/lib/auth";
import { json, requiredStr, str } from "@/lib/body";
import { get, run, touchGame } from "@/lib/db";
import { id } from "@/lib/ids";
import { buildGmView } from "@/lib/state";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = await requireGm(code);
    const body = await json(req);

    const next =
      (get<{ n: number | null }>(
        "SELECT MAX(sort_order) AS n FROM characters WHERE game_id = ?",
        game.id,
      )?.n ?? 0) + 1;

    run(
      `INSERT INTO characters
         (id, game_id, name, description, is_culprit, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id(),
      game.id,
      requiredStr(body, "name", 80),
      str(body, "description"),
      body.isCulprit ? 1 : 0,
      next,
    );

    touchGame(game.id);
    return Response.json(buildGmView(game));
  } catch (e) {
    return errorResponse(e);
  }
}
