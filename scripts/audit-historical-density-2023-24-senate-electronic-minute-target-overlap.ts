import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  discoverSenateCommitteeMinuteDocuments,
  type SenateCommitteeMinuteDocument,
} from '../src/evidence/minnesota-senate-committee-source.js';
import {
  buildRevisorRegularSessionStatusXmlUrls,
} from '../src/sources/minnesota/revisor-introduction.js';
import {
  fetchRevisorStatusXml,
  parseRevisorOfficialActions,
} from '../src/sources/minnesota/revisor-actions.js';

const ISSUE = 718;
const SESSION = '2023-2024';
const CHAMBER = 'senate';

const V18_ARTIFACT_ID = 11494634289;
const V18_ARTIFACT_DIGEST =
  'sha256:710bacebb4aeeafa60821a38ba376b6e321e785b7dc1d75aced92743859e9e29';
const V18_CANONICAL_SHA =
  '2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b';
const V18_GZIP_SHA =
  '42f9d79bd69df63b46a2f0f5c1636f4cc7f8fd0ec0a65ae905d85f28fd436700';
const ROW_KEY_SHA =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';

const EXPECTED_UNCOVERED_ROWS = 14471;
const EXPECTED_UNCOVERED_MEMBERSHIPS = 67;
const EXPECTED_UNCOVERED_EVENTS = 216;
const EXPECTED_UNCOVERED_BILLS = 141;
const EXPECTED_2023_ROWS = 8173;
const EXPECTED_2023_EVENTS = 122;
const EXPECTED_2023_BILLS = 83;
const EXPECTED_2024_ROWS = 6298;
const EXPECTED_2024_EVENTS = 94;
const EXPECTED_2024_BILLS = 60;
const EXPECTED_TARGET_EVENT_KEY_SHA256 =
  '504723315794c0471801b01bd8e0159e2bfa2dc900dbf7d8c095b4957c974672';
const EXPECTED_UNCOVERED_ROW_KEY_SHA256 =
  '6100ab06630e5f40723e35df8c6e68696318863c5823e095f7674c61e61412a7';

const EXPECTED_2023_COMMITTEE_PAGES = 22;
const EXPECTED_2023_MINUTE_DOCUMENTS = 454;
const EXPECTED_2024_COMMITTEE_PAGES = 23;
const EXPECTED_2024_MINUTE_DOCUMENTS = 258;
const EXPECTED_MINUTE_DOCUMENTS = 712;
const EXPECTED_MINUTE_COMMITTEES = 22;
const EXPECTED_MINUTE_UNIVERSE_PROOF =
  '870a0b5dd39535095ecddb614cf13b4d066aaf8107ec8bdf7ceb69bc1f5339b4';
const EXPECTED_REVISOR_STATUS_DOCUMENTS = 140;
const EXPECTED_REVISOR_FAILURE_IDENTIFIER = 'HF3769';
const EXPECTED_MATCHED_TARGET_EVENTS = 117;
const EXPECTED_MATCHED_UNCOVERED_ROWS = 7838;
const EXPECTED_CANDIDATE_MINUTE_DOCUMENTS = 436;
const EXPECTED_MINUTE_TARGET_ASSOCIATIONS = 1727;
const EXPECTED_ASSOCIATION_PROOF =
  'dbb3e5e4ce5191ec4fb47aa1f777f72067a3dca7fedefc0871ac41ed341adbf1';

const REVISOR_CONCURRENCY = 6;

