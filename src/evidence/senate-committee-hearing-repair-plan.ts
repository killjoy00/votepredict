import {
  SENATE_COMMITTEE_MEETING_TIMING_VERSION,
  senateCommitteeHearingTiming,
} from './senate-committee-meeting-timing.js';

export const SENATE_COMMITTEE_LEGACY_REPAIR_VERSION =
  'senate-committee-legacy-hearing-date-safe-repair-v1' as const;

export interface SenateCommitteeHistoricalEvidenceExportRow {
  recordType: 'senate_committee_evidence';
  evidenceId: string;
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceSha256: string;
  sourceMeetingDate: string | null;
  sourceOfficialArchive: string | null;
  itemMeetingDate: string | null;
  contextType: string | null;
  subtype: string | null;
  sourceVerified: string | null;
  publishedAt: string | null;
  meetingDateIsAvailability: string | null;
  asOfEligible: string | null;
  availableOn: string | null;
  mechanicallyActionable: string | null;
  modelWeight: string | null;
  individualVotesAvailable: string | null;
  evidenceKind: string;
  membershipId: string | null;
  billId: string | null;
  ingestionIdentityKey: string | null;
  ingestionKey: string | null;
  associatedVoteEventDates: string[];
}

export type SenateCommitteeRepairDisposition =
  | 'repair_review_candidate'
  | 'already_hearing_dated'
  | 'blocked_out_of_scope'
  | 'blocked_source_provenance'
  | 'blocked_unverified_minute'
  | 'blocked_disputed_hearing_date'
  | 'blocked_semantics'
  | 'blocked_missing_stable_identity'
  | 'blocked_original_date_conflict'
  | 'blocked_duplicate_natural_identity'
  | 'blocked_vote_event_date_mismatch';

export interface SenateCommitteeRepairDecision {
  evidenceId: string;
  sourceDocumentId: string;
  sourceUrl: string;
  meetingDate: string | null;
  disposition: SenateCommitteeRepairDisposition;
  previousPublishedAt: string | null;
  meetingTimestampAfterRepair: string | null;
}

function validUuid(s: string | null): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function validSha(s: string) { return /^[a-f0-9]{64}$/.test(s); }

function parseOfficialSourceDate(row: SenateCommitteeHistoricalEvidenceExportRow): string | null {
  let u: URL;
  try { u = new URL(row.sourceUrl); } catch { return null; }
  if (u.protocol !== 'https:' || !['www.lrl.mn.gov', 'lrl.mn.gov'].includes(u.hostname)
    || Boolean(u.search)) return null;
  const path = u.pathname.match(
    /^\/archive\/minutes\/senate\/(202[1-5])\/[^/]+\/(20\d{6})\/[^/]+_Minutes\.pdf$/i,
  );
  if (!path || path[1] === '2021') return null; // 2021 is print-only, not an electronic URL proof.
  const raw = path[2]!;
  const day = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
  if (day.slice(0, 4) !== path[1]) return null;
  try { senateCommitteeHearingTiming(day); return day; }
  catch { return null; }
}

function stableNaturalIdentity(row: SenateCommitteeHistoricalEvidenceExportRow): string | null {
  if (!row.ingestionIdentityKey || !row.ingestionIdentityKey.trim()
    || row.ingestionIdentityKey.length > 2048) return null;
  return [
    row.sourceDocumentId,
    row.ingestionIdentityKey,
    row.evidenceKind,
    row.membershipId ?? 'NULL',
    row.billId ?? 'NULL',
  ].join('|');
}

function semanticallyValid(row: SenateCommitteeHistoricalEvidenceExportRow): boolean {
  if (row.mechanicallyActionable !== 'false' || row.modelWeight !== '0') return false;
  if (row.contextType === 'senate_committee_vote') {
    if (row.subtype === 'named_roll_call') {
      return row.individualVotesAvailable === 'true' && row.evidenceKind === 'fact'
        && validUuid(row.membershipId);
    }
    if (row.subtype === 'count_only_roll_call') {
      return row.individualVotesAvailable === 'false'
        && row.evidenceKind === 'context' && row.membershipId === null;
    }
    return false;
  }
  if (row.contextType === 'senate_committee_action') {
    return ['voice_vote', 'unanimous_action', 'motion_result_only'].includes(row.subtype ?? '')
      && row.individualVotesAvailable === 'false'
      && row.evidenceKind === 'context' && row.membershipId === null;
  }
  return false;
}

