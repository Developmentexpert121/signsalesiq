export function buildMockupSrc(
  stored: string | null | undefined,
  opportunityId?: string
): string | null {
  if (!stored) return null;
  let p = String(stored).replace(/\\/g, "/").replace(/^\.\//, "");
  if (p.startsWith("outputs/")) p = p.slice("outputs/".length);
  while (p.startsWith("/")) p = p.slice(1);
  if (!p.includes("/") && opportunityId) p = `${opportunityId}/${p}`;
  return `/api/files/${p}`;
}
