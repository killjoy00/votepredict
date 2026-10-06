import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST,
  HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256,
  selectHouseAttachmentArchiveRetryCandidates,
  type HouseAttachmentArchiveProbeFrozenReport,
  houseAttachmentArchiveProbeDiscoveryFrom,
  houseAttachmentArchiveProbeTargetKey,
  houseAttachmentCaptureOpportunity,
  validateHouseAttachmentDensityPilot,
  type HouseAttachmentArchiveProbeTarget,
} from '../src/evidence/house-attachment-historical-density-archive-probe.js';
import type { HouseAttachmentHistoricalDensityPilotRow } from '../src/evidence/house-attachment-historical-density-selector.js';

function candidate(index: number, count: number): HouseAttachmentHistoricalDensityPilotRow {
  const bill = 'bill-' + index;
  const identifier = 'HF' + (1000 + index);
  const overlapRowKeys = Array.from({ length: count }, (_, i) => 'vote-' + index + '-' + i + '|member-' + index + '-' + i);
  return {
    attachmentUrl: 'https://www.house.mn.gov/comm/docs/test-' + index + '.pdf',
    attachmentNames: ['Test ' + index + '.pdf'],
    attachmentKinds: ['testimony_handout'],
    archiveEvidenceIds: ['evidence-' + index],
    billIds: [bill],
    billIdentifiers: [identifier],
    firstOfficialPostedOn: '2021-02-01',
    lastOfficialPostedOn: '2021-02-01',
    priorWaybackPdf: false,
    priorWaybackScan: false,
    currentBodyPresent: false,
    selectableFreshSurface: true,
    valueTier: 1,
    valueTierReason: 'test',
    overlapRowKeys,
    overlapRows: count,
    overlapEvents: count,
    overlapMemberships: count,
    overlapBillIds: [bill],
    overlapBillIdentifiers: [identifier],
    firstTargetVoteOn: '2021-03-01',
    lastTargetVoteOn: '2021-05-01',
    marginalRows: count,
    cumulativeRows: count,
    marginalEvents: count,
    cumulativeEvents: count,
  };
}

test('validates the frozen 24-PDF / 5,628-row selector contract', () => {
  const rows = Array.from({ length: HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE }, (_, i) =>
    candidate(i, i === HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE - 1 ? 246 : 234)
  );
  assert.equal(rows.reduce((sum, row) => sum + row.overlapRows, 0), HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS);
  assert.deepEqual(validateHouseAttachmentDensityPilot(rows), {
    uniquePotentialRows: HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS,
    uniqueUrls: 24,
    uniqueBills: 24,
  });

  const drifted = rows.map((row) => ({ ...row }));
  drifted[0] = { ...drifted[0], priorWaybackScan: true, selectableFreshSurface: false };
  assert.throws(() => validateHouseAttachmentDensityPilot(drifted), /exhausted\/non-fresh/);
});

test('capture opportunity is strict after listing and strict before vote date', () => {
  const c = candidate(1, 3);
  c.firstOfficialPostedOn = '2021-02-01';
  c.lastOfficialPostedOn = '2021-02-03';
  c.overlapRowKeys = ['v1|m1', 'v2|m2', 'v3|m3'];
  c.overlapRows = 3;
  c.billIds = ['bill-1'];
  c.billIdentifiers = ['HF1001'];

  const targets: HouseAttachmentArchiveProbeTarget[] = [
    { voteEventId: 'v1', membershipId: 'm1', session: '2021-2022', chamber: 'house', occurredOn: '2021-02-04', billId: 'bill-1', identifier: 'HF1001' },
    { voteEventId: 'v2', membershipId: 'm2', session: '2021-2022', chamber: 'house', occurredOn: '2021-02-05', billId: 'bill-1', identifier: 'HF1001' },
    { voteEventId: 'v3', membershipId: 'm3', session: '2021-2022', chamber: 'house', occurredOn: '2021-02-06', billId: 'bill-1', identifier: 'HF1001' },
  ];
  const map = new Map(targets.map((row) => [houseAttachmentArchiveProbeTargetKey(row), row]));

  assert.equal(houseAttachmentCaptureOpportunity({
    candidate: c,
    targetByKey: map,
    capturedAt: '2021-02-03T23:59:59.000Z',
  }).rowKeys.length, 0);

  assert.deepEqual(houseAttachmentCaptureOpportunity({
    candidate: c,
    targetByKey: map,
    capturedAt: '2021-02-04T01:00:00.000Z',
  }).rowKeys, ['v2|m2', 'v3|m3']);

  assert.deepEqual(houseAttachmentCaptureOpportunity({
    candidate: c,
    targetByKey: map,
    capturedAt: '2021-02-05T12:00:00.000Z',
  }).rowKeys, ['v3|m3']);
});

