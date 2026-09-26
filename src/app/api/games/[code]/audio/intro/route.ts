import { HttpError, currentPlayer, errorResponse, findGame, isGm } from "@/lib/auth";
import { audioResponse, speech } from "@/lib/tts";

/** The introduction story, read aloud. Players can hear it once the game leaves setup. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = findGame(code);
    if (!game) throw new HttpError(404, "Играта не е намерена");

    if (!(await isGm(game))) {
      if (!(await currentPlayer(game))) throw new HttpError(401, "Не сте в тази игра");
      if (game.phase === "setup") throw new HttpError(403, "Историята още не е готова");
    }
    if (!game.intro.trim()) throw new HttpError(404, "Няма увод");

    return audioResponse(req, await speech(game.intro));
  } catch (e) {
    return errorResponse(e);
  }
}
