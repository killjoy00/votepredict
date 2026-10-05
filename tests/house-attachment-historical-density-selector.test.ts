import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHouseAttachmentHistoricalDensityCandidates,
  selectHouseAttachmentHistoricalDensityPilot,
  type HouseAttachmentHistoricalDensityEvidenceRow,
  type HouseAttachmentHistoricalDensityTarget,
} from '../src/evidence/house-attachment-historical-density-selector.js';

const baseEvidence = {
  attachmentName: 'HF 10 testimony.pdf',
  attachmentSubtype: 'committee_archive_testimony_handout',
  priorWaybackPdf: false,
  priorWaybackScan: false,
  currentBodyPresent: false,
} satisfies Omit<HouseAttachmentHistoricalDensityEvidenceRow,
  'archiveEvidenceId' | 'billId' | 'billIdentifier' | 'attachmentUrl' | 'officialPostedOn'>;

function target(overrides: Partial<HouseAttachmentHistoricalDensityTarget> = {}): HouseAttachmentHistoricalDensityTarget {
  return {
    voteEventId: 'vote-1',
    membershipId: 'member-1',
    session: '2021-2022',
    chamber: 'house',
    occurredOn: '2021-03-10',
    billId: 'bill-10',
    identifier: 'HF10',
    ...overrides,
  };
}

test('deduplicates one physical PDF while preserving exact bill/date overlap rules', () => {
  const evidenceRows: HouseAttachmentHistoricalDensityEvidenceRow[] = [
    {
      ...baseEvidence,
      archiveEvidenceId: 'e1',
      billId: 'bill-10',
      billIdentifier: 'HF10',
      attachmentUrl: 'https://www.house.mn.gov/a/b.pdf',
      officialPostedOn: '2021-03-01',
    },
    {
      ...baseEvidence,
      archiveEvidenceId: 'e2',
      billId: 'bill-20',
      billIdentifier: 'HF20',
      attachmentUrl: 'https://house.mn.gov/a/b.pdf',
      attachmentName: 'HF 20 testimony.pdf',
      officialPostedOn: '2021-03-05',
    },
  ];
  const candidates = buildHouseAttachmentHistoricalDensityCandidates({
    evidenceRows,
    targets: [
      target(),
      target({ voteEventId: 'vote-2', membershipId: 'member-2', billId: 'bill-20', identifier: 'HF20', occurredOn: '2021-03-20' }),
    ],
    coveredRowKeys: new Set(),
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].overlapRows, 2);
  assert.deepEqual(candidates[0].billIdentifiers, ['HF10', 'HF20']);
  assert.deepEqual(candidates[0].archiveEvidenceIds, ['e1', 'e2']);
});

test('strictly excludes same-day, post-vote, and already-covered target rows', () => {
  const evidenceRows: HouseAttachmentHistoricalDensityEvidenceRow[] = [{
    ...baseEvidence,
    archiveEvidenceId: 'e1',
    billId: 'bill-10',
    billIdentifier: 'HF10',
    attachmentUrl: 'https://www.house.mn.gov/a/c.pdf',
    officialPostedOn: '2021-03-10',
  }];

  const candidates = buildHouseAttachmentHistoricalDensityCandidates({
    evidenceRows,
    targets: [
      target({ voteEventId: 'same-day', occurredOn: '2021-03-10' }),
      target({ voteEventId: 'later', membershipId: 'member-2', occurredOn: '2021-03-11' }),
      target({ voteEventId: 'covered', membershipId: 'member-3', occurredOn: '2021-03-12' }),
    ],
    coveredRowKeys: new Set(['covered|member-3']),
  });

  assert.equal(candidates[0].overlapRows, 1);
  assert.deepEqual(candidates[0].overlapRowKeys, ['later|member-2']);
});

test('excludes already-probed archive surfaces from the fresh pilot', () => {
  const candidates = buildHouseAttachmentHistoricalDensityCandidates({
    evidenceRows: [{
      ...baseEvidence,
      archiveEvidenceId: 'e1',
      billId: 'bill-10',
      billIdentifier: 'HF10',
      attachmentUrl: 'https://www.house.mn.gov/a/d.pdf',
      officialPostedOn: '2021-03-01',
      priorWaybackScan: true,
    }],
    targets: [target()],
    coveredRowKeys: new Set(),
  });

  assert.equal(candidates[0].selectableFreshSurface, false);
  assert.deepEqual(selectHouseAttachmentHistoricalDensityPilot(candidates), []);
});

test('greedy pilot maximizes marginal uncovered rows and avoids same-bill duplication', () => {
  const evidenceRows: HouseAttachmentHistoricalDensityEvidenceRow[] = [
    {
      ...baseEvidence,
      archiveEvidenceId: 'e1',
      billId: 'bill-10',
      billIdentifier: 'HF10',
      attachmentUrl: 'https://www.house.mn.gov/a/one.pdf',
      officialPostedOn: '2021-03-01',
    },
    {
      ...baseEvidence,
      archiveEvidenceId: 'e2',
      billId: 'bill-10',
      billIdentifier: 'HF10',
      attachmentUrl: 'https://www.house.mn.gov/a/two.pdf',
      attachmentSubtype: 'committee_archive_agenda',
      officialPostedOn: '2021-03-02',
    },
    {
      ...baseEvidence,
      archiveEvidenceId: 'e3',
      billId: 'bill-20',
      billIdentifier: 'HF20',
      attachmentUrl: 'https://www.house.mn.gov/a/three.pdf',
      officialPostedOn: '2021-03-01',
    },
  ];
  const targets = [
    target({ voteEventId: 'v10', membershipId: 'm1' }),
    target({ voteEventId: 'v10', membershipId: 'm2' }),
    target({ voteEventId: 'v20', membershipId: 'm3', billId: 'bill-20', identifier: 'HF20' }),
  ];
  const candidates = buildHouseAttachmentHistoricalDensityCandidates({
    evidenceRows,
    targets,
    coveredRowKeys: new Set(),
  });
  const pilot = selectHouseAttachmentHistoricalDensityPilot(candidates, 3);

  assert.equal(pilot.length, 2);
  assert.equal(pilot[0].attachmentUrl, 'https://www.house.mn.gov/a/one.pdf');
  assert.equal(pilot[0].marginalRows, 2);
  assert.equal(pilot[1].attachmentUrl, 'https://www.house.mn.gov/a/three.pdf');
  assert.equal(pilot[1].marginalRows, 1);
  assert.equal(pilot[1].cumulativeRows, 3);
});
