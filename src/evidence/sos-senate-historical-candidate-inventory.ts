/**
 * Issue #864 C: offline discovery from election-result identity seeds and SOS candidate
 * file manifests. Never treat a winner list, filing date or article post date as
 * independently proven website availability or an issue-position statement.
 */
import { createHash } from 'node:crypto';

export const SENATE_SOS_SEED_AUDIT_VERSION = 'senate-sos-website-seed-audit-v1' as const;
type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';
type Winner = {
  sourceId: string; district: string; candidateName: string;
  recordType: 'election_results_winner_discovery_only';
};
type Source = {
  id: string; publisher: string; kind: string; url: string;
  electionOn?: string; asOfOn?: string; publisherPublishedOn?: string;
  offersCampaignWebsite: boolean;
};
type WebsiteLead = {
  sourceId: string; district: string; candidateName: string; electionYear: number; url: string;
  proofClass: string; isOriginalSosCandidateFiling: boolean;
  independentArchivePublicBy: string | null; sourceContentSha256: string | null;
  verifiedHistoricalIssueStatementCount: number; eligibleForHistoricalReplay: false;
};
export interface SenateSosSeedManifest {
  schema: string;
  sources: Source[];
  winners: Winner[];
  filedCandidates: Array<{sourceId:string;district:string;candidateName:string;filedOn:string;recordType:string;candidateWebsite:string|null}>;
  websiteLeads: WebsiteLead[];
}
export interface SenateMembershipExport {
  membershipId: string;
  senatorName: string;
  sessionSlug: SessionSlug;
  district: string;
  recordedIssuePositionItems: number;
}
export interface HistoricalSosCandidateFileSource {
  /** The election year is separately supplied, not inferred from the text. */
  electionYear: number;
  officialFileUrl: string;
  capturedAt: string | null;
  externallyVerifiedOfficialCapture: boolean;
}
export interface SenateSosCandidateFileRow {
  candidateName: string;
  district: string;
  electionYear: number;
  website: string | null;
  websiteFieldStatus: 'provided_valid_url' | 'empty' | 'invalid_or_email';
  /** Hash of the locally supplied file; NOT proof it was archived at a historical date. */
  localFileSha256: string;
  sourceUrl: string;
  sourceCaptureClaim: string | null;
  independentlyVerifiedPublicBy: null;
  sourceAuthenticatedByThisTool: false;
}

