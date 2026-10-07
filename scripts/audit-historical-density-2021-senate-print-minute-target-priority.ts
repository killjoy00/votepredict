import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildRevisorRegularSessionStatusXmlUrls,
} from '../src/sources/minnesota/revisor-introduction.js';
import {
  fetchRevisorStatusXml,
  parseRevisorOfficialActions,
} from '../src/sources/minnesota/revisor-actions.js';
import {
  discoverSenateMediaRecordingPages,
  type SenateMediaEvent,
} from '../src/evidence/minnesota-senate-media-archive.js';

const ISSUE = 718;
const SESSION = '2021-2022';
const CHAMBER = 'senate';
const MEDIA_YEAR = 2021;

const V18_ARTIFACT_ID = 11494634289;
const V18_ARTIFACT_DIGEST =
  'sha256:710bacebb4aeeafa60821a38ba376b6e321e785b7dc1d75aced92743859e9e29';
const V18_CANONICAL_SHA =
  '2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b';
const V18_GZIP_SHA =
  '42f9d79bd69df63b46a2f0f5c1636f4cc7f8fd0ec0a65ae905d85f28fd436700';
const ROW_KEY_SHA =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';

const EXPECTED_UNCOVERED_ROWS = 14600;
const EXPECTED_UNCOVERED_MEMBERSHIPS = 67;
const EXPECTED_UNCOVERED_EVENTS = 218;
const EXPECTED_UNCOVERED_BILLS = 176;
const EXPECTED_2021_TARGET_EVENTS = 82;
const EXPECTED_2022_TARGET_EVENTS = 136;

const EXPECTED_MEDIA_EVENTS = 33;
const EXPECTED_MEDIA_RECORDINGS = 621;
const EXPECTED_COMMITTEE_GROUPS = 30;
const PRIORITY_COMMITTEES = 10;
const REVISOR_CONCURRENCY = 6;

type Json = Record<string, any>;

type MatrixRow = {
  schemaVersion: string;
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  eventStatus: string;
  features: number[];
  reviewedApplicabilityFeatures: number[];
  reviewedApplicability: null | Record<string, unknown>;
};

type TargetEvent = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  uncoveredRows: number;
  rowKeys: string[];
};

type Referral = {
  occurredOn: string;
  committeeLabel: string;
  normalizedCommitteeLabel: string;
  description: string;
  statusUrl: string;
};

type CommitteeTarget = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  uncoveredRows: number;
  referralDates: string[];
  referralDescriptions: string[];
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

function categoryHint(
  eventName: string,
): 'floor' | 'conference' | 'press_or_special' | 'committee_or_other' {
  const value = eventName.toLowerCase();
  if (value.includes('floor session')) return 'floor';
  if (value.includes('conference committee')) return 'conference';
  if (
    value.includes('press conference')
    || value.includes('capitol report')
    || value.includes('special event')
  ) {
    return 'press_or_special';
  }
  return 'committee_or_other';
}

function normalizeCommittee(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replace(/\bcommittee\s+on\b/g, ' ')
    .replace(/^the\s+/g, '')
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
    if (!match) continue;
    const label = match[1]
      .replace(/^the\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (label) return label;
  }
  return null;
}

async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      output[index] = await mapper(values[index]!, index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return output;
}

