import { HttpError, errorResponse, requireGm } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { applyRoleMarker, get, run, touchGame } from "@/lib/db";
import { buildGmView } from "@/lib/state";

const TEXT_FIELDS = {
  name: 80,
  description: 8000,
} as const;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const { code, id: characterId } = await ctx.params;
    const game = await requireGm(code);
    if (!get("SELECT 1 FROM characters WHERE id = ? AND game_id = ?", characterId, game.id)) {
      throw new HttpError(404, "Няма такъв герой");
    }

    const body = await json(req);
    for (const [field, max] of Object.entries(TEXT_FIELDS)) {
      if (!(field in body)) continue;
      const value = str(body, field, { max });
      if (field === "name" && !value.trim()) throw new HttpError(400, "Името е задължително");
      run(`UPDATE characters SET ${field} = ? WHERE id = ?`, value, characterId);
    }
    if ("description" in body) {
      applyRoleMarker(characterId, str(body, "description", { max: TEXT_FIELDS.description }));
    }
    if ("sortOrder" in body && typeof body.sortOrder === "number") {
      run("UPDATE characters SET sort_order = ? WHERE id = ?", body.sortOrder, characterId);
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
    const { code, id: characterId } = await ctx.params;
    const game = await requireGm(code);
    run("DELETE FROM characters WHERE id = ? AND game_id = ?", characterId, game.id);
    touchGame(game.id);
    return Response.json(buildGmView(game));
  } catch (e) {
    return errorResponse(e);
  }
}
