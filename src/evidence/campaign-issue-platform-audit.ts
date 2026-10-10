/**
 * #864: Pure, offline Minnesota Senate campaign-platform completeness audit.
 * Counts only attested archive snapshots; page/post dates are never availability proof.
 */
import { createHash } from 'node:crypto';
import { ISSUE_POSITION_FAMILIES } from './issue-position-extractor.js';

export const CAMPAIGN_PLATFORM_AUDIT_VERSION = 'senate-campaign-platform-audit-v1' as const;
export const AUDIT_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
export type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';
export type SiteStatus = 'documented' | 'unavailable' | 'unverified';

export interface CampaignMembership {
  membershipId: string;
  senatorName: string;
  sessionSlug: SessionSlug;
}
export interface CampaignSiteRecord {
  membershipId: string;
  campaignYear: number | null;
  url: string;
  status: SiteStatus;
  registrySourceUrl: string | null;
}
export interface CampaignArchiveCapture {
  membershipId: string;
  campaignYear: number | null;
  originalUrl: string;
  archiveUrl: string;
  capturedAt: string;
  archiveDigest: string | null;
  selectedByV3: boolean;
  snapshotStatus: 'fetched' | 'failed' | 'not_selected';
  contentSha256: string | null;
  pageText: string | null;
  pageTextSha256: string | null;
  pageType: 'issue' | 'platform' | 'policy' | 'other' | 'unknown';
  originalPostedOn: string | null;
}
export interface CampaignIssueStatement {
  membershipId: string;
  archiveUrl: string;
  policyFamily: string;
  excerpt: string;
  attribution: 'candidate' | 'third_party' | 'ambiguous';
  stance: 'supports' | 'opposes' | 'unclear';
}
export interface ArchiveDiscoveryRun {
  membershipId: string;
  seedUrl: string;
  requestedLimit: number;
  returnedCount: number;
  status: 'complete' | 'failed';
}
export interface CampaignAuditInputs {
  roster: CampaignMembership[];
  sites: CampaignSiteRecord[];
  captures: CampaignArchiveCapture[];
  statements: CampaignIssueStatement[];
  discoveries?: ArchiveDiscoveryRun[];
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
function canonicalText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
function isHash(value: string | null): boolean {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function urlOk(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}
function campaignHost(value: string): string | null {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return null; }
}
function timeMs(value: string): number | null {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19) ? parsed : null;
}
function archiveIdentityValid(c: CampaignArchiveCapture): boolean {
  if (!urlOk(c.originalUrl)) return false;
  const match = /^https:\/\/web\.archive\.org\/web\/(\d{14})id_\/(https?:\/\/.+)$/.exec(c.archiveUrl);
  if (!match || match[2] !== c.originalUrl) return false;
  const time = timeMs(c.capturedAt);
  if (time === null) return false;
  const timestamp = new Date(time).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return timestamp === match[1];
}
function verifiedPageText(c: CampaignArchiveCapture): boolean {
  return archiveIdentityValid(c)
    && c.snapshotStatus === 'fetched'
    && isHash(c.contentSha256)
    && isHash(c.pageTextSha256)
    && typeof c.pageText === 'string'
    && sha256(c.pageText) === c.pageTextSha256;
}
function byMember<T extends { membershipId: string }>(records: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const group = map.get(record.membershipId) ?? [];
    group.push(record);
    map.set(record.membershipId, group);
  }
  return map;
}
function inHistoricalScope(capturedAt: string): boolean {
  const time = timeMs(capturedAt);
  return time !== null && time < Date.UTC(2026, 0, 1);
}
function sessionYears(session: SessionSlug): number[] {
  if (session === '2021-2022') return [2021, 2022];
  if (session === '2023-2024') return [2023, 2024];
  if (session === '2025-2026') return [2025];
  throw new Error('Unsupported Senate session: ' + session);
}