const validSessionSlugs: ReadonlyArray<SessionSlug> = ['2021-2022','2023-2024','2025-2026'];
export function strictCandidateKey(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\b(?:jr|sr|ii|iii|iv)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}
function senateDistrict(value: string): string | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const district = Number(value);
  return district >= 1 && district <= 67 ? String(district) : null;
}
export function validCampaignWebsite(value: string): string | null {
  const clean = value.trim();
  if (!clean || clean.includes('@') || /^(none|n\/a|null|no website)$/i.test(clean)) return null;
  const raw = /^https?:\/\//i.test(clean) ? clean : 'https://' + clean;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password
      || !hostname.includes('.') || hostname.endsWith('.local') || hostname.endsWith('.internal')
      || hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
      || hostname.endsWith('.test') || hostname.endsWith('.invalid')
      || /[\s;]/.test(clean)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
/**
 * SOS layout for Federal/State/County semicolon files:
 * 0 office ID; 1 candidate name; 2 office ID; 3 office title; 4 county ID;
 * 5 party; 6-14 addresses/phone; 15 CAMPAIGN WEBSITE; 16 campaign email.
 * We deliberately neither return nor log any home/contact fields.
 *
 * Does NOT independently authenticate the source bytes or archive provenance.
 */
export function parseHistoricalSosSenateCandidateFile(
  raw: string, source: HistoricalSosCandidateFileSource,
): { sourceSha256: string; rows: SenateSosCandidateFileRow[]; rejectedMalformedRows: number; unprovenSourceTiming: true } {
  if (!Number.isInteger(source.electionYear) || source.electionYear < 2020 || source.electionYear > 2025) {
    throw new Error('Out-of-scope historical candidate-file election year');
  }
  if (!source.officialFileUrl.startsWith('https://')) throw new Error('Source URL must be HTTPS');
  const sourceSha256 = createHash('sha256').update(raw, 'utf8').digest('hex');
  const rows: SenateSosCandidateFileRow[] = [];
  let rejectedMalformedRows = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.replace(/\r$/, '').split(';');
    if (cells.length < 16) { rejectedMalformedRows += 1; continue; }
    const officeTitle = cells[3].trim();
    const match = /^State\s+Senat(?:or|e)\s+District\s+0*(\d{1,2})\b/i.exec(officeTitle);
    if (!match) continue;
    const district = senateDistrict(match[1]);
    const name = cells[1].trim();
    if (!district || !name) { rejectedMalformedRows += 1; continue; }
    const rawWebsite = cells[15].trim();
    const website = validCampaignWebsite(rawWebsite);
    rows.push({
      candidateName: name, district, electionYear: source.electionYear,
      website, websiteFieldStatus: !rawWebsite ? 'empty' : website ? 'provided_valid_url' : 'invalid_or_email',
      localFileSha256: sourceSha256, sourceUrl: source.officialFileUrl,
      sourceCaptureClaim: source.capturedAt, independentlyVerifiedPublicBy: null,
      sourceAuthenticatedByThisTool: false,
    });
  }
  rows.sort((a,b)=>a.district.localeCompare(b.district,undefined,{numeric:true})
    || a.candidateName.localeCompare(b.candidateName) || (a.website??'').localeCompare(b.website??''));
  return { sourceSha256, rows, rejectedMalformedRows, unprovenSourceTiming: true };
}
function applicableSourceIds(session: SessionSlug): Set<string> {
  if (session === '2021-2022') return new Set(['sos-general-2020']);
  if (session === '2023-2024') return new Set(['sos-general-2022']);
  return new Set(['sos-general-2022','sos-special-2024-45',
    'sos-special-2025-60','sos-special-2025-6','sos-special-2025-29-47']);
}
function isHistoricalDate(value: string): boolean {
  return /^\d{4}-\d\d-\d\d$/.test(value)
    && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
    && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
}
/** A reproducible priority plan; the actual zero-membership set requires exported counts. */
export function auditSenateSosWebsiteSeedInventory(
  manifest: SenateSosSeedManifest,
  membershipExport?: readonly SenateMembershipExport[],
  candidateFileRows: readonly SenateSosCandidateFileRow[] = [],
) {
  if (manifest.schema !== 'mn-sos-senate-candidate-website-seeds-2021-25-v1') throw new Error('Unexpected source-ledger schema');
  const sourceMap = new Map(manifest.sources.map(s => [s.id,s]));
  if (sourceMap.size !== manifest.sources.length) throw new Error('Duplicate source ID');
  for (const source of manifest.sources) {
    if (!source.url.startsWith('https://') || !source.publisher.trim()) throw new Error('Invalid source metadata');
    for (const key of [source.electionOn, source.asOfOn, source.publisherPublishedOn]) {
      if (key && !isHistoricalDate(key)) throw new Error('Invalid source date');
    }
  }
  const winnerKeys = new Set<string>();
  for (const winner of manifest.winners) {
    if (!sourceMap.has(winner.sourceId) || sourceMap.get(winner.sourceId)?.kind !== 'unofficial_post_election_result'
      || !senateDistrict(winner.district) || !strictCandidateKey(winner.candidateName)) throw new Error('Invalid winner source');
    const key = winner.sourceId + ':' + senateDistrict(winner.district);
    if (winnerKeys.has(key)) throw new Error('Duplicate election result district: ' + key);
    winnerKeys.add(key);
  }
  for (const row of manifest.filedCandidates) {
    if (sourceMap.get(row.sourceId)?.kind !== 'official_historical_filed_candidate_list'
      || !isHistoricalDate(row.filedOn) || !senateDistrict(row.district)) throw new Error('Invalid filed candidate source');
  }
  for (const lead of manifest.websiteLeads) {
    if (!sourceMap.has(lead.sourceId) || sourceMap.get(lead.sourceId)?.kind !== 'publisher_carried_candidate_website_link'
      || !validCampaignWebsite(lead.url) || !senateDistrict(lead.district)
      || lead.isOriginalSosCandidateFiling || lead.eligibleForHistoricalReplay
      || lead.independentArchivePublicBy !== null || lead.verifiedHistoricalIssueStatementCount !== 0) {
      throw new Error('Publisher website leads are discovery-only, never replay evidence');
    }
  }
  const seenMembershipIds = new Set<string>();
  for (const member of membershipExport ?? []) {
    if (!member.membershipId.trim() || !member.senatorName.trim() || !validSessionSlugs.includes(member.sessionSlug)
      || !senateDistrict(member.district) || !Number.isSafeInteger(member.recordedIssuePositionItems)
      || member.recordedIssuePositionItems < 0 || seenMembershipIds.has(member.membershipId)) {
      throw new Error('Invalid or duplicate read-only membership export row');
    }
    seenMembershipIds.add(member.membershipId);
  }
  const membershipPriorities = (membershipExport ?? []).map(member => {
    const matchKey = strictCandidateKey(member.senatorName);
    const candidates = manifest.winners.filter(w => applicableSourceIds(member.sessionSlug).has(w.sourceId)
      && senateDistrict(w.district) === senateDistrict(member.district)
      && strictCandidateKey(w.candidateName) === matchKey);
    const uniqueCandidates = [...new Map(candidates.map(w => [w.sourceId+':'+w.district+':'+strictCandidateKey(w.candidateName),w])).values()];
    const matchedCandidates = [...new Set(uniqueCandidates.map(w => strictCandidateKey(w.candidateName)))];
    const identityMatch = uniqueCandidates.length === 0 ? 'not_matched' : matchedCandidates.length > 1 ? 'ambiguous' : 'exact_name_district_candidate';
    const matchingPublisherLeads = identityMatch === 'exact_name_district_candidate'
      ? manifest.websiteLeads.filter(lead => senateDistrict(lead.district) === senateDistrict(member.district)
        && strictCandidateKey(lead.candidateName) === matchKey && member.sessionSlug === '2025-2026')
      : [];
    const matchingSosCandidateRows = identityMatch === 'exact_name_district_candidate'
      ? candidateFileRows.filter(row => senateDistrict(row.district) === senateDistrict(member.district)
        && strictCandidateKey(row.candidateName) === matchKey
        && ((member.sessionSlug === '2021-2022' && row.electionYear === 2020)
          || (member.sessionSlug === '2023-2024' && row.electionYear === 2022)
          || (member.sessionSlug === '2025-2026' && [2022,2024,2025].includes(row.electionYear))))
      : [];
    const candidateWebsites = [...new Set([
      ...matchingPublisherLeads.map(lead => lead.url),
      ...matchingSosCandidateRows.map(row => row.website).filter((x):x is string=>Boolean(x)),
    ])].sort();
    return {
      membershipId: member.membershipId, senatorName: member.senatorName,
      sessionSlug: member.sessionSlug, district: member.district,
      recordedIssuePositionItems: member.recordedIssuePositionItems,
      priority: member.recordedIssuePositionItems === 0 ? 'P0_zero_recorded_positions' : 'P1_existing_positions_source_recheck',
      identityMatch, matchedElectionSourceIds: uniqueCandidates.map(w=>w.sourceId).sort(),
      candidateWebsiteDiscoveryLeads: candidateWebsites,
      siteSourceProvenance: matchingPublisherLeads.map(l => ({ url:l.url,sourceId:l.sourceId,proofStatus:'publisher_lead_only' })),
      independentlyProvenSitePublicBy: null,
      completeWebsiteCoverage: false, historicalStatementEligible: false,
      gapCodes: [
        ...(identityMatch==='not_matched'?['MEMBERSHIP_TO_ELECTION_IDENTITY_UNRESOLVED']:[]),
        ...(!candidateWebsites.length?['NO_HISTORICAL_CAMPAIGN_SITE_URL_PROVEN']:[]),
        'SITE_ORIGINAL_BYTES_AND_HISTORICAL_AVAILABILITY_UNPROVEN',
      ],
    };
  }).sort((a,b)=>a.recordedIssuePositionItems-b.recordedIssuePositionItems
    || a.sessionSlug.localeCompare(b.sessionSlug) || a.senatorName.localeCompare(b.senatorName)
    || a.membershipId.localeCompare(b.membershipId));

  return {
    schema:SENATE_SOS_SEED_AUDIT_VERSION,
    scope:{calendarYears:[2021,2022,2023,2024,2025], chamber:'senate',
      noProductionReads:true,noProductionWrites:true,usesOnlyProvidedMembershipExport:true,
      officialMembershipDenominatorVerified:false,
      officialFiledCandidateUniverseComplete:false, historicalWebsiteCoverageCertified:false,
      historicalIssuePositionCoverageCertified:false},
    counts:{
      winnerElectionRecords:manifest.winners.length,
      originalGeneralElectionWinnerRecords:manifest.winners.filter(w=>w.sourceId.startsWith('sos-general-')).length,
      specialWinnerElectionRecords:manifest.winners.filter(w=>w.sourceId.startsWith('sos-special-')).length,
      officialSpecialFiledCandidateRows:manifest.filedCandidates.length,
      publisherWebsiteLeads:manifest.websiteLeads.length,
      suppliedHistoricalFileSenateCandidateRows:candidateFileRows.length,
      membershipRowsProvided:membershipPriorities.length,
      zeroRecordedPositionMemberships:membershipExport?membershipPriorities.filter(m=>m.recordedIssuePositionItems===0).length:null,
      zeroRecordedPositionMembershipsWithWebsiteLead:membershipExport?membershipPriorities.filter(m=>m.recordedIssuePositionItems===0 && m.candidateWebsiteDiscoveryLeads.length>0).length:null,
    },
    membershipPriorities,
    unjoinedPublisherWebsiteLeads:manifest.websiteLeads.filter(lead => !membershipPriorities.some(m=>
      m.sessionSlug==='2025-2026' && m.district===lead.district
      && strictCandidateKey(m.senatorName)===strictCandidateKey(lead.candidateName))),
    warnings:[
      'Election results are post-election identity discovery, not pre-election platform publication evidence.',
      'Official special filed-candidate list pages do not expose campaign websites in their visible tables.',
      'A blank/invalid website field does not prove a candidate lacked a campaign website.',
      'A dated publisher link is a lead, not an independently archived campaign page or statement.',
      'Only the supplied membership export can identify recorded zero-issue-position memberships; absent export means unknown, not zero.',
      'Name/district matching is deliberately conservative and requires review of aliases, boundary changes, vacancies and special elections.',
    ],
  };
}
