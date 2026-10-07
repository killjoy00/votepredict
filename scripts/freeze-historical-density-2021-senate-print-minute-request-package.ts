import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ISSUE = 718;

const SOURCE_RUN_ID = 37651575088;
const SOURCE_ARTIFACT_ID = 11496154614;
const SOURCE_ARTIFACT_DIGEST =
  'sha256:7fe1b76bf95c5a58cb2930f4a8392d254038a1a43196a687e184bd7ac19f4cf0';
const SOURCE_COMMIT_SHA =
  'a0fc341d65bc4e1b901f1eb23676042c9a427033';

const EXPECTED_TARGET_EVENT_PROOF =
  '7cf570804af8abed6eb4990b6fe530046ba038e5bc61d85e1311158afedc3657';
const EXPECTED_COMMITTEE_SCOPE_PROOF =
  'e7b5bcb09a55511fa4cf7e061fce6a58a35b604763bfa35155e7327866a35bc2';
const EXPECTED_ASSOCIATION_PROOF =
  'f16f22044d13286f4478dac260952fec19684495a65d5f1a0a52de6fad84ce44';
const EXPECTED_PRIORITY_PROOF =
  'e4d78af9f9e0f7c34bd1b2131c2e9a3a58c80e871fc2bb51de8f5cd421923aa5';

const EXPECTED_COMMITTEES = 10;
const EXPECTED_TARGET_ASSOCIATIONS = 85;
const EXPECTED_UNIQUE_EVENTS = 62;
const EXPECTED_UNIQUE_BILLS = 57;
const EXPECTED_SELECTED_UNCOVERED_ROWS = 4154;
const EXPECTED_RECORDING_PAGES = 208;
const EXPECTED_REQUEST_ASSOCIATION_PROOF =
  '6d3ecfa7d433e8a3f3c835ecc9934a0b68cab53f213501b333e873d32d29a1d0';

const JSON_NAME =
  'historical-density-2021-senate-print-minute-request-package-v1.json';
const CSV_NAME =
  'historical-density-2021-senate-print-minute-request-targets-v1.csv';
const MARKDOWN_NAME =
  'historical-density-2021-senate-print-minute-request-brief-v1.md';

type Json = Record<string, any>;

type RequestTarget = {
  rank: number;
  committeeEventId: string;
  committeeName: string;
  voteEventId: string;
  billId: string;
  identifier: string;
  targetVoteDate: string;
  uncoveredRows: number;
  referralDates: string[];
  requestWindowStart: string;
  requestWindowEndExclusive: string;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function setSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
}

