/** UUID v4 — available in Node 18+ and all modern browsers. */
export function newId(): string {
  return crypto.randomUUID();
}
