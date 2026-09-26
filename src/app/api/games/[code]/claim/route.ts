import { HttpError, currentPlayer, errorResponse, findGame } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { get, run, touchGame } from "@/lib/db";
import { buildPlayerView } from "@/lib/state";
import type { CharacterRow } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = findGame(code);
    if (!game) throw new HttpError(404, "Играта не е намерена");

    const player = await currentPlayer(game);
    if (!player) throw new HttpError(401, "Не сте в тази игра");

    const body = await json(req);
    const characterId = str(body, "characterId", { max: 64 }).trim();

    if (!characterId) {
      // Release the current role.
      run("UPDATE players SET character_id = NULL WHERE id = ?", player.id);
      touchGame(game.id);
      const fresh = { ...player, character_id: null };
      return Response.json(buildPlayerView(game, fresh));
    }

    const character = get<CharacterRow>(
      "SELECT * FROM characters WHERE id = ? AND game_id = ?",
      characterId,
      game.id,
    );
    if (!character) throw new HttpError(404, "Няма такъв герой");

    const takenBy = get<{ id: string }>(
      "SELECT id FROM players WHERE character_id = ?",
      characterId,
    );
    if (takenBy && takenBy.id !== player.id) {
      throw new HttpError(409, `„${character.name}“ вече е зает от друг играч`);
    }

    run("UPDATE players SET character_id = ? WHERE id = ?", characterId, player.id);
    touchGame(game.id);
    return Response.json(buildPlayerView(game, { ...player, character_id: characterId }));
  } catch (e) {
    return errorResponse(e);
  }
}