function classify(row: SenateCommitteeHistoricalEvidenceExportRow): SenateCommitteeRepairDecision {
  const day = parseOfficialSourceDate(row);
  let disposition: SenateCommitteeRepairDisposition;
  const scope = row.recordType === 'senate_committee_evidence'
    && validUuid(row.evidenceId) && validUuid(row.sourceDocumentId)
    && row.sourceKind === 'senate_committee_minutes'
    && typeof row.sourceMeetingDate === 'string'
    && row.sourceMeetingDate.slice(0, 4) >= '2021'
    && row.sourceMeetingDate.slice(0, 4) <= '2025';
  if (!scope) disposition = 'blocked_out_of_scope';
  else if (!day || !validSha(row.sourceSha256) || row.sourceOfficialArchive !== 'true') {
    disposition = 'blocked_source_provenance';
  } else if (row.sourceVerified !== 'true') {
    disposition = 'blocked_unverified_minute';
  } else if (day !== row.itemMeetingDate || day !== row.sourceMeetingDate) {
    disposition = 'blocked_disputed_hearing_date';
  } else if (!semanticallyValid(row)) {
    disposition = 'blocked_semantics';
  } else if (!stableNaturalIdentity(row) || !row.ingestionKey
    || !validSha(row.ingestionKey)) {
    disposition = 'blocked_missing_stable_identity';
  } else if (row.contextType === 'senate_committee_vote'
    && (row.associatedVoteEventDates.length === 0
      || row.associatedVoteEventDates.some(date => date !== day))) {
    disposition = 'blocked_vote_event_date_mismatch';
  } else {
    const expected = senateCommitteeHearingTiming(day).publishedAt;
    const dated = row.publishedAt === expected
      && row.meetingDateIsAvailability === 'true'
      && row.asOfEligible === 'true'
      && row.availableOn === day;
    if (dated) disposition = 'already_hearing_dated';
    else if (row.publishedAt === null && row.meetingDateIsAvailability === 'false'
      && row.asOfEligible === 'false'
      && (row.availableOn === null || row.availableOn === '')) {
      disposition = 'repair_review_candidate';
    } else {
      disposition = 'blocked_original_date_conflict';
    }
  }
  return {
    evidenceId: row.evidenceId, sourceDocumentId: row.sourceDocumentId,
    sourceUrl: row.sourceUrl, meetingDate: day,
    disposition, previousPublishedAt: row.publishedAt,
    meetingTimestampAfterRepair: disposition === 'repair_review_candidate' && day
      ? senateCommitteeHearingTiming(day).publishedAt : null,
  };
}

export function planSenateCommitteeHearingRepair(
  rows: readonly SenateCommitteeHistoricalEvidenceExportRow[],
) {
  const natural = new Map<string, number>();
  const duplicateEvidenceIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const row of rows) {
    const key = stableNaturalIdentity(row);
    if (key) natural.set(key, (natural.get(key) ?? 0) + 1);
    if (seenIds.has(row.evidenceId)) duplicateEvidenceIds.add(row.evidenceId);
    seenIds.add(row.evidenceId);
  }
  const decisions = rows.map(row => {
    const result = classify(row);
    const key = stableNaturalIdentity(row);
    if ((key && (natural.get(key) ?? 0) > 1) || duplicateEvidenceIds.has(row.evidenceId)) {
      return {
        ...result, disposition: 'blocked_duplicate_natural_identity' as const,
        meetingTimestampAfterRepair: null,
      };
    }
    return result;
  });
  const eligible = decisions.filter(x => x.disposition === 'repair_review_candidate');
  const already = decisions.filter(x => x.disposition === 'already_hearing_dated');
  const blocked = decisions.filter(x =>
    x.disposition !== 'repair_review_candidate' && x.disposition !== 'already_hearing_dated');
  const byDisposition = Object.fromEntries(
    [...new Set(decisions.map(d => d.disposition))].sort()
      .map(status => [status, decisions.filter(d => d.disposition === status).length]),
  );
  return {
    schemaVersion: SENATE_COMMITTEE_LEGACY_REPAIR_VERSION,
    scope: 'Minnesota Senate original official electronic committee minutes 2022-2025',
    exportedRows: rows.length,
    reviewCandidates: eligible.length,
    alreadyCorrect: already.length,
    blocked: blocked.length,
    byDisposition,
    decisions,
    approvalRequiredBeforeAnyDatabaseWrite: true,
    sourceYear2021PrintUniverseNotCovered: true,
    privateProductionDataWasNotAccessedByPlanner: true,
    completeCommitteeMeetingAndVoteDenominatorsKnown: false,
    noMaterializedEvidenceAutomaticallyModified: true,
    historicalAsOfRepairExecutionApproved: false,
  };
}

