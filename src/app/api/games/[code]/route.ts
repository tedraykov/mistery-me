import { HttpError, errorResponse, requireGm } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { get, run } from "@/lib/db";
import { victimClues } from "@/lib/format";
import { buildGmView } from "@/lib/state";
import { warm } from "@/lib/tts";
import { PHASES, type Phase } from "@/lib/types";

/** Synthesize the victim's next clue ahead of time, so its play button responds instantly. */
function warmClue(gameId: string, index: number): void {
  const victim = get<{ description: string }>(
    "SELECT description FROM characters WHERE game_id = ? AND is_victim = 1",
    gameId,
  );
  const text = victim && victimClues(victim.description)[index];
  if (text) warm(text);
}

/**
 * GM-only: rename the game, move it between phases, write the intro story / solution, and drive
 * the victim's clue timer.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const game = await requireGm(code);
    const body = await json(req);

    if ("title" in body) {
      const title = str(body, "title", { max: 120 }).trim();
      if (!title) throw new HttpError(400, "Заглавието не може да е празно");
      run("UPDATE games SET title = ? WHERE id = ?", title, game.id);
    }

    if ("phase" in body) {
      const phase = str(body, "phase", { max: 20 }) as Phase;
      if (!PHASES.includes(phase)) throw new HttpError(400, "Невалидна фаза");
      run("UPDATE games SET phase = ? WHERE id = ?", phase, game.id);
      // The clue timer starts the first time the game is played, and keeps its place after that.
      if (phase === "playing" && game.clue_round_started_at === null) {
        run("UPDATE games SET clue_round_started_at = ? WHERE id = ?", Date.now(), game.id);
        warmClue(game.id, game.clues_read);
      }
    }

    if (body.clueRead === true) {
      // The victim read the next clue (on time or early): count it and start a new round.
      if (game.phase !== "playing") throw new HttpError(409, "Играта не е в ход");
      run(
        "UPDATE games SET clues_read = clues_read + 1, clue_round_started_at = ? WHERE id = ?",
        Date.now(),
        game.id,
      );
      warmClue(game.id, game.clues_read + 1);
    }

    if (body.resetClues === true) {
      run(
        "UPDATE games SET clues_read = 0, clue_round_started_at = ? WHERE id = ?",
        game.phase === "playing" ? Date.now() : null,
        game.id,
      );
    }

    if ("intro" in body) {
      // ElevenLabs' multilingual model reads at most 10k characters per request.
      run("UPDATE games SET intro = ? WHERE id = ?", str(body, "intro", { max: 10000 }), game.id);
    }

    if ("solution" in body) {
      run("UPDATE games SET solution = ? WHERE id = ?", str(body, "solution"), game.id);
    }

    run("UPDATE games SET updated_at = ? WHERE id = ?", Date.now(), game.id);
    const fresh = await requireGm(code);
    return Response.json(buildGmView(fresh));
  } catch (e) {
    return errorResponse(e);
  }
}
