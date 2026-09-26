/** Reading character descriptions from .txt files in the browser. */

export const MAX_DESCRIPTION = 8000;
export const MAX_FILE_BYTES = 1_000_000;

/**
 * Read a .txt as text. Files saved on Bulgarian Windows (Notepad, Word "Plain text") are often
 * UTF-16 or Windows-1251 rather than UTF-8, so detect those instead of showing mojibake.
 */
export async function readText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder("utf-16le").decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder("utf-16be").decode(bytes);
  else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1251").decode(bytes);
    }
  }
  return text.replace(/\r\n?/g, "\n").trim();
}

/**
 * "Тео.txt" → "Тео". A leading number only sets the order: "01 - Тео.txt" → "Тео". NFC because
 * macOS may hand over "й" as "и" + a combining breve.
 */
export function nameFromFile(file: File): string {
  const base = file.name.normalize("NFC").replace(/\.[^.]+$/, "").trim();
  const withoutNumber = base.replace(/^\d+\s*[.)_\-–]?\s*/, "");
  return (withoutNumber || base).slice(0, 80);
}
