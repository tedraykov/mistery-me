import { randomBytes, randomUUID } from "node:crypto";

/** No I, O, 0, 1 — unambiguous when read aloud or typed on a phone. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const id = () => randomUUID();

export const token = () => randomBytes(24).toString("base64url");

export function gameCode(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