function literal(value: string): string { return "'" + value.replaceAll("'", "''") + "'"; }

/**
 * This SQL only PREVIEWS a guarded candidate-row UPDATE and then ROLLS BACK.
 * To actually run any changes a separate verified, owner-authorized operator
 * must review/approve a complete database export and explicitly replace the
 * final ROLLBACK with COMMIT under a restricted transaction/role.
 *
 * Always rerun the export/plan and inspect conflicts before any authorization.
 * Never call this SQL as part of migrations, jobs or serving.
 */
export function previewSenateCommitteeHearingRepairSql(
  rows: readonly SenateCommitteeHistoricalEvidenceExportRow[],
): string {
  const plan = planSenateCommitteeHearingRepair(rows);
  const allowed = new Set(plan.decisions.filter(x =>
    x.disposition === 'repair_review_candidate').map(x => x.evidenceId));
  const values = rows.filter(x => allowed.has(x.evidenceId))
    .map(x => '  (' + [
      literal(x.evidenceId) + '::uuid',
      literal(x.sourceDocumentId) + '::uuid',
      literal(x.sourceSha256),
      literal(x.sourceUrl),
      literal(x.itemMeetingDate!),
      literal(x.ingestionIdentityKey!),
      literal(x.ingestionKey!),
    ].join(', ') + ')');
  if (!values.length) return [
    '-- No eligible rows. Never invent a correction from an empty/blocked export.',
    '-- Original source, complete cohort and operator authorization remain separate.',
    'BEGIN;',
    'ROLLBACK;',
    '',
  ].join('\n');
  return [
    '-- DRY-RUN ONLY; NO PRODUCTION DATABASE WRITE AUTHORIZED.',
    '-- Explicit original source-verified meeting date and natural-identity checks required.',
    '-- This script ends in ROLLBACK by design; do not run in automated jobs.',
    '-- The old ingestionKey remains immutable provenance; DO NOT blindly rerun backfill.',
    'BEGIN;',
    "SET LOCAL lock_timeout = '5s';",
    'WITH approved(id,source_document_id,source_sha256,source_url,meeting_date,identity_key,legacy_ingestion_key) AS (',
    '  VALUES',
    values.join(',\n'),
    '), repair AS (',
    '  UPDATE evidence_items AS ei',
    '     SET published_at = (approved.meeting_date || ' + literal('T23:59:59.999Z') + ')::timestamptz,',
    '         metadata = ei.metadata || jsonb_build_object(',
    "           'timingPolicyVersion', " + literal(SENATE_COMMITTEE_MEETING_TIMING_VERSION) + ',',
    "           'hearingDateRepairVersion', " + literal(SENATE_COMMITTEE_LEGACY_REPAIR_VERSION) + ',',
    "           'meetingDateIsAvailability', true,",
    "           'eventOccurredOn', approved.meeting_date,",
    "           'availableOn', approved.meeting_date,",
    "           'availabilityProof', 'public_senate_committee_meeting',",
    "           'availabilityStatus', 'committee_event_at_open_hearing',",
    "           'dateGranularity', 'day',",
    "           'intradayOrderingProven', false,",
    "           'sameDayEligible', false,",
    "           'asOfEligible', true,",
    "           'legacyIngestionKey', approved.legacy_ingestion_key",
    '         )',
    '    FROM approved JOIN source_documents sd ON sd.id = approved.source_document_id',
    '   WHERE ei.id = approved.id',
    '     AND ei.source_document_id = sd.id',
    "     AND sd.source_kind = 'senate_committee_minutes'",
    "     AND sd.source_url ~ '^https://(www\\.)?lrl\\.mn\\.gov/archive/minutes/senate/202[2-5]/'",
    '     AND sd.content_sha256 = approved.source_sha256',
    '     AND sd.source_url = approved.source_url',
    "     AND sd.metadata->>'officialArchive' = 'true'",
    "     AND sd.metadata->>'meetingDate' = approved.meeting_date",
    "     AND ei.metadata->>'sourceVerified' = 'true'",
    "     AND ei.metadata->>'meetingDate' = approved.meeting_date",
    "     AND ei.metadata->>'ingestionIdentityKey' = approved.identity_key",
    "     AND ei.metadata->>'ingestionKey' = approved.legacy_ingestion_key",
    "     AND ei.metadata->>'meetingDateIsAvailability' = 'false'",
    "     AND ei.metadata->>'asOfEligible' = 'false'",
    '     AND ei.published_at IS NULL',
    "     AND ei.metadata->>'mechanicallyActionable' = 'false'",
    "     AND ei.metadata->>'modelWeight' = '0'",
    "     AND ei.metadata->>'contextType' IN ('senate_committee_vote','senate_committee_action')",
    '     AND NOT EXISTS (',
    '       SELECT 1 FROM evidence_items sibling',
    '        WHERE sibling.id <> ei.id',
    '          AND sibling.source_document_id = ei.source_document_id',
    "          AND sibling.metadata->>'ingestionIdentityKey' = approved.identity_key",
    '          AND sibling.evidence_kind = ei.evidence_kind',
    '          AND sibling.membership_id IS NOT DISTINCT FROM ei.membership_id',
    '          AND sibling.bill_id IS NOT DISTINCT FROM ei.bill_id',
    '     )',
    '     AND NOT EXISTS (',
    '       SELECT 1 FROM vote_events contradicting_event',
    '        WHERE contradicting_event.source_document_id = sd.id',
    '          AND contradicting_event.occurred_on <> approved.meeting_date::date',
    '     )',
    '     AND (',
    "       ei.metadata->>'contextType' = 'senate_committee_action'",
    '       OR EXISTS (',
    '         SELECT 1 FROM vote_events ve',
    '          WHERE ve.source_document_id = sd.id',
    '            AND ve.occurred_on = approved.meeting_date::date',
    '       )',
    '     )',
    '   RETURNING ei.id, ei.source_document_id, ei.published_at',
    ')',
    'SELECT id::text, source_document_id::text, published_at::text FROM repair ORDER BY id;',
    '-- No COMMIT is emitted by this offline planner.',
    'ROLLBACK;',
    '',
  ].join('\n');
}

