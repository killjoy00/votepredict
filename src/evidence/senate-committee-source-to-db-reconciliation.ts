import { createHash } from 'node:crypto';

export const SENATE_COMMITTEE_SOURCE_DB_RECONCILIATION_VERSION =
  'senate-committee-2022-25-source-to-db-readonly-v1' as const;

export interface OriginalSenateCommitteeYearAudit {
  auditedYear: number;
  independentlyDiscoveredOriginalMinutesPdfLinks: number;
  originalPdfsFetchedAndParsed: number;
  originalPdfsFailedOrUnparsed: number;
  documentProofs: OriginalSenateCommitteePdfProof[];
  unresolvedOriginalDocuments: Array<{ sourceUrl: string; meetingDate: string }>;
}
export interface OriginalSenateCommitteePdfProof {
  document: {
    year: number;
    committeeName: string;
    meetingDate: string;
    sourceUrl: string;
    originalRawPdfSha256: string;
  };
  voteObservations: Array<{
    externalKey: string;
    yeaCount: number;
    nayCount: number;
    individualVotesAvailable: boolean;
    namedMemberChoicesInPdf: number;
    choiceIdentitySha256: string[];
  }>;
  contextOnlyActions: Array<{
    sourceObservationKey: string;
    actionKind: string;
    individualVotesAvailable: false;
  }>;
}

export interface PersistedSenateCommitteeSourceExport {
  sourceDocumentId: string;
  sourceUrl: string;
  sourceSha256: string;
  metadataMeetingDate: string | null;
  metadataCommitteeName: string | null;
  voteEvents: Array<{
    eventId: string;
    externalKey: string;
    occurredOn: string;
    yeaCount: number;
    nayCount: number;
    memberVotes: Array<{
      normalizedName: string;
      choice: string;
      membershipId: string | null;
    }>;
  }>;
  contextActions: Array<{
    evidenceId: string;
    ingestionIdentityKey: string | null;
    subtype: string | null;
    evidenceKind: string;
    membershipId: string | null;
    meetingDate: string | null;
    sourceVerified: string | null;
  }>;
}

export type SenateCommitteeReconciliationIssue =
  | 'official_original_pdf_not_retrieved'
  | 'original_source_not_in_export'
  | 'original_pdf_hash_mismatch'
  | 'duplicate_persisted_source'
  | 'source_meeting_or_committee_mismatch'
  | 'missing_original_roll_call_event'
  | 'duplicate_persisted_roll_call'
  | 'persisted_event_date_mismatch'
  | 'persisted_roll_call_tally_mismatch'
  | 'unexpected_individual_choices_on_count_only'
  | 'original_named_choices_mismatch'
  | 'unresolved_persisted_member_identity'
  | 'missing_original_context_action'
  | 'duplicate_persisted_context_action'
  | 'context_action_semantics_mismatch'
  | 'persisted_vote_event_not_matched_to_source'
  | 'persisted_context_action_not_matched_to_source';

export interface SenateCommitteeReconciliationRow {
  sourceUrl: string;
  year: number;
  committeeName: string;
  meetingDate: string;
  observedRollCalls: number;
  observedContextActions: number;
  sourceRecordPresent: boolean;
  issues: SenateCommitteeReconciliationIssue[];
  categoryCounts: Record<string, number>;
}

function hashChoice(choice: string, normalizedName: string): string {
  return createHash('sha256').update(choice + ':' + normalizedName).digest('hex');
}

function validateSource(s: OriginalSenateCommitteePdfProof): boolean {
  let url: URL;
  try { url = new URL(s.document.sourceUrl); }
  catch { return false; }
  return Number.isInteger(s.document.year)
    && s.document.year >= 2022 && s.document.year <= 2025
    && url.protocol === 'https:'
    && ['lrl.mn.gov', 'www.lrl.mn.gov'].includes(url.hostname)
    && /^\/archive\/minutes\/senate\/202[2-5]\//i.test(url.pathname)
    && /^[a-f0-9]{64}$/.test(s.document.originalRawPdfSha256)
    && s.document.meetingDate.slice(0, 4) === String(s.document.year)
    && s.voteObservations.every(v =>
      Number.isInteger(v.yeaCount) && Number.isInteger(v.nayCount)
      && Number.isInteger(v.namedMemberChoicesInPdf)
      && (v.individualVotesAvailable
        ? v.namedMemberChoicesInPdf === v.yeaCount + v.nayCount
          && v.choiceIdentitySha256.length === v.namedMemberChoicesInPdf
          && v.choiceIdentitySha256.every(sha => /^[a-f0-9]{64}$/.test(sha))
        : v.namedMemberChoicesInPdf === 0 && v.choiceIdentitySha256.length === 0));
}

