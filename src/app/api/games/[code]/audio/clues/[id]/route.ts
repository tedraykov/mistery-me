import { HttpError, currentPlayer, errorResponse, findGame, isGm } from "@/lib/auth";
import { get } from "@/lib/db";
import { audioResponse, clueSpeech, speech } from "@/lib/tts";
import type { ClueRow } from "@/lib/types";

/** A clue, read aloud. Players only hear released clues addressed to everyone or to them. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string; id: string }> }) {
  try {
    const { code, id: clueId } = await ctx.params;
    const game = findGame(code);
    if (!game) throw new HttpError(404, "Играта не е намерена");

    const clue = get<ClueRow>("SELECT * FROM clues WHERE id = ? AND game_id = ?", clueId, game.id);
    if (!clue) throw new HttpError(404, "Няма такава улика");

    if (!(await isGm(game))) {
      const player = await currentPlayer(game);
      if (!player) throw new HttpError(401, "Не сте в тази игра");
      const visible =
        clue.released_at !== null && (clue.target === "all" || clue.target === player.character_id);
      if (!visible) throw new HttpError(404, "Няма такава улика");
    }

    const text = clueSpeech(clue);
    if (!text) throw new HttpError(404, "Уликата е празна");
    return audioResponse(req, await speech(text));
  } catch (e) {
    return errorResponse(e);
  }
}