type Json = Record<string, any>;
type MatrixRow = {
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  features: number[];
  reviewedApplicabilityFeatures: number[];
};
type TargetEvent = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  uncoveredRows: number;
};
type Referral = {
  occurredOn: string;
  committeeLabel: string;
  normalizedCommitteeLabel: string;
  description: string;
  statusUrl: string;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
function setSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
}
function nonzero(values: readonly number[]): boolean {
  return values.some((value) => value !== 0);
}
function normalizeCommittee(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replace(/\bcommittee\s+on\b/g, ' ')
    .replace(/^the\s+/g, '')
    .replace(/\s+committee$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function referralCommittee(input: {
  description: string;
  fields: Record<string, string>;
}): string | null {
  const explicit = input.fields.COMMITTEE_NAME?.trim()
    || input.fields.COMMITTEE?.trim();
  if (explicit) return explicit.replace(/\s+/g, ' ').trim();
  const patterns = [
    /\bre-referred\s+to\s+(?:the\s+)?(?:committee\s+on\s+)?(.+?)(?:[.;]|$)/i,
    /\bre-refer\s+to\s+(?:the\s+)?(?:committee\s+on\s+)?(.+?)(?:[.;]|$)/i,
    /\breferred\s+to\s+(?:the\s+)?(?:committee\s+on\s+)?(.+?)(?:[.;]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = input.description.match(pattern);
    if (match?.[1]?.trim()) return match[1].replace(/^the\s+/i, '').replace(/\s+/g, ' ').trim();
  }
  return null;
}
async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      out[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return out;
}
type StatusFetch =
  | { ok: true; identifier: string; statusUrl: string; xml: string }
  | { ok: false; identifier: string; failures: string[] };

async function fetchStatus(identifier: string): Promise<StatusFetch> {
  const failures: string[] = [];
  for (const url of buildRevisorRegularSessionStatusXmlUrls(SESSION, identifier)) {
    try {
      return {
        ok: true,
        identifier,
        statusUrl: url,
        xml: await fetchRevisorStatusXml(url),
      };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { ok: false, identifier, failures };
}

function loadTargets(): TargetEvent[] {
  const manifest = JSON.parse(
    readFileSync(env('VOTEPREDICT_EQ_V18_MANIFEST_PATH'), 'utf8'),
  ) as Json;
  const gzipBytes = readFileSync(env('VOTEPREDICT_EQ_V18_MATRIX_PATH'));
  if (
    manifest.schemaVersion
      !== 'evidence-quality-historical-feature-matrix-v1.8-manifest'
    || manifest.issue !== ISSUE
    || manifest.targetUniverse?.rows !== 135457
    || manifest.targetUniverse?.rowKeySha256 !== ROW_KEY_SHA
    || manifest.digests?.matrixCanonicalNdjsonSha256 !== V18_CANONICAL_SHA
    || manifest.digests?.matrixGzipSha256 !== V18_GZIP_SHA
    || manifest.policy?.targetVoteOutcomesRead !== false
    || manifest.policy?.productionDatabaseQueried !== false
    || manifest.policy?.productionWrites !== false
    || manifest.policy?.modelFitting !== 'none'
    || manifest.policy?.servingChanged !== false
    || sha256(gzipBytes) !== V18_GZIP_SHA
  ) {
    throw new Error('Immutable v1.8 historical matrix drifted');
  }
  const canonical = gunzipSync(gzipBytes).toString('utf8');
  if (sha256(canonical) !== V18_CANONICAL_SHA) {
    throw new Error('v1.8 canonical matrix digest mismatch');
  }

  const events = new Map<string, TargetEvent>();
  const rowKeys: string[] = [];
  const memberships = new Set<string>();
  for (const line of canonical.trimEnd().split('\n')) {
    const row = JSON.parse(line) as MatrixRow;
    if (row.session !== SESSION || row.chamber !== CHAMBER) continue;
    if (nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures)) continue;
    rowKeys.push(`${row.voteEventId}|${row.membershipId}`);
    memberships.add(row.membershipId);
    const prior = events.get(row.voteEventId);
    if (prior) {
      if (
        prior.billId !== row.billId
        || prior.identifier !== row.identifier
        || prior.occurredOn !== row.occurredOn
      ) {
        throw new Error(`Target-event identity drifted: ${row.voteEventId}`);
      }
      prior.uncoveredRows += 1;
    } else {
      events.set(row.voteEventId, {
        voteEventId: row.voteEventId,
        billId: row.billId,
        identifier: row.identifier,
        occurredOn: row.occurredOn,
        uncoveredRows: 1,
      });
    }
  }
  const targets = [...events.values()].sort((a, b) =>
    a.occurredOn.localeCompare(b.occurredOn)
    || a.identifier.localeCompare(b.identifier)
    || a.voteEventId.localeCompare(b.voteEventId));
  const bills = new Set(targets.map((row) => row.billId));
  const y23 = targets.filter((row) => row.occurredOn.startsWith('2023-'));
  const y24 = targets.filter((row) => row.occurredOn.startsWith('2024-'));
  const targetProof = setSha(
    targets.map((row) => [
      row.voteEventId,
      row.billId,
      row.identifier,
      row.occurredOn,
      row.uncoveredRows,
    ].join('|')),
  );
  if (
    rowKeys.length !== EXPECTED_UNCOVERED_ROWS
    || memberships.size !== EXPECTED_UNCOVERED_MEMBERSHIPS
    || targets.length !== EXPECTED_UNCOVERED_EVENTS
    || bills.size !== EXPECTED_UNCOVERED_BILLS
    || y23.reduce((sum, row) => sum + row.uncoveredRows, 0) !== EXPECTED_2023_ROWS
    || y23.length !== EXPECTED_2023_EVENTS
    || new Set(y23.map((row) => row.billId)).size !== EXPECTED_2023_BILLS
    || y24.reduce((sum, row) => sum + row.uncoveredRows, 0) !== EXPECTED_2024_ROWS
    || y24.length !== EXPECTED_2024_EVENTS
    || new Set(y24.map((row) => row.billId)).size !== EXPECTED_2024_BILLS
    || targetProof !== EXPECTED_TARGET_EVENT_KEY_SHA256
    || setSha(rowKeys) !== EXPECTED_UNCOVERED_ROW_KEY_SHA256
  ) {
    throw new Error('2023-24 Senate v1.8 target gap drifted');
  }
  return targets;
}

async function main(): Promise<void> {
  const output = resolve(
    process.env.VOTEPREDICT_SENATE_2023_24_MINUTE_OVERLAP_OUTPUT
      ?? 'tmp/historical-density-2023-24-senate-electronic-minute-target-overlap-v1.json',
  );
  const targets = loadTargets();

  const discoveries = await Promise.all(
    [2023, 2024].map(async (year) => ({
      year,
      ...(await discoverSenateCommitteeMinuteDocuments({ year })),
    })),
  );
  const documents = discoveries
    .flatMap((row) => row.documents)
    .sort((a, b) =>
      a.meetingDate.localeCompare(b.meetingDate)
      || a.committeeName.localeCompare(b.committeeName)
      || a.url.localeCompare(b.url));
  if (documents.length === 0) {
    throw new Error('Official 2023-24 Senate electronic-minute discovery returned zero documents');
  }

  const docsByCommittee = new Map<string, SenateCommitteeMinuteDocument[]>();
  for (const document of documents) {
    const key = normalizeCommittee(document.committeeName);
    const bucket = docsByCommittee.get(key) ?? [];
    bucket.push(document);
    docsByCommittee.set(key, bucket);
  }

  const identifiers = [...new Set(targets.map((row) => row.identifier))].sort();
  const statusResults = await mapLimit(
    identifiers,
    REVISOR_CONCURRENCY,
    fetchStatus,
  );
  const statuses = statusResults.filter(
    (row): row is Extract<StatusFetch, { ok: true }> => row.ok,
  );
  const statusFetchFailures = statusResults
    .filter((row): row is Extract<StatusFetch, { ok: false }> => !row.ok)
    .map((row) => ({
      identifier: row.identifier,
      failures: row.failures,
    }))
    .sort((a, b) => a.identifier.localeCompare(b.identifier));

  const referralsByIdentifier = new Map<string, Referral[]>();
  const unparsedReferrals: Json[] = [];
  for (const status of statuses) {
    const rows: Referral[] = [];
    for (const action of parseRevisorOfficialActions(status.xml)) {
      if (
        action.chamber !== CHAMBER
        || !action.occurredOn
        || !/^202[34]-/.test(action.occurredOn)
        || !/\brefer/i.test(action.description)
      ) {
        continue;
      }
      const committeeLabel = referralCommittee({
        description: action.description,
        fields: action.fields,
      });
      if (!committeeLabel) {
        unparsedReferrals.push({
          identifier: status.identifier,
          occurredOn: action.occurredOn,
          description: action.description,
          statusUrl: status.statusUrl,
        });
        continue;
      }
      rows.push({
        occurredOn: action.occurredOn,
        committeeLabel,
        normalizedCommitteeLabel: normalizeCommittee(committeeLabel),
        description: action.description,
        statusUrl: status.statusUrl,
      });
    }
    referralsByIdentifier.set(
      status.identifier,
      rows.sort((a, b) =>
        a.occurredOn.localeCompare(b.occurredOn)
        || a.normalizedCommitteeLabel.localeCompare(b.normalizedCommitteeLabel)
        || a.description.localeCompare(b.description)),
    );
  }

  const unmatchedLabels = new Map<string, {
    label: string;
    identifiers: Set<string>;
  }>();
  const associations: Json[] = [];
  const targetsWithReferral = new Set<string>();
  const targetsWithMatchedCommittee = new Set<string>();
  const targetsWithMinuteCandidates = new Set<string>();
  const candidateDocs = new Set<string>();

  for (const target of targets) {
    const referrals = (referralsByIdentifier.get(target.identifier) ?? [])
      .filter((row) => row.occurredOn < target.occurredOn);
    if (referrals.length > 0) targetsWithReferral.add(target.voteEventId);

    for (const referral of referrals) {
      const committeeDocs =
        docsByCommittee.get(referral.normalizedCommitteeLabel) ?? [];
      if (committeeDocs.length === 0) {
        const prior = unmatchedLabels.get(referral.normalizedCommitteeLabel) ?? {
          label: referral.committeeLabel,
          identifiers: new Set<string>(),
        };
        prior.identifiers.add(target.identifier);
        unmatchedLabels.set(referral.normalizedCommitteeLabel, prior);
        continue;
      }
      targetsWithMatchedCommittee.add(target.voteEventId);

      const eligible = committeeDocs.filter(
        (document) =>
          referral.occurredOn <= document.meetingDate
          && document.meetingDate < target.occurredOn,
      );
      if (eligible.length > 0) targetsWithMinuteCandidates.add(target.voteEventId);

      for (const document of eligible) {
        candidateDocs.add(document.url);
        associations.push({
          voteEventId: target.voteEventId,
          billId: target.billId,
          identifier: target.identifier,
          targetVoteDate: target.occurredOn,
          uncoveredRows: target.uncoveredRows,
          referralDate: referral.occurredOn,
          referralCommittee: referral.committeeLabel,
          normalizedCommittee: referral.normalizedCommitteeLabel,
          minuteMeetingDate: document.meetingDate,
          minuteCommitteeName: document.committeeName,
          minuteUrl: document.url,
        });
      }
    }
  }

  associations.sort((a, b) =>
    String(a.targetVoteDate).localeCompare(String(b.targetVoteDate))
    || String(a.identifier).localeCompare(String(b.identifier))
    || String(a.minuteMeetingDate).localeCompare(String(b.minuteMeetingDate))
    || String(a.minuteUrl).localeCompare(String(b.minuteUrl)));

  const matchedRows = targets
    .filter((row) => targetsWithMinuteCandidates.has(row.voteEventId))
    .reduce((sum, row) => sum + row.uncoveredRows, 0);
  const documentUniverseProofSha256 = setSha(
    documents.map((row) =>
      [row.year, row.committeeName, row.meetingDate, row.url].join('|')),
  );
  const associationProofSha256 = setSha(
    associations.map((row) => [
      row.voteEventId,
      row.identifier,
      row.targetVoteDate,
      row.referralDate,
      row.normalizedCommittee,
      row.minuteMeetingDate,
      row.minuteUrl,
    ].join('|')),
  );

  if (
    discoveries[0]?.committeePages !== EXPECTED_2023_COMMITTEE_PAGES
    || discoveries[0]?.documents.length !== EXPECTED_2023_MINUTE_DOCUMENTS
    || discoveries[1]?.committeePages !== EXPECTED_2024_COMMITTEE_PAGES
    || discoveries[1]?.documents.length !== EXPECTED_2024_MINUTE_DOCUMENTS
    || documents.length !== EXPECTED_MINUTE_DOCUMENTS
    || docsByCommittee.size !== EXPECTED_MINUTE_COMMITTEES
    || documentUniverseProofSha256 !== EXPECTED_MINUTE_UNIVERSE_PROOF
    || statuses.length !== EXPECTED_REVISOR_STATUS_DOCUMENTS
    || statusFetchFailures.length !== 1
    || statusFetchFailures[0]?.identifier !== EXPECTED_REVISOR_FAILURE_IDENTIFIER
    || unparsedReferrals.length !== 0
    || unmatchedLabels.size !== 0
    || targetsWithReferral.size !== EXPECTED_MATCHED_TARGET_EVENTS
    || targetsWithMatchedCommittee.size !== EXPECTED_MATCHED_TARGET_EVENTS
    || targetsWithMinuteCandidates.size !== EXPECTED_MATCHED_TARGET_EVENTS
    || matchedRows !== EXPECTED_MATCHED_UNCOVERED_ROWS
    || candidateDocs.size !== EXPECTED_CANDIDATE_MINUTE_DOCUMENTS
    || associations.length !== EXPECTED_MINUTE_TARGET_ASSOCIATIONS
    || associationProofSha256 !== EXPECTED_ASSOCIATION_PROOF
  ) {
    throw new Error('Pinned 2023-24 Senate electronic-minute overlap drifted');
  }

  const committeeSummary = [...docsByCommittee.entries()]
    .map(([normalizedCommittee, rows]) => ({
      normalizedCommittee,
      committeeNames: [...new Set(rows.map((row) => row.committeeName))].sort(),
      documents: rows.length,
      candidateAssociations: associations.filter(
        (row) => row.normalizedCommittee === normalizedCommittee,
      ).length,
      candidateTargetEvents: new Set(
        associations
          .filter((row) => row.normalizedCommittee === normalizedCommittee)
          .map((row) => row.voteEventId),
      ).size,
    }))
    .filter((row) => row.candidateAssociations > 0)
    .sort((a, b) =>
      b.candidateTargetEvents - a.candidateTargetEvents
      || b.candidateAssociations - a.candidateAssociations
      || a.normalizedCommittee.localeCompare(b.normalizedCommittee));

  const report = {
    schemaVersion:
      'historical-density-2023-24-senate-electronic-minute-target-overlap-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    frozenInput: {
      historicalFeatureMatrixV18: {
        artifactId: V18_ARTIFACT_ID,
        artifactDigest: V18_ARTIFACT_DIGEST,
        matrixCanonicalNdjsonSha256: V18_CANONICAL_SHA,
        matrixGzipSha256: V18_GZIP_SHA,
        rowKeySha256: ROW_KEY_SHA,
      },
    },
    targetGap: {
      session: SESSION,
      chamber: CHAMBER,
      uncoveredRows: EXPECTED_UNCOVERED_ROWS,
      memberships: EXPECTED_UNCOVERED_MEMBERSHIPS,
      targetEvents: EXPECTED_UNCOVERED_EVENTS,
      bills: EXPECTED_UNCOVERED_BILLS,
      byYear: {
        2023: {
          uncoveredRows: EXPECTED_2023_ROWS,
          targetEvents: EXPECTED_2023_EVENTS,
          bills: EXPECTED_2023_BILLS,
        },
        2024: {
          uncoveredRows: EXPECTED_2024_ROWS,
          targetEvents: EXPECTED_2024_EVENTS,
          bills: EXPECTED_2024_BILLS,
        },
      },
      targetEventKeySha256: EXPECTED_TARGET_EVENT_KEY_SHA256,
      uncoveredRowKeySha256: EXPECTED_UNCOVERED_ROW_KEY_SHA256,
    },
    officialMinuteUniverse: {
      byYear: discoveries.map((row) => ({
        year: row.year,
        committeePages: row.committeePages,
        documents: row.documents.length,
      })),
      totalDocuments: documents.length,
      committees: docsByCommittee.size,
      documentUniverseProofSha256,
    },
    revisor: {
      requestedTargetBillStatusDocuments: identifiers.length,
      targetBillStatusDocuments: statuses.length,
      statusFetchFailures,
      unparsedReferralActions: unparsedReferrals,
      unmatchedCommitteeLabels: [...unmatchedLabels.entries()]
        .map(([normalized, row]) => ({
          normalized,
          label: row.label,
          identifiers: [...row.identifiers].sort(),
        }))
        .sort((a, b) => a.normalized.localeCompare(b.normalized)),
    },
    overlap: {
      targetEventsWithPreVoteReferral: targetsWithReferral.size,
      targetEventsWithMatchedCommittee: targetsWithMatchedCommittee.size,
      targetEventsWithChronologicallyEligibleMinute: targetsWithMinuteCandidates.size,
      matchedUncoveredRows: matchedRows,
      uniqueCandidateMinuteDocuments: candidateDocs.size,
      minuteTargetAssociations: associations.length,
      associationProofSha256,
      committeeSummary,
      associations,
    },
    interpretation: {
      electronicMinutesAvailable: true,
      minuteBodyFetched: false,
      minuteBodyParsed: false,
      committeeReferralTreatedAsEvidence: false,
      minuteExistenceTreatedAsEvidence: false,
      candidateAssociationMeaning:
        'A candidate association means only that an official LRL Senate minute PDF exists for the referred committee on/after the referral date and strictly before the target vote date.',
      nextStep:
        'Freeze a bounded candidate PDF set, verify exact bytes/text, then perform outcome-blind bill/member semantic review. Do not infer directional evidence from referral, committee membership, or minute existence.',
    },
    policy: {
      readOnly: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      pdfBodiesFetched: false,
      memberStanceInferred: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      modelWeightChanged: false,
      servingChanged: false,
      vercelUsed: false,
    },
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    senate2023_24ElectronicMinuteOverlap: {
      targetGap: report.targetGap,
      officialMinuteUniverse: report.officialMinuteUniverse,
      revisor: {
        requestedTargetBillStatusDocuments: identifiers.length,
        targetBillStatusDocuments: statuses.length,
        statusFetchFailures: statusFetchFailures.length,
        unparsedReferralActions: unparsedReferrals.length,
        unmatchedCommitteeLabels: report.revisor.unmatchedCommitteeLabels.length,
      },
      overlap: {
        targetEventsWithPreVoteReferral: targetsWithReferral.size,
        targetEventsWithMatchedCommittee: targetsWithMatchedCommittee.size,
        targetEventsWithChronologicallyEligibleMinute: targetsWithMinuteCandidates.size,
        matchedUncoveredRows: matchedRows,
        uniqueCandidateMinuteDocuments: candidateDocs.size,
        minuteTargetAssociations: associations.length,
        associationProofSha256,
      },
      targetVoteOutcomesRead: false,
      pdfBodiesFetched: false,
      productionDatabaseQueried: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
