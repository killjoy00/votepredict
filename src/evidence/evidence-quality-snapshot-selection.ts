const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export function parseEvidenceQualitySnapshotSourceIds(
  raw: string | null | undefined,
): string[] {
  if (!raw?.trim()) return [];
  return [...new Set((raw.match(UUID_PATTERN) ?? []).map((value) => value.toLowerCase()))]
    .sort((a, b) => a.localeCompare(b));
}