async function fetchStatus(identifier: string): Promise<{
  identifier: string;
  statusUrl: string;
  xml: string;
}> {
  const urls = buildRevisorRegularSessionStatusXmlUrls(SESSION, identifier);
  const failures: string[] = [];
  for (const url of urls) {
    try {
      const xml = await fetchRevisorStatusXml(url);
      return { identifier, statusUrl: url, xml };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(
    `No Revisor status document for ${identifier}: ${failures.join(' | ')}`,
  );
}

function mainMatrix(): {
  rows: MatrixRow[];
  targetEvents: TargetEvent[];
} {
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
    || manifest.coverage?.combinedNonzeroRows !== 92
    || manifest.coverage?.bySession?.[SESSION]?.combinedNonzeroRows !== 9
    || manifest.digests?.matrixCanonicalNdjsonSha256 !== V18_CANONICAL_SHA
    || manifest.digests?.matrixGzipSha256 !== V18_GZIP_SHA
    || manifest.policy?.outcomeUseDuringFeatureConstruction !== 'none'
    || manifest.policy?.targetVoteOutcomesRead !== false
    || manifest.policy?.productionDatabaseQueried !== false
    || manifest.policy?.productionWrites !== false
    || manifest.policy?.vercelUsed !== false
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

  const rows = canonical
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as MatrixRow);
  if (
    rows.length !== 135457
    || setSha(rows.map((row) => `${row.voteEventId}|${row.membershipId}`))
      !== ROW_KEY_SHA
  ) {
    throw new Error('v1.8 target universe drifted');
  }

  const byEvent = new Map<string, TargetEvent>();
  const uncoveredMemberships = new Set<string>();

  for (const row of rows) {
    if (row.session !== SESSION || row.chamber !== CHAMBER) continue;
    if (nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures)) {
      continue;
    }

    uncoveredMemberships.add(row.membershipId);
    const rowKey = `${row.voteEventId}|${row.membershipId}`;
    const existing = byEvent.get(row.voteEventId);
    if (existing) {
      if (
        existing.billId !== row.billId
        || existing.identifier !== row.identifier
        || existing.occurredOn !== row.occurredOn
      ) {
        throw new Error(`Target event identity drifted: ${row.voteEventId}`);
      }
      existing.uncoveredRows += 1;
      existing.rowKeys.push(rowKey);
    } else {
      byEvent.set(row.voteEventId, {
        voteEventId: row.voteEventId,
        billId: row.billId,
        identifier: row.identifier,
        occurredOn: row.occurredOn,
        uncoveredRows: 1,
        rowKeys: [rowKey],
      });
    }
  }

  const targetEvents = [...byEvent.values()]
    .map((event) => ({
      ...event,
      rowKeys: event.rowKeys.sort(),
    }))
    .sort((a, b) =>
      a.occurredOn.localeCompare(b.occurredOn)
      || a.identifier.localeCompare(b.identifier)
      || a.voteEventId.localeCompare(b.voteEventId));

  const uncoveredRows = targetEvents.reduce(
    (sum, event) => sum + event.uncoveredRows,
    0,
  );
  const bills = new Set(targetEvents.map((event) => event.billId));
  const yearCounts = Object.fromEntries(
    ['2021', '2022'].map((year) => [
      year,
      targetEvents.filter((event) => event.occurredOn.startsWith(year)).length,
    ]),
  );

  if (
    uncoveredRows !== EXPECTED_UNCOVERED_ROWS
    || uncoveredMemberships.size !== EXPECTED_UNCOVERED_MEMBERSHIPS
    || targetEvents.length !== EXPECTED_UNCOVERED_EVENTS
    || bills.size !== EXPECTED_UNCOVERED_BILLS
    || yearCounts['2021'] !== EXPECTED_2021_TARGET_EVENTS
    || yearCounts['2022'] !== EXPECTED_2022_TARGET_EVENTS
  ) {
    throw new Error(
      `2021-22 Senate v1.8 gap drifted: ${JSON.stringify({
        uncoveredRows,
        memberships: uncoveredMemberships.size,
        events: targetEvents.length,
        bills: bills.size,
        yearCounts,
      })}`,
    );
  }

  return { rows, targetEvents };
}

