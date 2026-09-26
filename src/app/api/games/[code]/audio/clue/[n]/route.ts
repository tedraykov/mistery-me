import { HttpError, errorResponse, requireHost } from "@/lib/auth";
import { get } from "@/lib/db";
import { victimClues } from "@/lib/format";
import { audioResponse, speech } from "@/lib/tts";

/** The victim's clue number `n` (1-based), read aloud. Only the host — the victim — hears it. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string; n: string }> }) {
  try {
    const { code, n } = await ctx.params;
    const { game } = await requireHost(code);

    const victim = get<{ description: string }>(
      "SELECT description FROM characters WHERE game_id = ? AND is_victim = 1",
      game.id,
    );
    const text = victim ? victimClues(victim.description)[Number(n) - 1] : undefined;
    if (!text) throw new HttpError(404, "Няма такава улика");

    return audioResponse(req, await speech(text));
  } catch (e) {
    return errorResponse(e);
  }
}