test('fails closed when a selector row cannot be reproduced from the immutable universe', () => {
  const c = candidate(2, 1);
  c.overlapRowKeys = ['v1|m1'];
  c.overlapRows = 1;
  assert.throws(() => houseAttachmentCaptureOpportunity({
    candidate: c,
    targetByKey: new Map(),
    capturedAt: '2021-02-10T00:00:00.000Z',
  }), /missing from immutable target universe/);
});

test('archive discovery starts on the calendar day after the latest official listing', () => {
  assert.equal(houseAttachmentArchiveProbeDiscoveryFrom('2021-02-03'), '2021-02-04');
  assert.equal(houseAttachmentArchiveProbeDiscoveryFrom('2021-12-31'), '2022-01-01');
  assert.throws(() => houseAttachmentArchiveProbeDiscoveryFrom('2021-02-30'), /listing date is invalid/);
});


function frozenPriorProbe(pilot: readonly HouseAttachmentHistoricalDensityPilotRow[]): HouseAttachmentArchiveProbeFrozenReport {
  return {
    schemaVersion: 'historical-density-house-attachment-archive-probe-v1',
    selectorLineage: {
      artifactId: HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID,
      artifactDigest: HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST,
      candidateInputSha256: HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256,
      pilotSize: 24,
      potentialRows: 5628,
    },
    currentMatrix: {
      artifactId: 11380755983,
      artifactDigest: 'sha256:fe2254fc9d2ed0ea00712feab384958e4942cf387e442c29515b3a75183692d7',
      exactBillCoveredRows: 38,
      trainingExactBillCoveredRows: 3,
      frozenPilotRowsAlreadyCovered: 0,
    },
    summary: {
      probedPdfs: 24,
      classificationCounts: {
        ambiguous_discovery_failure: 2,
        no_archive_pdf_capture: 22,
      },
      verifiedPdfs: 0,
      verifiedBills: 0,
      verifiedPotentialRows: 0,
      verifiedEvents: 0,
      verifiedMemberships: 0,
    },
    rows: pilot.map((row, index) => ({
      attachmentUrl: row.attachmentUrl,
      billIdentifiers: row.billIdentifiers,
      classification: index >= 22 ? 'ambiguous_discovery_failure' : 'no_archive_pdf_capture',
      verified: null,
    })),
  };
}

test('retry cohort is derived only from the two prior acquisition ambiguities', () => {
  const pilot = Array.from({ length: 24 }, (_, i) => candidate(i, i === 23 ? 246 : 234));
  const prior = frozenPriorProbe(pilot);
  const selected = selectHouseAttachmentArchiveRetryCandidates({ priorProbe: prior, pilot });

  assert.equal(selected.length, 2);
  assert.deepEqual(
    selected.map((row) => row.attachmentUrl).sort(),
    [pilot[22].attachmentUrl, pilot[23].attachmentUrl].sort(),
  );
});

test('retry cohort fails closed on prior-result drift or reopening a closed negative', () => {
  const pilot = Array.from({ length: 24 }, (_, i) => candidate(i, i === 23 ? 246 : 234));

  const countDrift = structuredClone(frozenPriorProbe(pilot));
  countDrift.summary.classificationCounts.no_archive_pdf_capture = 21;
  assert.throws(
    () => selectHouseAttachmentArchiveRetryCandidates({ priorProbe: countDrift, pilot }),
    /result counts drifted/,
  );

  const billDrift = structuredClone(frozenPriorProbe(pilot));
  billDrift.rows[22].billIdentifiers = ['HF9999'];
  assert.throws(
    () => selectHouseAttachmentArchiveRetryCandidates({ priorProbe: billDrift, pilot }),
    /bill identity drifted/,
  );

  const verifiedDrift = structuredClone(frozenPriorProbe(pilot));
  verifiedDrift.rows[22].verified = { archiveContentSha256: 'x' };
  assert.throws(
    () => selectHouseAttachmentArchiveRetryCandidates({ priorProbe: verifiedDrift, pilot }),
    /already verified/,
  );
});
