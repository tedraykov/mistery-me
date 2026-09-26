import { all, get } from "./db";
import type {
  CharacterRow,
  ClueRow,
  GameRow,
  GmClue,
  GmView,
  PlayerRow,
  PlayerView,
  VoteRow,
} from "./types";

function characters(gameId: string): CharacterRow[] {
  return all<CharacterRow>(
    "SELECT * FROM characters WHERE game_id = ? ORDER BY sort_order, name",
    gameId,
  );
}

function claimedIds(gameId: string): Set<string> {
  const rows = all<{ character_id: string }>(
    "SELECT character_id FROM players WHERE game_id = ? AND character_id IS NOT NULL",
    gameId,
  );
  return new Set(rows.map((r) => r.character_id));
}

export function buildPlayerView(game: GameRow, player: PlayerRow): PlayerView {
  const cast = characters(game.id);
  const claimed = claimedIds(game.id);
  const revealed = game.phase === "revealed";

  const mine = cast.find((c) => c.id === player.character_id) ?? null;

  const clues = all<ClueRow>(
    "SELECT * FROM clues WHERE game_id = ? AND released_at IS NOT NULL ORDER BY released_at",
    game.id,
  )
    .filter((c) => c.target === "all" || c.target === player.character_id)
    .map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      forMe: c.target !== "all",
      releasedAt: c.released_at!,
    }));

  const vote = get<VoteRow>(
    "SELECT * FROM votes WHERE game_id = ? AND player_id = ?",
    game.id,
    player.id,
  );

  const tally = revealed
    ? all<{ character_id: string; n: number }>(
        "SELECT character_id, COUNT(*) AS n FROM votes WHERE game_id = ? GROUP BY character_id ORDER BY n DESC",
        game.id,
      ).map((r) => ({ characterId: r.character_id, votes: r.n }))
    : null;

  return {
    view: "player",
    game: {
      code: game.code,
      title: game.title,
      phase: game.phase,
      updatedAt: game.updated_at,
    },
    playerId: player.id,
    me: mine && {
      id: mine.id,
      emoji: mine.emoji,
      name: mine.name,
      role: mine.role,
      pair: mine.pair,
      claimed: true,
      about: mine.about,
      secret: mine.secret,
      knows: mine.knows,
      goal: mine.goal,
      important: mine.important,
    },
    cast: cast.map((c) => ({
      id: c.id,
      emoji: c.emoji,
      name: c.name,
      role: c.role,
      pair: c.pair,
      claimed: claimed.has(c.id),
    })),
    clues,
    myVote: vote ? { characterId: vote.character_id, reason: vote.reason } : null,
    solution: revealed ? game.solution : null,
    culpritIds: revealed ? cast.filter((c) => c.is_culprit === 1).map((c) => c.id) : null,
    tally,
  };
}

export function buildGmView(game: GameRow): GmView {
  const cast = characters(game.id);
  const claimed = claimedIds(game.id);
  const byId = new Map(cast.map((c) => [c.id, c]));

  const clues: GmClue[] = all<ClueRow>(
    "SELECT * FROM clues WHERE game_id = ? ORDER BY sort_order, created_at",
    game.id,
  ).map((c) => ({
    ...c,
    targetName: c.target === "all" ? "Всички" : (byId.get(c.target)?.name ?? "—"),
  }));

  const voteRows = all<VoteRow>("SELECT * FROM votes WHERE game_id = ?", game.id);
  const grouped = new Map<string, { votes: number; reasons: string[] }>();
  for (const v of voteRows) {
    const entry = grouped.get(v.character_id) ?? { votes: 0, reasons: [] };
    entry.votes += 1;
    if (v.reason.trim()) entry.reasons.push(v.reason.trim());
    grouped.set(v.character_id, entry);
  }

  return {
    view: "gm",
    game: {
      code: game.code,
      title: game.title,
      phase: game.phase,
      solution: game.solution,
      updatedAt: game.updated_at,
    },
    characters: cast.map((c) => ({ ...c, claimed: claimed.has(c.id) })),
    clues,
    playerCount: (
      get<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE game_id = ?", game.id) ?? {
        n: 0,
      }
    ).n,
    votes: [...grouped.entries()]
      .map(([characterId, v]) => ({
        characterId,
        characterName: byId.get(characterId)?.name ?? "—",
        votes: v.votes,
        reasons: v.reasons,
      }))
      .sort((a, b) => b.votes - a.votes),
    voterCount: voteRows.length,
  };
}
