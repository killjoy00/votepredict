/**
 * Issue #864: offline planning ONLY for multiple historical versions of one campaign page.
 * This is deliberately not wired into the v3 production backfill or its workflow.
 * A selected snapshot is a fetch candidate, not an independently authenticated statement.
 */
import type { WaybackCapture } from './wayback';

export const WAYBACK_CAMPAIGN_VERSION_PLAN = 'wayback-campaign-version-plan-v1' as const;

function pagePriority(value: string): number {
  let path: string;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return -1;
    path = u.pathname.toLowerCase();
  } catch { return -1; }
  if (path.startsWith('/cdn-cgi/') || /\.(?:css|js|mjs|xml|json|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/.test(path)) return -1;
  if (/issue|platform|policy|priorit|legislat|position|pledge/.test(path)) return 100;
  if (path === '/' || path === '') return 90;
  if (/news|press|media|update|blog/.test(path)) return 80;
  if (/endorse|questionnaire|scorecard/.test(path)) return 70;
  if (/about|bio/.test(path)) return 60;
  return 20;
}
function eligible(c: WaybackCapture): boolean {
  return c.statuscode === '200'
    && ['text/html', 'text/plain', 'application/xhtml+xml'].includes(c.mimetype.toLowerCase())
    && /^\d{14}$/.test(c.timestamp)
    && pagePriority(c.original) >= 0;
}
interface VersionGroup {
  originalUrl: string;
  captureYear: string;
  pagePriority: number;
  versions: WaybackCapture[];
}
export interface WaybackCampaignVersionGroupReport {
  originalUrl: string;
  captureYear: string;
  distinctVersionCandidates: number;
  selectedVersionCandidates: number;
  unselectedDueToCap: number;
}
export interface WaybackCampaignVersionPlan {
  version: typeof WAYBACK_CAMPAIGN_VERSION_PLAN;
  maxCaptures: number;
  discoveredRecords: number;
  eligibleRecords: number;
  discardedNonPageRecords: number;
  duplicateDigestCapturesCollapsed: number;
  missingDigestCaptures: number;
  distinctVersionCandidates: number;
  selectedCaptures: WaybackCapture[];
  unselectedDistinctVersions: number;
  groups: WaybackCampaignVersionGroupReport[];
  completenessCertified: false;
}

/**
 * For an already-acquired CDX manifest, keep distinct digest versions for a URL/year,
 * preferring the EARLIEST capture attesting each digest rather than the later one
 * chosen by v3. Distribute scarce slots one URL/year at a time before taking
 * additional versions, prioritizing issue/platform URLs. Record every cap loss.
 *
 * Does not widen upstream CDX caps, discover other domains, retrieve bytes, or
 * guarantee original post time. Do not backdate evidence before the capture.
 */
export function planWaybackCampaignVersionCaptures(
  captures: readonly WaybackCapture[],
  options: { maxCaptures?: number } = {},
): WaybackCampaignVersionPlan {
  const maxCaptures = Math.max(1, Math.min(50, Math.trunc(options.maxCaptures ?? 40) || 40));
  const groups = new Map<string, VersionGroup>();
  let eligibleRecords = 0;
  let duplicateDigestCapturesCollapsed = 0;
  let missingDigestCaptures = 0;

  const sorted = [...captures].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp) || a.original.localeCompare(b.original) || a.archiveUrl.localeCompare(b.archiveUrl));
  const digestKeys = new Set<string>();
  for (const c of sorted) {
    if (!eligible(c)) continue;
    eligibleRecords += 1;
    const year = c.timestamp.slice(0, 4);
    const groupKey = c.original + '\u0000' + year;
    let group = groups.get(groupKey);
    if (!group) {
      group = { originalUrl: c.original, captureYear: year, pagePriority: pagePriority(c.original), versions: [] };
      groups.set(groupKey, group);
    }
    // Missing CDX digest cannot establish equality. Keep separately as unknown versions.
    const digest = c.digest.trim();
    if (!digest) missingDigestCaptures += 1;
    const uniqueVersionKey = groupKey + '\u0000' + (digest || ('unknown:' + c.timestamp));
    if (digestKeys.has(uniqueVersionKey)) {
      duplicateDigestCapturesCollapsed += 1;
      continue;
    }
    digestKeys.add(uniqueVersionKey);
    group.versions.push(c);
  }

  const sortedGroups = [...groups.values()].sort((a, b) =>
    b.pagePriority - a.pagePriority || a.originalUrl.localeCompare(b.originalUrl) || a.captureYear.localeCompare(b.captureYear));
  const chosen: WaybackCapture[] = [];
  const counts = new Map<VersionGroup, number>();
  // Fair and bounded: one version of each URL/year before second versions of any.
  for (let index = 0; chosen.length < maxCaptures; index += 1) {
    let added = false;
    for (const group of sortedGroups) {
      if (chosen.length >= maxCaptures) break;
      const version = group.versions[index];
      if (!version) continue;
      chosen.push(version);
      counts.set(group, (counts.get(group) ?? 0) + 1);
      added = true;
    }
    if (!added) break;
  }
  const distinctVersionCandidates = sortedGroups.reduce((n, group) => n + group.versions.length, 0);
  return {
    version: WAYBACK_CAMPAIGN_VERSION_PLAN,
    maxCaptures, discoveredRecords: captures.length, eligibleRecords,
    discardedNonPageRecords: captures.length - eligibleRecords,
    duplicateDigestCapturesCollapsed, missingDigestCaptures, distinctVersionCandidates,
    selectedCaptures: chosen.sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp) || a.original.localeCompare(b.original)),
    unselectedDistinctVersions: distinctVersionCandidates - chosen.length,
    groups: sortedGroups.map(group => ({
      originalUrl: group.originalUrl, captureYear: group.captureYear,
      distinctVersionCandidates: group.versions.length,
      selectedVersionCandidates: counts.get(group) ?? 0,
      unselectedDueToCap: group.versions.length - (counts.get(group) ?? 0),
    })),
    completenessCertified: false,
  };
}