function csv(value: unknown): string {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function main(): void {
  const sourcePath = env('VOTEPREDICT_SENATE_2021_PRIORITY_PATH');
  const outputDir = resolve(
    process.env.VOTEPREDICT_SENATE_2021_REQUEST_OUTPUT_DIR
      ?? 'tmp/senate-2021-print-minute-request-package',
  );
  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as Json;

  if (
    source.schemaVersion
      !== 'historical-density-2021-senate-print-minute-target-priority-v1'
    || source.issue !== ISSUE
    || source.targetGap?.uncoveredRows !== 14600
    || source.targetGap?.targetEvents !== 218
    || source.targetGap?.bills !== 176
    || source.targetGap?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_PROOF
    || source.lrlScope?.committeeOrOtherGroups !== 30
    || source.lrlScope?.committeeGroupSha256 !== EXPECTED_COMMITTEE_SCOPE_PROOF
    || source.revisor?.targetBillStatusDocuments !== 176
    || source.revisor?.fetchFailures !== 0
    || source.revisor?.referralDescriptionsWithoutParsedCommittee?.length !== 0
    || source.revisor?.unmatchedReferralLabels?.length !== 0
    || source.acquisitionCandidates?.committeesWithMatchedPreVoteReferrals !== 20
    || source.acquisitionCandidates?.matchedTargetEvents !== 66
    || source.acquisitionCandidates?.matchedUncoveredRows !== 4422
    || source.acquisitionCandidates?.associationProofSha256
      !== EXPECTED_ASSOCIATION_PROOF
    || source.priority?.selectedCommitteeCount !== EXPECTED_COMMITTEES
    || source.priority?.selectedTargetEvents !== EXPECTED_UNIQUE_EVENTS
    || source.priority?.selectedUncoveredRows !== EXPECTED_SELECTED_UNCOVERED_ROWS
    || source.priority?.priorityProofSha256 !== EXPECTED_PRIORITY_PROOF
    || source.policy?.productionDatabaseQueried !== false
    || source.policy?.productionWrites !== false
    || source.policy?.targetVoteOutcomesRead !== false
    || source.policy?.outcomeUse !== 'none'
    || source.policy?.memberStanceInferred !== false
    || source.policy?.committeeReferralTreatedAsEvidence !== false
    || source.policy?.mediaPresenceTreatedAsEvidence !== false
    || source.policy?.printMinuteContentAcquired !== false
    || source.policy?.featureRowsWritten !== false
    || source.policy?.modelFitting !== 'none'
    || source.policy?.servingChanged !== false
    || source.policy?.vercelUsed !== false
  ) {
    throw new Error('Canonical Senate print-minute priority artifact drifted');
  }

  const selected = source.priority.selected as Json[];
  const selectedByEvent = new Map<string, Json>();
  for (const row of selected) {
    const eventId = String(row.eventId);
    if (selectedByEvent.has(eventId)) {
      throw new Error(`Duplicate selected committee: ${eventId}`);
    }
    selectedByEvent.set(eventId, row);
  }

  const requestGroups: Json[] = [];
  const flatTargets: RequestTarget[] = [];

  for (const committee of source.acquisitionCandidates.committees as Json[]) {
    const selectedRow = selectedByEvent.get(String(committee.eventId));
    if (!selectedRow) continue;

    const targets = (committee.targets as Json[])
      .map((target): RequestTarget => {
        const referralDates = [...(target.referralDates as string[])].sort();
        if (referralDates.length === 0) {
          throw new Error(
            `Selected target lacks a referral date: ${String(target.voteEventId)}`,
          );
        }
        const requestWindowStart = referralDates[0]!;
        const targetVoteDate = String(target.occurredOn);
        if (!(requestWindowStart < targetVoteDate)) {
          throw new Error(
            `Selected target is not strict-pre-vote: ${String(target.voteEventId)}`,
          );
        }

        return {
          rank: Number(selectedRow.rank),
          committeeEventId: String(committee.eventId),
          committeeName: String(committee.eventName),
          voteEventId: String(target.voteEventId),
          billId: String(target.billId),
          identifier: String(target.identifier),
          targetVoteDate,
          uncoveredRows: Number(target.uncoveredRows),
          referralDates,
          requestWindowStart,
          requestWindowEndExclusive: targetVoteDate,
        };
      })
      .sort((a, b) =>
        a.targetVoteDate.localeCompare(b.targetVoteDate)
        || a.identifier.localeCompare(b.identifier)
        || a.voteEventId.localeCompare(b.voteEventId));

    flatTargets.push(...targets);
    requestGroups.push({
      rank: Number(selectedRow.rank),
      committeeEventId: String(committee.eventId),
      committeeName: String(committee.eventName),
      recordingPages: Number(committee.recordingPages),
      totalAssociatedTargetEvents: Number(
        selectedRow.totalAssociatedTargetEvents,
      ),
      totalAssociatedTargetBills: Number(selectedRow.totalAssociatedTargetBills),
      totalAssociatedUncoveredRows: Number(
        selectedRow.totalAssociatedUncoveredRows,
      ),
      marginalTargetEvents: Number(selectedRow.marginalTargetEvents),
      marginalUncoveredRows: Number(selectedRow.marginalUncoveredRows),
      requestAssociations: targets.length,
      uniqueRequestBills: new Set(targets.map((target) => target.billId)).size,
      earliestReferralDate: targets
        .map((target) => target.requestWindowStart)
        .sort()[0],
      latestTargetVoteDateExclusive: targets
        .map((target) => target.requestWindowEndExclusive)
        .sort()
        .at(-1),
      targets,
    });
  }

  requestGroups.sort(
    (a, b) => Number(a.rank) - Number(b.rank),
  );
  flatTargets.sort((a, b) =>
    a.rank - b.rank
    || a.committeeName.localeCompare(b.committeeName)
    || a.targetVoteDate.localeCompare(b.targetVoteDate)
    || a.identifier.localeCompare(b.identifier)
    || a.voteEventId.localeCompare(b.voteEventId));

  const uniqueEvents = new Set(flatTargets.map((row) => row.voteEventId));
  const uniqueBills = new Set(flatTargets.map((row) => row.billId));
  const recordingPages = requestGroups.reduce(
    (sum, row) => sum + Number(row.recordingPages),
    0,
  );
  const requestAssociationProofSha256 = setSha(
    flatTargets.map((row) =>
      [
        row.rank,
        row.committeeEventId,
        row.committeeName,
        row.voteEventId,
        row.identifier,
        row.requestWindowStart,
        row.requestWindowEndExclusive,
        row.uncoveredRows,
      ].join('|')),
  );

  if (
    requestGroups.length !== EXPECTED_COMMITTEES
    || flatTargets.length !== EXPECTED_TARGET_ASSOCIATIONS
    || uniqueEvents.size !== EXPECTED_UNIQUE_EVENTS
    || uniqueBills.size !== EXPECTED_UNIQUE_BILLS
    || recordingPages !== EXPECTED_RECORDING_PAGES
    || requestAssociationProofSha256 !== EXPECTED_REQUEST_ASSOCIATION_PROOF
  ) {
    throw new Error(
      'Senate print-minute request package drifted: '
      + JSON.stringify({
        committees: requestGroups.length,
        targetAssociations: flatTargets.length,
        uniqueEvents: uniqueEvents.size,
        uniqueBills: uniqueBills.size,
        recordingPages,
        requestAssociationProofSha256,
      }),
    );
  }

  const csvHeader = [
    'rank',
    'committee_event_id',
    'committee_name',
    'target_vote_event_id',
    'bill_id',
    'identifier',
    'referral_dates',
    'request_window_start',
    'request_window_end_exclusive',
    'uncovered_rows',
  ];
  const csvText = [
    csvHeader.join(','),
    ...flatTargets.map((row) => [
      row.rank,
      row.committeeEventId,
      row.committeeName,
      row.voteEventId,
      row.billId,
      row.identifier,
      row.referralDates.join(';'),
      row.requestWindowStart,
      row.requestWindowEndExclusive,
      row.uncoveredRows,
    ].map(csv).join(',')),
    '',
  ].join('\n');

  const markdownLines = [
    '# 2021 Minnesota Senate print committee-minute acquisition request',
    '',
    'This package is an acquisition/digitization scope only. It does not claim that a print minute exists for every listed target, that any minute contains member-level directional evidence, or that a referral/media record is itself evidence.',
    '',
    '## Requested records',
    '',
    'Please locate or digitize official 2021 Minnesota Senate print committee minutes for the committees below. For each listed target bill/event, the useful historical window begins on the first frozen Senate referral date shown and ends strictly before the target floor-vote date. If holdings cannot be searched by bill, committee minutes covering the union of the listed windows are useful; returned documents will be independently source-hashed and reviewed for bill/member attribution and strict pre-vote chronology.',
    '',
    `- Committees: **${requestGroups.length}**`,
    `- Committee-target associations: **${flatTargets.length}**`,
    `- Unique target events: **${uniqueEvents.size}**`,
    `- Unique target bills: **${uniqueBills.size}**`,
    `- LRL media recording pages in the selected committee groups: **${recordingPages}**`,
    `- Frozen uncovered-row opportunity represented by the priority selector: **${EXPECTED_SELECTED_UNCOVERED_ROWS}**`,
    '',
    '## Priority committees',
    '',
    '| Rank | Committee | LRL event ID | Recording pages | Target associations | Unique bills | Marginal target events | Marginal uncovered rows |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...requestGroups.map((row) =>
      `| ${row.rank} | ${row.committeeName} | ${row.committeeEventId} | ${row.recordingPages} | ${row.requestAssociations} | ${row.uniqueRequestBills} | ${row.marginalTargetEvents} | ${row.marginalUncoveredRows} |`),
    '',
    '## Target windows',
    '',
    ...requestGroups.flatMap((row) => [
      `### ${row.rank}. ${row.committeeName}`,
      '',
      ...row.targets.map((target: RequestTarget) =>
        `- **${target.identifier}** — referral ${target.referralDates.join(', ')}; request minute(s) from ${target.requestWindowStart} through **before ${target.requestWindowEndExclusive}**; target event \`${target.voteEventId}\`.`),
      '',
    ]),
    '## Handling boundary',
    '',
    '- Returned files are source material only until document identity/date, content bytes, bill/member attribution, and strict pre-vote availability are independently frozen.',
    '- No target vote outcomes are needed or authorized for acquisition or semantic review.',
    '- Do not infer a member stance from committee membership, referral, attendance, or the existence of a minute.',
    '- Do not write production feature/evidence rows from this request package.',
    '',
    `Request association proof: \`${requestAssociationProofSha256}\``,
    '',
  ];
  const markdownText = markdownLines.join('\n');

  const report = {
    schemaVersion:
      'historical-density-2021-senate-print-minute-request-package-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    source: {
      runId: SOURCE_RUN_ID,
      artifactId: SOURCE_ARTIFACT_ID,
      artifactDigest: SOURCE_ARTIFACT_DIGEST,
      sourceCommitSha: SOURCE_COMMIT_SHA,
      schemaVersion:
        'historical-density-2021-senate-print-minute-target-priority-v1',
      targetEventKeySha256: EXPECTED_TARGET_EVENT_PROOF,
      committeeGroupSha256: EXPECTED_COMMITTEE_SCOPE_PROOF,
      associationProofSha256: EXPECTED_ASSOCIATION_PROOF,
      priorityProofSha256: EXPECTED_PRIORITY_PROOF,
    },
    request: {
      committees: requestGroups.length,
      targetAssociations: flatTargets.length,
      uniqueTargetEvents: uniqueEvents.size,
      uniqueTargetBills: uniqueBills.size,
      selectedCommitteeRecordingPages: recordingPages,
      selectedUncoveredRows: EXPECTED_SELECTED_UNCOVERED_ROWS,
      requestAssociationProofSha256,
      groups: requestGroups,
    },
    outputs: {
      json: JSON_NAME,
      csv: CSV_NAME,
      markdown: MARKDOWN_NAME,
      csvSha256: sha256(csvText),
      markdownSha256: sha256(markdownText),
    },
    interpretation: {
      acquisitionOnly: true,
      requestDoesNotAssertMinuteExists: true,
      returnedMinuteDoesNotAutomaticallyBecomeEvidence: true,
      nextStep:
        'Acquire authoritative LRL print-minute files, freeze source/document identity and content hashes, then run outcome-blind bill/member/chronology review before any directional feature proposal.',
    },
    policy: {
      readOnly: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      currentMutableContentBackdated: false,
      memberStanceInferred: false,
      referralTreatedAsEvidence: false,
      mediaPresenceTreatedAsEvidence: false,
      printMinuteContentAcquired: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      modelWeightChanged: false,
      servingChanged: false,
      vercelUsed: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, JSON_NAME),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(resolve(outputDir, CSV_NAME), csvText, 'utf8');
  writeFileSync(resolve(outputDir, MARKDOWN_NAME), markdownText, 'utf8');

  console.log(JSON.stringify({
    senate2021PrintMinuteRequestPackage: {
      committees: report.request.committees,
      targetAssociations: report.request.targetAssociations,
      uniqueTargetEvents: report.request.uniqueTargetEvents,
      uniqueTargetBills: report.request.uniqueTargetBills,
      selectedCommitteeRecordingPages:
        report.request.selectedCommitteeRecordingPages,
      selectedUncoveredRows: report.request.selectedUncoveredRows,
      requestAssociationProofSha256,
      csvSha256: report.outputs.csvSha256,
      markdownSha256: report.outputs.markdownSha256,
      productionDatabaseQueried: false,
      targetVoteOutcomesRead: false,
      modelFitting: 'none',
    },
  }, null, 2));
}

main();
