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
  clue_round_started_at: number | null;
  clues_read: number;
  created_at: number;
  updated_at: number;
}

export interface CharacterRow {
  id: string;
  game_id: string;
  name: string;
  description: string;
  is_culprit: number;
  is_victim: number;
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
  /** The murdered character, played by the game master — nobody can pick it. */
  isVictim: boolean;
}

/** Everything the owning player (or the GM) may read. */
export interface CharacterPrivate extends CharacterPublic {
  description: string;
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
  myVote: { characterId: string; reason: string } | null;
  solution: string | null;
  culpritIds: string[] | null;
  tally: { characterId: string; votes: number }[] | null;
}

/** The victim's clue reminder. Only ever sent to the game master. */
export interface ClueTimer {
  /** Server time the current round started; compare against `serverNow`, not the local clock. */
  roundStartedAt: number;
  serverNow: number;
  intervalMs: number;
  cluesRead: number;
  /** Clues found in the victim's description (paragraphs starting with "Улика"). */
  total: number;
  next: { number: number; text: string; audio: string | null } | null;
}

export interface GmView {
  view: "gm";
  game: {
    code: string;
    title: string;
    phase: Phase;
    solution: string;
    intro: string;
    cluesRead: number;
    updatedAt: number;
  };
  introAudio: string | null;
  tts: boolean;
  characters: (CharacterRow & { claimed: boolean })[];
  /** Present while the game is being played and a victim exists. */
  timer: ClueTimer | null;
  playerCount: number;
  votes: { characterId: string; characterName: string; votes: number; reasons: string[] }[];
  voterCount: number;
}

export type GameView = PlayerView | GmView;
