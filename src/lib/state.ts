import { isHost } from "./auth";
import { all, get } from "./db";
import { CLUE_INTERVAL_MS, victimClues } from "./format";
import { audioUrl, ttsEnabled } from "./tts";
import type {
  CharacterRow,
  ClueTimer,
  GameRow,
  HostView,
  PlayerRow,
  PlayerView,
  SetupView,
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

  const vote = get<VoteRow>(
    "SELECT * FROM votes WHERE game_id = ? AND player_id = ?",
    game.id,
    player.id,
  );

  const intro = game.phase === "setup" ? "" : game.intro;

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
    intro,
    introAudio: audioUrl(`/api/games/${game.code}/audio/intro`, intro),
    me: mine && {
      id: mine.id,
      name: mine.name,
      claimed: true,
      isVictim: mine.is_victim === 1,
      description: mine.description,
    },
    cast: cast.map((c) => ({
      id: c.id,
      name: c.name,
      claimed: claimed.has(c.id),
      isVictim: c.is_victim === 1,
    })),
    myVote: vote ? { characterId: vote.character_id, reason: vote.reason } : null,
    solution: revealed ? game.solution : null,
    culpritIds: revealed ? cast.filter((c) => c.is_culprit === 1).map((c) => c.id) : null,
    tally,
  };
}

/** Route that reads the victim's clue number `n` (1-based) aloud. */
export const clueAudioRoute = (code: string, n: number) => `/api/games/${code}/audio/clue/${n}`;

function clueTimer(game: GameRow, cast: CharacterRow[]): ClueTimer | null {
  const victim = cast.find((c) => c.is_victim === 1);
  if (!victim || game.phase !== "playing" || game.clue_round_started_at === null) return null;

  const clues = victimClues(victim.description);
  const nextIndex = game.clues_read;
  const nextText = clues[nextIndex];
  return {
    roundStartedAt: game.clue_round_started_at,
    serverNow: Date.now(),
    intervalMs: CLUE_INTERVAL_MS,
    cluesRead: game.clues_read,
    total: clues.length,
    next:
      nextText === undefined
        ? null
        : {
            number: nextIndex + 1,
            text: nextText,
            audio: audioUrl(clueAudioRoute(game.code, nextIndex + 1), nextText),
          },
  };
}

export function buildHostView(game: GameRow): HostView {
  const cast = characters(game.id);
  const claimed = claimedIds(game.id);
  const byId = new Map(cast.map((c) => [c.id, c]));

  const voteRows = all<VoteRow>("SELECT * FROM votes WHERE game_id = ?", game.id);
  const grouped = new Map<string, { votes: number; reasons: string[] }>();
  for (const v of voteRows) {
    const entry = grouped.get(v.character_id) ?? { votes: 0, reasons: [] };
    entry.votes += 1;
    if (v.reason.trim()) entry.reasons.push(v.reason.trim());
    grouped.set(v.character_id, entry);
  }

  return {
    view: "host",
    game: {
      code: game.code,
      title: game.title,
      phase: game.phase,
      solution: game.solution,
      intro: game.intro,
      cluesRead: game.clues_read,
      updatedAt: game.updated_at,
    },
    introAudio: audioUrl(`/api/games/${game.code}/audio/intro`, game.intro),
    tts: ttsEnabled(),
    characters: cast.map((c) => ({ ...c, claimed: claimed.has(c.id) })),
    timer: clueTimer(game, cast),
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

/** The creator's view: names only. Descriptions and the killer stay hidden — they may be playing. */
export function buildSetupView(game: GameRow): SetupView {
  const cast = characters(game.id);
  const claimed = claimedIds(game.id);
  const victim = cast.find((c) => c.is_victim === 1);
  return {
    view: "setup",
    game: {
      code: game.code,
      title: game.title,
      phase: game.phase,
      intro: game.intro,
      updatedAt: game.updated_at,
    },
    introAudio: audioUrl(`/api/games/${game.code}/audio/intro`, game.intro),
    tts: ttsEnabled(),
    characters: cast.map((c) => ({
      id: c.id,
      name: c.name,
      claimed: claimed.has(c.id),
      isVictim: c.is_victim === 1,
      empty: !c.description.trim(),
    })),
    victimCount: cast.filter((c) => c.is_victim === 1).length,
    culpritCount: cast.filter((c) => c.is_culprit === 1).length,
    hasSolution: game.solution.trim() !== "",
    playerCount: (
      get<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE game_id = ?", game.id) ?? {
        n: 0,
      }
    ).n,
    hostName: victim && claimed.has(victim.id) ? victim.name : null,
  };
}

/** A player's view — or the host's, if that player holds the victim's role. */
export function viewForPlayer(game: GameRow, player: PlayerRow): PlayerView | HostView {
  return isHost(game, player) ? buildHostView(game) : buildPlayerView(game, player);
}

/** What a creator or host sees after they change something. */
export function editorView(game: GameRow, actor: "creator" | "host"): SetupView | HostView {
  return actor === "creator" ? buildSetupView(game) : buildHostView(game);
}