async function main(): Promise<void> {
  const output = resolve(
    process.env.VOTEPREDICT_SENATE_2021_MINUTE_PRIORITY_OUTPUT
      ?? 'tmp/historical-density-2021-senate-print-minute-target-priority-v1.json',
  );

  const { targetEvents } = mainMatrix();

  const media = await discoverSenateMediaRecordingPages({
    year: MEDIA_YEAR,
    concurrency: 5,
  });
  const committeeEvents = media.events
    .filter((event) => categoryHint(event.name) === 'committee_or_other')
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  if (
    media.events.length !== EXPECTED_MEDIA_EVENTS
    || media.recordings.length !== EXPECTED_MEDIA_RECORDINGS
    || media.eventFailures.length !== 0
    || committeeEvents.length !== EXPECTED_COMMITTEE_GROUPS
  ) {
    throw new Error(
      `2021 LRL media acquisition scope drifted: ${JSON.stringify({
        events: media.events.length,
        recordings: media.recordings.length,
        failures: media.eventFailures.length,
        committeeGroups: committeeEvents.length,
      })}`,
    );
  }

  const mediaByNormalized = new Map<string, SenateMediaEvent[]>();
  for (const event of committeeEvents) {
    const key = normalizeCommittee(event.name);
    const group = mediaByNormalized.get(key) ?? [];
    group.push(event);
    mediaByNormalized.set(key, group);
  }

  const targetEventsByIdentifier = new Map<string, TargetEvent[]>();
  for (const event of targetEvents) {
    const group = targetEventsByIdentifier.get(event.identifier) ?? [];
    group.push(event);
    targetEventsByIdentifier.set(event.identifier, group);
  }
  const identifiers = [...targetEventsByIdentifier.keys()].sort();

  const statuses = await mapLimit(
    identifiers,
    REVISOR_CONCURRENCY,
    async (identifier) => fetchStatus(identifier),
  );

  const referralsByIdentifier = new Map<string, Referral[]>();
  const referDescriptionsWithoutParsedCommittee: Array<{
    identifier: string;
    occurredOn: string | null;
    description: string;
    statusUrl: string;
  }> = [];

  for (const status of statuses) {
    const referrals: Referral[] = [];
    for (const action of parseRevisorOfficialActions(status.xml)) {
      if (
        action.chamber !== CHAMBER
        || !action.occurredOn
        || !action.occurredOn.startsWith('2021-')
        || !/\brefer/i.test(action.description)
      ) {
        continue;
      }

      const committeeLabel = referralCommittee({
        description: action.description,
        fields: action.fields,
      });
      if (!committeeLabel) {
        referDescriptionsWithoutParsedCommittee.push({
          identifier: status.identifier,
          occurredOn: action.occurredOn,
          description: action.description,
          statusUrl: status.statusUrl,
        });
        continue;
      }

      referrals.push({
        occurredOn: action.occurredOn,
        committeeLabel,
        normalizedCommitteeLabel: normalizeCommittee(committeeLabel),
        description: action.description,
        statusUrl: status.statusUrl,
      });
    }

    referralsByIdentifier.set(
      status.identifier,
      referrals.sort((a, b) =>
        a.occurredOn.localeCompare(b.occurredOn)
        || a.normalizedCommitteeLabel.localeCompare(b.normalizedCommitteeLabel)
        || a.description.localeCompare(b.description)),
    );
  }

  const unmatchedReferralLabels = new Map<string, {
    label: string;
    normalized: string;
    identifiers: Set<string>;
    descriptions: Set<string>;
  }>();

  const committeeTargets = new Map<string, {
    eventId: string;
    eventName: string;
    recordingPages: number;
    targets: Map<string, CommitteeTarget>;
  }>();

  for (const target of targetEvents) {
    const referrals = referralsByIdentifier.get(target.identifier) ?? [];
    for (const referral of referrals) {
      if (!(referral.occurredOn < target.occurredOn)) continue;

      const matches = mediaByNormalized.get(referral.normalizedCommitteeLabel) ?? [];
      if (matches.length !== 1) {
        const prior = unmatchedReferralLabels.get(referral.normalizedCommitteeLabel) ?? {
          label: referral.committeeLabel,
          normalized: referral.normalizedCommitteeLabel,
          identifiers: new Set<string>(),
          descriptions: new Set<string>(),
        };
        prior.identifiers.add(target.identifier);
        prior.descriptions.add(referral.description);
        unmatchedReferralLabels.set(referral.normalizedCommitteeLabel, prior);
        continue;
      }

      const mediaEvent = matches[0]!;
      const recordingPages = media.recordings.filter(
        (recording) => recording.eventId === mediaEvent.id,
      ).length;
      const bucket = committeeTargets.get(mediaEvent.id) ?? {
        eventId: mediaEvent.id,
        eventName: mediaEvent.name,
        recordingPages,
        targets: new Map<string, CommitteeTarget>(),
      };
      const existing = bucket.targets.get(target.voteEventId);
      if (existing) {
        existing.referralDates = [
          ...new Set([...existing.referralDates, referral.occurredOn]),
        ].sort();
        existing.referralDescriptions = [
          ...new Set([...existing.referralDescriptions, referral.description]),
        ].sort();
      } else {
        bucket.targets.set(target.voteEventId, {
          voteEventId: target.voteEventId,
          billId: target.billId,
          identifier: target.identifier,
          occurredOn: target.occurredOn,
          uncoveredRows: target.uncoveredRows,
          referralDates: [referral.occurredOn],
          referralDescriptions: [referral.description],
        });
      }
      committeeTargets.set(mediaEvent.id, bucket);
    }
  }

  const candidates = [...committeeTargets.values()]
    .map((bucket) => {
      const targets = [...bucket.targets.values()].sort((a, b) =>
        a.occurredOn.localeCompare(b.occurredOn)
        || a.identifier.localeCompare(b.identifier)
        || a.voteEventId.localeCompare(b.voteEventId));
      return {
        eventId: bucket.eventId,
        eventName: bucket.eventName,
        recordingPages: bucket.recordingPages,
        targetEvents: targets.length,
        targetBills: new Set(targets.map((target) => target.billId)).size,
        uncoveredRows: targets.reduce(
          (sum, target) => sum + target.uncoveredRows,
          0,
        ),
        targets,
      };
    })
    .sort((a, b) =>
      b.uncoveredRows - a.uncoveredRows
      || b.targetEvents - a.targetEvents
      || a.eventName.localeCompare(b.eventName));

  const selected: Array<Json> = [];
  const coveredTargetEvents = new Set<string>();

  for (let rank = 1; rank <= Math.min(PRIORITY_COMMITTEES, candidates.length); rank += 1) {
    const remaining = candidates
      .filter((candidate) =>
        !selected.some((chosen) => chosen.eventId === candidate.eventId))
      .map((candidate) => {
        const marginalTargets = candidate.targets.filter(
          (target) => !coveredTargetEvents.has(target.voteEventId),
        );
        return {
          candidate,
          marginalTargets,
          marginalRows: marginalTargets.reduce(
            (sum, target) => sum + target.uncoveredRows,
            0,
          ),
        };
      })
      .filter((entry) => entry.marginalRows > 0)
      .sort((a, b) =>
        b.marginalRows - a.marginalRows
        || b.marginalTargets.length - a.marginalTargets.length
        || a.candidate.eventName.localeCompare(b.candidate.eventName));

    const next = remaining[0];
    if (!next) break;

    for (const target of next.marginalTargets) {
      coveredTargetEvents.add(target.voteEventId);
    }
    selected.push({
      rank,
      eventId: next.candidate.eventId,
      eventName: next.candidate.eventName,
      recordingPages: next.candidate.recordingPages,
      totalAssociatedTargetEvents: next.candidate.targetEvents,
      totalAssociatedTargetBills: next.candidate.targetBills,
      totalAssociatedUncoveredRows: next.candidate.uncoveredRows,
      marginalTargetEvents: next.marginalTargets.length,
      marginalUncoveredRows: next.marginalRows,
      cumulativeTargetEvents: coveredTargetEvents.size,
      cumulativeUncoveredRows: targetEvents
        .filter((target) => coveredTargetEvents.has(target.voteEventId))
        .reduce((sum, target) => sum + target.uncoveredRows, 0),
    });
  }

  const matchedTargetEvents = new Set(
    candidates.flatMap((candidate) =>
      candidate.targets.map((target) => target.voteEventId)),
  );
  const matchedRows = targetEvents
    .filter((target) => matchedTargetEvents.has(target.voteEventId))
    .reduce((sum, target) => sum + target.uncoveredRows, 0);
  const selectedRows = targetEvents
    .filter((target) => coveredTargetEvents.has(target.voteEventId))
    .reduce((sum, target) => sum + target.uncoveredRows, 0);

  const associationLines = candidates.flatMap((candidate) =>
    candidate.targets.map((target) =>
      [
        candidate.eventId,
        candidate.eventName,
        target.voteEventId,
        target.identifier,
        target.occurredOn,
        target.uncoveredRows,
        target.referralDates.join(','),
      ].join('|')));

  const report = {
    schemaVersion:
      'historical-density-2021-senate-print-minute-target-priority-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    frozenInputs: {
      historicalFeatureMatrixV18: {
        artifactId: V18_ARTIFACT_ID,
        artifactDigest: V18_ARTIFACT_DIGEST,
        matrixCanonicalNdjsonSha256: V18_CANONICAL_SHA,
        matrixGzipSha256: V18_GZIP_SHA,
        rowKeySha256: ROW_KEY_SHA,
      },
      priorSenateMinuteScope: {
        sourceRunId: 37036808817,
        sourceCommitSha: '82804708c867ebb8396386605ac0e2c8ae987ef8',
        officialMediaEventGroups: EXPECTED_MEDIA_EVENTS,
        officialCommitteeOrOtherGroups: EXPECTED_COMMITTEE_GROUPS,
        uniqueRecordingPages: EXPECTED_MEDIA_RECORDINGS,
      },
    },
    targetGap: {
      session: SESSION,
      chamber: CHAMBER,
      uncoveredRows: EXPECTED_UNCOVERED_ROWS,
      memberships: EXPECTED_UNCOVERED_MEMBERSHIPS,
      targetEvents: EXPECTED_UNCOVERED_EVENTS,
      bills: EXPECTED_UNCOVERED_BILLS,
      eventYearCounts: {
        2021: EXPECTED_2021_TARGET_EVENTS,
        2022: EXPECTED_2022_TARGET_EVENTS,
      },
      targetEventKeySha256: setSha(
        targetEvents.map((target) =>
          [
            target.voteEventId,
            target.billId,
            target.identifier,
            target.occurredOn,
            target.uncoveredRows,
          ].join('|')),
      ),
    },
    lrlScope: {
      year: MEDIA_YEAR,
      totalEventGroups: media.events.length,
      committeeOrOtherGroups: committeeEvents.length,
      uniqueRecordingPages: media.recordings.length,
      eventFailures: media.eventFailures,
      committeeGroupSha256: setSha(
        committeeEvents.map((event) =>
          `${event.id}|${event.name}|${media.recordings.filter(
            (recording) => recording.eventId === event.id,
          ).length}`),
      ),
      committeeGroups: committeeEvents.map((event) => ({
        eventId: event.id,
        eventName: event.name,
        recordingPages: media.recordings.filter(
          (recording) => recording.eventId === event.id,
        ).length,
      })),
    },
    revisor: {
      targetBillStatusDocuments: statuses.length,
      fetchFailures: 0,
      referralDescriptionsWithoutParsedCommittee:
        referDescriptionsWithoutParsedCommittee,
      unmatchedReferralLabels: [...unmatchedReferralLabels.values()]
        .map((row) => ({
          label: row.label,
          normalized: row.normalized,
          identifiers: [...row.identifiers].sort(),
          descriptions: [...row.descriptions].sort(),
        }))
        .sort((a, b) => a.normalized.localeCompare(b.normalized)),
    },
    acquisitionCandidates: {
      committeesWithMatchedPreVoteReferrals: candidates.length,
      matchedTargetEvents: matchedTargetEvents.size,
      matchedUncoveredRows: matchedRows,
      associationProofSha256: setSha(associationLines),
      committees: candidates,
    },
    priority: {
      requestedCommitteeCount: PRIORITY_COMMITTEES,
      selectedCommitteeCount: selected.length,
      selectedTargetEvents: coveredTargetEvents.size,
      selectedUncoveredRows: selectedRows,
      selected,
    },
    interpretation: {
      sourceBoundary:
        'Official 2021 Senate print minutes are held by LRL but no systematic official electronic minute corpus is exposed for 2021.',
      acquisitionOnly: true,
      mediaEventPresenceDoesNotProveMinuteExists: true,
      revisorReferralDoesNotProveMinuteExists: true,
      minuteExistenceDoesNotProveMemberDirectionalEvidence: true,
      nextStep:
        'Use the priority list only to scope an authoritative LRL print-minute request/digitization pass. Any acquired minute must independently freeze document identity, date, bytes/text, bill/member attribution, and strict pre-vote availability before semantic review.',
    },
    policy: {
      readOnly: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      targetVoteOutcomesRead: false,
      outcomeUse: 'none',
      currentMutableContentBackdated: false,
      memberStanceInferred: false,
      committeeReferralTreatedAsEvidence: false,
      mediaPresenceTreatedAsEvidence: false,
      printMinuteContentAcquired: false,
      featureRowsWritten: false,
      modelFitting: 'none',
      modelWeightChanged: false,
      servingChanged: false,
      vercelUsed: false,
    },
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2021SenatePrintMinuteTargetPriority: {
      targetGap: report.targetGap,
      lrlScope: {
        totalEventGroups: report.lrlScope.totalEventGroups,
        committeeOrOtherGroups: report.lrlScope.committeeOrOtherGroups,
        uniqueRecordingPages: report.lrlScope.uniqueRecordingPages,
        committeeGroupSha256: report.lrlScope.committeeGroupSha256,
      },
      revisor: {
        targetBillStatusDocuments: report.revisor.targetBillStatusDocuments,
        referralDescriptionsWithoutParsedCommittee:
          report.revisor.referralDescriptionsWithoutParsedCommittee.length,
        unmatchedReferralLabels: report.revisor.unmatchedReferralLabels.length,
      },
      acquisitionCandidates: {
        committeesWithMatchedPreVoteReferrals:
          report.acquisitionCandidates.committeesWithMatchedPreVoteReferrals,
        matchedTargetEvents: report.acquisitionCandidates.matchedTargetEvents,
        matchedUncoveredRows: report.acquisitionCandidates.matchedUncoveredRows,
        associationProofSha256:
          report.acquisitionCandidates.associationProofSha256,
      },
      priority: report.priority,
      productionDatabaseQueried: false,
      targetVoteOutcomesRead: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
