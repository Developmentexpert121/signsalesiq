export const MAX_FIELD_LEN = 200;

export function sanitize(s: string): string {
  return s
    .slice(0, MAX_FIELD_LEN)
    .replace(/[<>{}`\\]/g, "")
    .trim();
}
