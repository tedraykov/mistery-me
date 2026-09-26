export type Phase = "setup" | "lobby" | "playing" | "voting" | "revealed";

export const PHASES: Phase[] = ["setup", "lobby", "playing", "voting", "revealed"];

export interface GameRow {
  id: string;
  code: string;
  title: string;
  gm_token: string;
  phase: Phase;
  solution: string;
  intro: string;
  created_at: number;
  updated_at: number;
}

export interface CharacterRow {
  id: string;
  game_id: string;
  name: string;
  description: string;
  is_culprit: number;
  sort_order: number;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  token: string;
  character_id: string | null;
  joined_at: number;
  last_seen: number;
}

export interface ClueRow {
  id: string;
  game_id: string;
  title: string;
  body: string;
  /** "all" or a character id */
  target: string;
  released_at: number | null;
  sort_order: number;
  created_at: number;
}

export interface VoteRow {
  game_id: string;
  player_id: string;
  character_id: string;
  reason: string;
  created_at: number;
}

/** The public shape of a character — no secrets. */
export interface CharacterPublic {
  id: string;
  name: string;
  claimed: boolean;
}

/** Everything the owning player (or the GM) may read. */
export interface CharacterPrivate extends CharacterPublic {
  description: string;
}

export interface CluePublic {
  id: string;
  title: string;
  body: string;
  forMe: boolean;
  releasedAt: number;
  /** Read-aloud URL, or null when narration is off. */
  audio: string | null;
}

export interface PlayerView {
  view: "player";
  game: { code: string; title: string; phase: Phase; updatedAt: number };
  playerId: string;
  /** Empty until the game leaves setup. */
  intro: string;
  introAudio: string | null;
  me: CharacterPrivate | null;
  cast: CharacterPublic[];
  clues: CluePublic[];
  myVote: { characterId: string; reason: string } | null;
  solution: string | null;
  culpritIds: string[] | null;
  tally: { characterId: string; votes: number }[] | null;
}

export interface GmClue extends ClueRow {
  targetName: string;
  audio: string | null;
}

export interface GmView {
  view: "gm";
  game: {
    code: string;
    title: string;
    phase: Phase;
    solution: string;
    intro: string;
    updatedAt: number;
  };
  introAudio: string | null;
  tts: boolean;
  characters: (CharacterRow & { claimed: boolean })[];
  clues: GmClue[];
  playerCount: number;
  votes: { characterId: string; characterName: string; votes: number; reasons: string[] }[];
  voterCount: number;
}

export type GameView = PlayerView | GmView;