/**
 * Stateless source->private-export comparison. No external data fetch, no
 * production access, no writes. Original PDF results do NOT prove the parser
 * found every spoken/unrecorded committee action.
 *
 * Public original member-choice hashes are matched to privately exported
 * normalized names in memory. Neither names nor extracted PDF text are
 * retained in result rows.
 */
export function reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport(
  original: readonly OriginalSenateCommitteeYearAudit[],
  exported: readonly PersistedSenateCommitteeSourceExport[],
) {
  const seenYears = new Set<number>();
  const sourceProofs: OriginalSenateCommitteePdfProof[] = [];
  const missingPdfs: Array<{ year: number; sourceUrl: string; meetingDate: string }> = [];
  for (const report of original) {
    if (![2022, 2023, 2024, 2025].includes(report.auditedYear)
      || seenYears.has(report.auditedYear)) {
      throw Error('Unrecognized or duplicate Senate original PDF audit year');
    }
    seenYears.add(report.auditedYear);
    if (report.originalPdfsFetchedAndParsed !== report.documentProofs.length
      || report.originalPdfsFailedOrUnparsed !== report.unresolvedOriginalDocuments.length
      || report.originalPdfsFetchedAndParsed + report.originalPdfsFailedOrUnparsed
        !== report.independentlyDiscoveredOriginalMinutesPdfLinks) {
      throw Error('Official original PDF manifest internally inconsistent');
    }
    for (const doc of report.documentProofs) {
      if (doc.document.year !== report.auditedYear || !validateSource(doc))
        throw Error('Source PDF record has invalid year, hash, URL or named choice identity proof');
      sourceProofs.push(doc);
    }
    for (const failed of report.unresolvedOriginalDocuments) {
      missingPdfs.push({ year: report.auditedYear, sourceUrl: failed.sourceUrl,
        meetingDate: failed.meetingDate });
    }
  }

  const seenSourceUrls = new Set<string>();
  for (const source of sourceProofs) {
    if (seenSourceUrls.has(source.document.sourceUrl))
      throw Error('Duplicate official source URL in PDF manifests');
    seenSourceUrls.add(source.document.sourceUrl);
  }

  const dbByUrl = new Map<string, PersistedSenateCommitteeSourceExport[]>();
  for (const row of exported) {
    const rows = dbByUrl.get(row.sourceUrl) ?? [];
    rows.push(row);
    dbByUrl.set(row.sourceUrl, rows);
  }

  const comparisons: SenateCommitteeReconciliationRow[] = [];
  for (const proof of sourceProofs) {
    const source = proof.document;
    const all = dbByUrl.get(source.sourceUrl) ?? [];
    const record = all.length === 1 ? all[0]! : null;
    const issues = new Set<SenateCommitteeReconciliationIssue>();
    if (!record) issues.add(all.length ? 'duplicate_persisted_source' : 'original_source_not_in_export');
    if (record && record.sourceSha256 !== source.originalRawPdfSha256)
      issues.add('original_pdf_hash_mismatch');
    if (record && (record.metadataMeetingDate !== source.meetingDate
      || record.metadataCommitteeName !== source.committeeName))
      issues.add('source_meeting_or_committee_mismatch');

    // Source SHA mismatch is a separately reviewable archived-original change;
    // do not compare stale event observations as if they came from this PDF.
    const verifiedRecord = record && issues.size === 0 ? record : null;
    const actualEvents = new Map<string, PersistedSenateCommitteeSourceExport['voteEvents']>();
    if (verifiedRecord) {
      for (const event of verifiedRecord.voteEvents) {
        actualEvents.set(event.externalKey,
          [...(actualEvents.get(event.externalKey) ?? []), event]);
      }
    }
    const sourceEventKeys = new Set<string>();
    let rollCallsMatched = 0;
    let originalNamedChoices = 0;
    let persistedNamedChoices = 0;
    for (const vote of proof.voteObservations) {
      sourceEventKeys.add(vote.externalKey);
      originalNamedChoices += vote.namedMemberChoicesInPdf;
      if (!verifiedRecord) continue;
      const entries = actualEvents.get(vote.externalKey) ?? [];
      if (!entries.length) {
        issues.add('missing_original_roll_call_event'); continue;
      }
      if (entries.length !== 1) {
        issues.add('duplicate_persisted_roll_call'); continue;
      }
      const event = entries[0]!;
      if (event.occurredOn !== source.meetingDate)
        issues.add('persisted_event_date_mismatch');
      if (event.yeaCount !== vote.yeaCount || event.nayCount !== vote.nayCount)
        issues.add('persisted_roll_call_tally_mismatch');
      if (!vote.individualVotesAvailable) {
        if (event.memberVotes.length !== 0)
          issues.add('unexpected_individual_choices_on_count_only');
        else if (event.occurredOn === source.meetingDate
          && event.yeaCount === vote.yeaCount && event.nayCount === vote.nayCount)
          rollCallsMatched++;
        continue;
      }
      persistedNamedChoices += event.memberVotes.length;
      if (event.memberVotes.some(v => v.membershipId === null))
        issues.add('unresolved_persisted_member_identity');
      const actualChoiceDigests = event.memberVotes.map(v =>
        hashChoice(v.choice, v.normalizedName)).sort();
      if (event.memberVotes.length !== vote.namedMemberChoicesInPdf
        || JSON.stringify(actualChoiceDigests) !== JSON.stringify(vote.choiceIdentitySha256))
        issues.add('original_named_choices_mismatch');
      else if (event.occurredOn === source.meetingDate
        && event.yeaCount === vote.yeaCount && event.nayCount === vote.nayCount
        && event.memberVotes.every(v => v.membershipId !== null))
        rollCallsMatched++;
    }
    if (verifiedRecord) for (const event of verifiedRecord.voteEvents) {
      if (!sourceEventKeys.has(event.externalKey))
        issues.add('persisted_vote_event_not_matched_to_source');
    }

    const actualActions = new Map<string, PersistedSenateCommitteeSourceExport['contextActions']>();
    if (verifiedRecord) for (const action of verifiedRecord.contextActions) {
      if (!action.ingestionIdentityKey) continue;
      actualActions.set(action.ingestionIdentityKey,
        [...(actualActions.get(action.ingestionIdentityKey) ?? []), action]);
    }
    const sourceActionKeys = new Set<string>();
    let contextActionsMatched = 0;
    for (const act of proof.contextOnlyActions) {
      sourceActionKeys.add(act.sourceObservationKey);
      if (!verifiedRecord) continue;
      const actions = actualActions.get(act.sourceObservationKey) ?? [];
      if (!actions.length) {
        issues.add('missing_original_context_action'); continue;
      }
      if (actions.length !== 1) {
        issues.add('duplicate_persisted_context_action'); continue;
      }
      const row = actions[0]!;
      if (row.subtype !== act.actionKind || row.evidenceKind !== 'context'
        || row.membershipId !== null || row.meetingDate !== source.meetingDate
        || row.sourceVerified !== 'true')
        issues.add('context_action_semantics_mismatch');
      else contextActionsMatched++;
    }
    if (verifiedRecord) for (const act of verifiedRecord.contextActions) {
      if (act.ingestionIdentityKey && !sourceActionKeys.has(act.ingestionIdentityKey))
        issues.add('persisted_context_action_not_matched_to_source');
    }

    comparisons.push({
      sourceUrl: source.sourceUrl, year: source.year,
      committeeName: source.committeeName, meetingDate: source.meetingDate,
      observedRollCalls: proof.voteObservations.length,
      observedContextActions: proof.contextOnlyActions.length,
      sourceRecordPresent: record !== null,
      issues: [...issues].sort(),
      categoryCounts: {
        sourceNamedMemberChoices: originalNamedChoices,
        persistedNamedMemberChoices: persistedNamedChoices,
        matchedRollCallEvents: rollCallsMatched,
        matchedContextActions: contextActionsMatched,
      },
    });
  }

  const byYearCommittee = new Map<string, {
    year: number;
    committeeName: string;
    originalPdfs: number;
    sourceDocumentsMissingOrMismatched: number;
    pdfsWithReconciliationIssues: number;
    originalRollCalls: number;
    originalContextActions: number;
    matchedRollCalls: number;
    matchedContextActions: number;
  }>();
  for (const row of comparisons) {
    const key = [row.year, row.committeeName].join('|');
    const found = byYearCommittee.get(key) ?? {
      year: row.year, committeeName: row.committeeName, originalPdfs: 0,
      sourceDocumentsMissingOrMismatched: 0, pdfsWithReconciliationIssues: 0,
      originalRollCalls: 0, originalContextActions: 0,
      matchedRollCalls: 0, matchedContextActions: 0,
    };
    found.originalPdfs++;
    if (!row.sourceRecordPresent
      || row.issues.includes('original_pdf_hash_mismatch')
      || row.issues.includes('source_meeting_or_committee_mismatch'))
      found.sourceDocumentsMissingOrMismatched++;
    if (row.issues.length) found.pdfsWithReconciliationIssues++;
    found.originalRollCalls += row.observedRollCalls;
    found.originalContextActions += row.observedContextActions;
    found.matchedRollCalls += row.categoryCounts.matchedRollCallEvents;
    found.matchedContextActions += row.categoryCounts.matchedContextActions;
    byYearCommittee.set(key, found);
  }
  return {
    schemaVersion: SENATE_COMMITTEE_SOURCE_DB_RECONCILIATION_VERSION,
    sourceAuditYearsSupplied: [...seenYears].sort(),
    sourceOriginalPdfsAvailable: sourceProofs.length,
    sourceOriginalPdfsUnavailable: missingPdfs.length,
    privateExportSourcesProvided: exported.length,
    sourceOnlyOriginalPdfFailures: missingPdfs,
    originalPdfToDatabaseRows: comparisons.sort((a,b)=>a.year-b.year
      || a.meetingDate.localeCompare(b.meetingDate) || a.sourceUrl.localeCompare(b.sourceUrl)),
    byYearCommittee: [...byYearCommittee.values()].sort((a,b)=>
      a.year - b.year || a.committeeName.localeCompare(b.committeeName)),
    summary: {
      matchedDocumentSources: comparisons.filter(r=>r.sourceRecordPresent && !r.issues.length).length,
      documentsWithAnyMismatch: comparisons.filter(r=>r.issues.length > 0).length,
      sourceDocumentMismatchCount: comparisons.filter(r=>!r.sourceRecordPresent
        || r.issues.includes('original_pdf_hash_mismatch')).length,
      sourceCandidateRollCalls: comparisons.reduce((n,r)=>n+r.observedRollCalls,0),
      exactSourceToDatabaseMatchedRollCalls: comparisons.reduce((n,r)=>n+r.categoryCounts.matchedRollCallEvents,0),
      sourceCandidateContextActions: comparisons.reduce((n,r)=>n+r.observedContextActions,0),
      exactSourceToDatabaseMatchedContextActions: comparisons.reduce((n,r)=>n+r.categoryCounts.matchedContextActions,0),
    },
    all2021To2025OfficialMeetingDenominator: null,
    all2021To2025OfficialVoteDenominator: null,
    sourceParserIsNotCertifiedExhaustive: true,
    year2021OfficialPrintMinutesUnreconciled: true,
    year2022PrintedAndElectronicCanDiffer: true,
    noLiveDatabaseAccessOrMutation: true,
    noEligibilityOrServingPromotion: true,
    noCompletionCertificate: true,
  };
}
