import { HttpError, errorResponse, requireGm } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { get, run, touchGame } from "@/lib/db";
import { buildGmView } from "@/lib/state";
import { clueSpeech, warm } from "@/lib/tts";
import type { ClueRow } from "@/lib/types";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const { code, id: clueId } = await ctx.params;
    const game = await requireGm(code);
    if (!get("SELECT 1 FROM clues WHERE id = ? AND game_id = ?", clueId, game.id)) {
      throw new HttpError(404, "Няма такава улика");
    }

    const body = await json(req);
    if ("title" in body) run("UPDATE clues SET title = ? WHERE id = ?", str(body, "title", { max: 160 }), clueId);
    if ("body" in body) run("UPDATE clues SET body = ? WHERE id = ?", str(body, "body"), clueId);
    if ("target" in body) {
      const target = str(body, "target", { max: 64, fallback: "all" }).trim() || "all";
      if (
        target !== "all" &&
        !get("SELECT 1 FROM characters WHERE id = ? AND game_id = ?", target, game.id)
      ) {
        throw new HttpError(404, "Няма такъв получател");
      }
      run("UPDATE clues SET target = ? WHERE id = ?", target, clueId);
    }
    if ("released" in body) {
      run(
        "UPDATE clues SET released_at = ? WHERE id = ?",
        body.released ? Date.now() : null,
        clueId,
      );
      // Synthesize now so players' play buttons respond instantly.
      const clue = get<ClueRow>("SELECT * FROM clues WHERE id = ?", clueId);
      if (body.released && clue) warm(clueSpeech(clue));
    }

    touchGame(game.id);
    return Response.json(buildGmView(game));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const { code, id: clueId } = await ctx.params;
    const game = await requireGm(code);
    run("DELETE FROM clues WHERE id = ? AND game_id = ?", clueId, game.id);
    touchGame(game.id);
    return Response.json(buildGmView(game));
  } catch (e) {
    return errorResponse(e);
  }
}
