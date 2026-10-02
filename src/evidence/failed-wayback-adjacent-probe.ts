export const FAILED_WAYBACK_ADJACENT_PROBE_VERSION =
  'failed-wayback-adjacent-probe-v1' as const;

export function parseFailedWaybackMemberNames(
  failureSamples: unknown,
  maxMembers = 4,
): string[] {
  if (!Number.isInteger(maxMembers) || maxMembers < 1 || maxMembers > 8) {
    throw new Error('Invalid failed-Wayback member limit');
  }
  if (!Array.isArray(failureSamples)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const sample of failureSamples) {
    if (typeof sample !== 'string') continue;
    const match = /^([^:\n]{1,120}):\s+(?:snapshot|discovery):\s+/i.exec(sample);
    if (!match) continue;
    const name = match[1].trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= maxMembers) break;
  }
  return names;
}
