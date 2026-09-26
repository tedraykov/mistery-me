import { errorResponse, setGmCookie } from "@/lib/auth";
import { json, str } from "@/lib/body";
import { get, run } from "@/lib/db";
import { gameCode, id, token } from "@/lib/ids";

export async function POST(req: Request) {
  try {
    const body = await json(req);
    const title = str(body, "title", { max: 120 }).trim() || "Мистерия без име";

    let code = gameCode();
    for (let i = 0; i < 10 && get("SELECT 1 FROM games WHERE code = ?", code); i++) {
      code = gameCode();
    }

    const gmToken = token();
    const now = Date.now();
    run(
      `INSERT INTO games (id, code, title, gm_token, phase, solution, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'setup', '', ?, ?)`,
      id(),
      code,
      title,
      gmToken,
      now,
      now,
    );

    await setGmCookie(code, gmToken);
    return Response.json({ code });
  } catch (e) {
    return errorResponse(e);
  }
}
