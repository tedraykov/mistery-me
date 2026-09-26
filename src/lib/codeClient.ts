/** Browser-side mirror of normalizeCode — keeps the input field in the code alphabet. */
export function normalizeCodeClient(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