/**
 * Stable identity across the old null-publishedAt row and the new hearing-day
 * representation, without relying on the date-sensitive ingestion SHA.
 * Only used for the exact original Senate committee minutes source.
 */
export function senateCommitteeDurableNaturalKey(input: {
  sourceKind: string;
  sourceDocumentId: string;
  ingestionIdentityKey: unknown;
  evidenceKind: string;
  membershipId: string | null;
  billId: string | null;
}): string | null {
  if (input.sourceKind !== 'senate_committee_minutes'
    || typeof input.ingestionIdentityKey !== 'string'
    || !input.ingestionIdentityKey.trim() || input.ingestionIdentityKey.length > 2048)
    return null;
  return [
    'senate-committee-v1', input.sourceDocumentId,
    input.ingestionIdentityKey.trim(), input.evidenceKind,
    input.membershipId ?? 'NULL', input.billId ?? 'NULL',
  ].join('|');
}

export function senateCommitteePersistedIdentityCompatible(
  persisted: {
    claim: string;
    stance: string | null;
    extraction_method: string;
    extraction_version: string | null;
    context_type: string | null;
    subtype: string | null;
  },
  draft: {
    claim: string;
    stance?: string | null;
    extractionMethod: string;
    extractionVersion?: string | null;
    metadata?: Record<string, unknown>;
  },
): boolean {
  return persisted.claim === draft.claim
    && persisted.stance === (draft.stance ?? null)
    && persisted.extraction_method === draft.extractionMethod
    && persisted.extraction_version === (draft.extractionVersion ?? null)
    && persisted.context_type === (draft.metadata?.contextType ?? null)
    && persisted.subtype === (draft.metadata?.subtype ?? null);
}
