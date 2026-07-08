/** Text utilities shared by parsing, chunking, search and similarity. */

const STOPWORDS = new Set(
  `a an and are as at be but by for from has have if in into is it its of on or
   our so than that the their there these they this to was we were what when
   where which while will with you your not no do does did about after before
   can could should would may might each per via de la el los`.split(/\s+/),
);

export function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Unique meaningful words — used for tag suggestion and similarity. */
export function keywordSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

/** Word n-gram shingles for near-duplicate content detection. */
export function shingles(text: string, size = 4, maxTokens = 1200): Set<string> {
  const tokens = tokenize(text).slice(0, maxTokens);
  const result = new Set<string>();
  for (let i = 0; i + size <= tokens.length; i += 1) {
    result.add(tokens.slice(i, i + size).join(" "));
  }
  return result;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Rough token estimate (~4 chars per token) for budgeting AI context. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Excerpt around the first occurrence of any query token. */
export function snippetAround(text: string, query: string, radius = 140): string {
  const clean = normalizeWhitespace(text);
  const tokens = tokenize(query);
  const lower = clean.toLowerCase();
  let index = -1;
  for (const token of tokens) {
    index = lower.indexOf(token);
    if (index >= 0) break;
  }
  if (index < 0) return truncate(clean, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(clean.length, index + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
