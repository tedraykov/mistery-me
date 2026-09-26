import { HttpError, errorResponse, requireGm } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { get, run, touchGame } from "@/lib/db";
import { id } from "@/lib/ids";
import { buildGmView } from "@/lib/state";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = await requireGm(code);
    const body = await json(req);

    const target = str(body, "target", { max: 64, fallback: "all" }).trim() || "all";
    if (
      target !== "all" &&
      !get("SELECT 1 FROM characters WHERE id = ? AND game_id = ?", target, game.id)
    ) {
      throw new HttpError(404, "Няма такъв получател");
    }

    const next =
      (get<{ n: number | null }>("SELECT MAX(sort_order) AS n FROM clues WHERE game_id = ?", game.id)
        ?.n ?? 0) + 1;

    run(
      `INSERT INTO clues (id, game_id, title, body, target, released_at, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      id(),
      game.id,
      str(body, "title", { max: 160 }),
      str(body, "body"),
      target,
      next,
      Date.now(),
    );

    touchGame(game.id);
    return Response.json(buildGmView(game));
  } catch (e) {
    return errorResponse(e);
  }
}