export function auditSenateCampaignIssuePlatforms(input: CampaignAuditInputs) {
  const ids = new Set<string>();
  for (const member of input.roster) {
    if (!member.membershipId?.trim() || !member.senatorName?.trim()) throw new Error('Roster identity and name are required');
    sessionYears(member.sessionSlug);
    if (ids.has(member.membershipId)) throw new Error('Duplicate membership: ' + member.membershipId);
    ids.add(member.membershipId);
  }
  for (const [name, rows] of [
    ['sites', input.sites], ['captures', input.captures],
    ['statements', input.statements], ['discoveries', input.discoveries ?? []],
  ] as const) {
    for (const row of rows) if (!ids.has(row.membershipId)) throw new Error('Unrecognized membership in ' + name + ': ' + row.membershipId);
  }
  const sitesByMember = byMember(input.sites);
  const capturesByMember = byMember(input.captures);
  const statementsByMember = byMember(input.statements);
  const discoveriesByMember = byMember(input.discoveries ?? []);
  const taxonomy = new Set<string>(ISSUE_POSITION_FAMILIES);

  const memberships = [...input.roster].sort((a, b) => a.sessionSlug.localeCompare(b.sessionSlug)
    || a.senatorName.localeCompare(b.senatorName) || a.membershipId.localeCompare(b.membershipId)).map(member => {
    const sites = sitesByMember.get(member.membershipId) ?? [];
    const captures = capturesByMember.get(member.membershipId) ?? [];
    const statements = statementsByMember.get(member.membershipId) ?? [];
    const discoveries = discoveriesByMember.get(member.membershipId) ?? [];
    const validCaptures = captures.filter(c => archiveIdentityValid(c) && inHistoricalScope(c.capturedAt));
    const fetched = validCaptures.filter(c => verifiedPageText(c));
    const capturedPages = fetched.filter(c => c.pageType === 'issue' || c.pageType === 'platform' || c.pageType === 'policy');
    const versionGroups = new Map<string, CampaignArchiveCapture[]>();
    for (const capture of validCaptures) {
      const groupKey = capture.originalUrl + '|' + capture.capturedAt.slice(0, 4);
      const rows = versionGroups.get(groupKey) ?? [];
      rows.push(capture);
      versionGroups.set(groupKey, rows);
    }
    const versionGaps = [...versionGroups.entries()].flatMap(([key, rows]) => {
      const versions = new Set(rows.map(row => row.archiveDigest).filter(Boolean));
      const selected = new Set(rows.filter(row => row.selectedByV3).map(row => row.archiveDigest).filter(Boolean));
      return versions.size > 1 && [...versions].some(digest => !selected.has(digest))
        ? [{ urlYear: key, distinctDigests: versions.size, v3SelectedDigests: selected.size }] : [];
    }).sort((a, b) => a.urlYear.localeCompare(b.urlYear));

    const auditedStatements = statements.map(statement => {
      const capture = captures.find(c => c.archiveUrl === statement.archiveUrl);
      const issueKnown = taxonomy.has(statement.policyFamily);
      const documentedCampaignHost = Boolean(capture && sites.some(site =>
        site.status === 'documented' && site.campaignYear === capture.campaignYear
        && urlOk(site.registrySourceUrl ?? '') && campaignHost(site.url) === campaignHost(capture.originalUrl)));
      const matchable = statement.attribution === 'candidate' && documentedCampaignHost
        && issueKnown && statement.excerpt.trim().length > 0;
      const canonicalExcerpt = canonicalText(statement.excerpt);
      const matchingSnapshots = matchable && capture
        ? fetched.filter(c => c.originalUrl === capture.originalUrl
            && c.campaignYear === capture.campaignYear
            && canonicalText(c.pageText ?? '').includes(canonicalExcerpt))
        : [];
      const publicBy = matchingSnapshots.map(c => c.capturedAt).sort()[0] ?? null;
      return {
        archiveUrl: statement.archiveUrl,
        policyFamily: statement.policyFamily,
        attribution: statement.attribution,
        stance: statement.stance,
        excerptSha256: sha256(statement.excerpt),
        originalPostedOn: capture?.originalPostedOn ?? null,
        earliestProvenPublicBy: publicBy,
        proofStatus: publicBy === null ? 'unverified' as const : 'archive_text_verified' as const,
      };
    }).sort((a, b) => a.archiveUrl.localeCompare(b.archiveUrl)
      || a.policyFamily.localeCompare(b.policyFamily) || a.excerptSha256.localeCompare(b.excerptSha256));

    const gapCodes: string[] = [];
    if (!sites.length) gapCodes.push('NO_CAMPAIGN_URL_INVENTORY');
    if (sites.some(site => site.status !== 'documented' || !urlOk(site.url) || !urlOk(site.registrySourceUrl ?? ''))) gapCodes.push('SITE_PROVENANCE_UNVERIFIED');
    if (sites.some(site => site.campaignYear === null) || captures.some(c => c.campaignYear === null)) gapCodes.push('CAMPAIGN_YEAR_UNKNOWN');
    if (!validCaptures.length) gapCodes.push('NO_VERIFIABLE_ARCHIVE_CAPTURE');
    if (!capturedPages.length) gapCodes.push('NO_VERIFIED_ISSUE_PAGE_TEXT');
    if (versionGaps.length) gapCodes.push('OLDER_URL_YEAR_VERSIONS_UNSELECTED');
    if (!discoveries.length) gapCodes.push('DISCOVERY_CENSUS_NOT_EXPORTED');
    if (discoveries.some(d => d.status === 'failed')) gapCodes.push('ARCHIVE_DISCOVERY_FAILURE');
    if (discoveries.some(d => d.status === 'complete' && d.requestedLimit > 0 && d.returnedCount >= d.requestedLimit)) gapCodes.push('CDX_DISCOVERY_LIMIT_REACHED');
    if (captures.some(c => !archiveIdentityValid(c))) gapCodes.push('CAPTURE_IDENTITY_INVALID');
    if (captures.some(c => c.snapshotStatus === 'failed' || (c.snapshotStatus === 'fetched' && !verifiedPageText(c)))) gapCodes.push('CAPTURE_TEXT_OR_HASH_UNVERIFIED');
    if (auditedStatements.some(s => s.proofStatus === 'unverified')) gapCodes.push('STATEMENT_PROOF_UNVERIFIED');
    if (!auditedStatements.some(s => s.proofStatus === 'archive_text_verified')) gapCodes.push('NO_PROVEN_ATTRIBUTABLE_STATEMENT');
    const siteUrls = [...new Set(sites.map(s => s.url))].sort();
    return {
      membershipId: member.membershipId,
      senatorName: member.senatorName,
      sessionSlug: member.sessionSlug,
      auditedCalendarYears: sessionYears(member.sessionSlug),
      siteUrls,
      siteStatusCounts: {
        documented: sites.filter(s => s.status === 'documented').length,
        unavailable: sites.filter(s => s.status === 'unavailable').length,
        unverified: sites.filter(s => s.status === 'unverified').length,
      },
      capturesDiscoveredInScope: validCaptures.length,
      verifiedPages: fetched.length,
      verifiedIssuePages: capturedPages.length,
      distinctUrlYearGroups: versionGroups.size,
      unselectedVersionGroups: versionGaps,
      statements: auditedStatements,
      provenAttributedStatements: auditedStatements.filter(s => s.proofStatus === 'archive_text_verified').length,
      originalPostDatesAreAvailabilityProof: false as const,
      gapCodes,
      coverageStatus: gapCodes.length ? 'incomplete_or_unverified' as const : 'audited_sample_only' as const,
    };
  });
  const sessionSummary = (['2021-2022', '2023-2024', '2025-2026'] as const).map(session => {
    const rows = memberships.filter(m => m.sessionSlug === session);
    return {
      session,
      rosterMembershipsSupplied: rows.length,
      withProvenAttributedStatement: rows.filter(m => m.provenAttributedStatements > 0).length,
      noProvenStatementOrProof: rows.filter(m => m.provenAttributedStatements === 0).length,
      withUnselectedVersionGroups: rows.filter(m => m.unselectedVersionGroups.length > 0).length,
      withAnyCoverageGap: rows.filter(m => m.gapCodes.length > 0).length,
    };
  });
  return {
    schema: CAMPAIGN_PLATFORM_AUDIT_VERSION,
    scope: { calendarYears: AUDIT_YEARS, chamber: 'senate', dataSource: 'provided_offline_export', productionReads: false,
      productionWrites: false, officialRosterDenominatorVerified: false, archiveUniverseComplete: false, reconciliationCertified: false },
    totals: {
      rosterMembershipsSupplied: memberships.length,
      membershipsWithProvenAttributedStatement: memberships.filter(m => m.provenAttributedStatements > 0).length,
      membershipsWithoutProvenAttributedStatement: memberships.filter(m => m.provenAttributedStatements === 0).length,
      unselectedVersionGroups: memberships.reduce((sum, m) => sum + m.unselectedVersionGroups.length, 0),
      unresolvedMemberships: memberships.filter(m => m.gapCodes.length > 0).length,
    },
    sessionSummary,
    memberships,
  };
}
