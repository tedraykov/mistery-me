import { HttpError, errorResponse, requireGm } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { run } from "@/lib/db";
import { buildGmView } from "@/lib/state";
import { PHASES, type Phase } from "@/lib/types";

/** GM-only: rename the game, move it between phases, or write the intro story / solution. */
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
