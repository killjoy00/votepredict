import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLifecycleP7Lineage,
  canonicalizeLifecycleP7SubstantiveText,
  lifecycleP7DirectVehicleIds,
  lifecycleP7SubstantiveTextSha256,
  type LifecycleP7Bill,
  type LifecycleP7BillVersion,
  type LifecycleP7ProcessReference,
} from '../src/evaluation/lifecycle-p7-lineage.js';

function bill(
  billId: string,
  identifier: string,
  chamber: 'house' | 'senate',
  companion: string | null = null,
): LifecycleP7Bill {
  return {
    billId,
    session: '2025-2026',
    chamber,
    identifier,
    currentCompanionIdentifier: companion,
    currentCompanionObservedAt: companion ? '2026-06-01T12:00:00Z' : null,
    currentCompanionSourceUrl: companion ? 'https://www.revisor.mn.gov/status/' + identifier : null,
    currentCompanionSourceSha256: companion ? 'source-sha-' + identifier : null,
  };
}

function text(identifier: string, body: string): string {
  return identifier + '\nA bill for an act relating to transportation; ' +
    'amending Minnesota Statutes; BE IT ENACTED BY THE LEGISLATURE OF THE STATE OF MINNESOTA: ' +
    body.repeat(40);
}

function version(
  billId: string,
  billVersionId: string,
  identifier: string,
  body: string,
): LifecycleP7BillVersion {
  return {
    billVersionId,
    billId,
    versionKey: '0',
    publishedOn: '2025-02-01',
    sourceUrl: 'https://www.revisor.mn.gov/example/' + identifier,
    textSha256: 'stored-text-sha-' + billVersionId,
    rawText: text(identifier, body),
  };
}

function processReference(
  billId: string,
  description: string,
  companionIdentifier: string,
): LifecycleP7ProcessReference {
  return {
    eventId: 'event-' + billId,
    billId,
    occurredOn: '2025-04-01',
    sourceUrl: 'https://api.revisor.mn.gov/example/' + billId,
    sourceDocumentId: 'source-' + billId,
    sourceContentSha256: 'sha-' + billId,
    descriptions: [description],
    companionIdentifiers: [companionIdentifier],
  };
}

test('P7 canonical text ignores bill headers while retaining substantive differences', () => {
  const left = text('HF10', 'same substantive language ');
  const right = text('SF20', 'same substantive language ');
  const changed = text('SF20', 'different substantive language ');
  assert.ok(canonicalizeLifecycleP7SubstantiveText(left));
  assert.equal(lifecycleP7SubstantiveTextSha256(left), lifecycleP7SubstantiveTextSha256(right));
  assert.notEqual(lifecycleP7SubstantiveTextSha256(left), lifecycleP7SubstantiveTextSha256(changed));
});

test('explicit dated substitution is sufficient independent relationship proof', () => {
  const result = buildLifecycleP7Lineage({
    bills: [bill('h', 'HF10', 'house'), bill('s', 'SF20', 'senate')],
    processReferences: [
      processReference('h', 'Bills not identical, SF20 substituted on General Register', 'SF20'),
    ],
    billVersions: [],
  });
  assert.equal(result.edges.length, 1);
  assert.deepEqual(result.edges[0].acceptedReasons, ['dated-substitution']);
  assert.equal(result.report.policy.outcomeColumnsRead, false);
  assert.equal(result.report.policy.voteTablesRead, false);
});

test('an official action explicitly naming a companion is sufficient relationship proof', () => {
  const result = buildLifecycleP7Lineage({
    bills: [bill('h', 'HF10', 'house'), bill('s', 'SF20', 'senate')],
    processReferences: [
      processReference('h', 'Companion bill SF20 referred for further action', 'SF20'),
    ],
    billVersions: [],
  });
  assert.equal(result.edges.length, 1);
  assert.deepEqual(result.edges[0].acceptedReasons, ['dated-explicit-companion']);
});

test('comparison-only references remain visible but do not force lineage', () => {
  const result = buildLifecycleP7Lineage({
    bills: [bill('h', 'HF10', 'house'), bill('s', 'SF20', 'senate')],
    processReferences: [
      processReference('h', 'Referred to Rules and Administration for comparison with SF20', 'SF20'),
    ],
    billVersions: [],
  });
  assert.equal(result.edges.length, 0);
  assert.ok(result.unresolved.some((row) =>
    row.kind === 'weak-unconfirmed-pair' &&
    (row.details.evidenceKinds as string[]).includes('dated-comparison')));
});

test('reciprocal final official companion metadata creates a relationship but one-sided metadata alone does not', () => {
  const reciprocal = buildLifecycleP7Lineage({
    bills: [bill('h', 'HF10', 'house', 'SF20'), bill('s', 'SF20', 'senate', 'HF10')],
    processReferences: [],
    billVersions: [],
  });
  assert.equal(reciprocal.edges.length, 1);
  assert.deepEqual(reciprocal.edges[0].acceptedReasons, ['reciprocal-current-companion']);

  const oneSided = buildLifecycleP7Lineage({
    bills: [bill('h', 'HF10', 'house', 'SF20'), bill('s', 'SF20', 'senate')],
    processReferences: [],
    billVersions: [],
  });
  assert.equal(oneSided.edges.length, 0);
  assert.ok(oneSided.unresolved.some((row) => row.kind === 'weak-unconfirmed-pair'));
});

test('an unambiguous exact substantive-text pair across chambers creates lineage', () => {
  const bills = [bill('h', 'HF10', 'house'), bill('s', 'SF20', 'senate')];
  const result = buildLifecycleP7Lineage({
    bills,
    processReferences: [],
    billVersions: [
      version('h', 'hv', 'HF10', 'same substantive language '),
      version('s', 'sv', 'SF20', 'same substantive language '),
    ],
  });
  assert.equal(result.edges.length, 1);
  assert.deepEqual(result.edges[0].acceptedReasons, ['exact-substantive-text']);
  assert.equal(result.components.length, 1);
  assert.deepEqual(result.components[0].bills.map((row) => row.identifier), ['HF10', 'SF20']);
});

test('ambiguous exact-text groups remain unresolved rather than creating pairwise lineage', () => {
  const bills = [
    bill('h1', 'HF10', 'house'),
    bill('s1', 'SF20', 'senate'),
    bill('s2', 'SF21', 'senate'),
  ];
  const result = buildLifecycleP7Lineage({
    bills,
    processReferences: [],
    billVersions: [
      version('h1', 'v1', 'HF10', 'shared language '),
      version('s1', 'v2', 'SF20', 'shared language '),
      version('s2', 'v3', 'SF21', 'shared language '),
    ],
  });
  assert.equal(result.edges.length, 0);
  assert.equal(result.report.coverage.ambiguousExactTextGroups, 1);
  assert.ok(result.unresolved.some((row) => row.kind === 'ambiguous-exact-text-group'));
});

test('same-chamber exact duplicates do not create P7 v1 lineage without official proof', () => {
  const result = buildLifecycleP7Lineage({
    bills: [bill('h1', 'HF10', 'house'), bill('h2', 'HF11', 'house')],
    processReferences: [],
    billVersions: [
      version('h1', 'v1', 'HF10', 'shared language '),
      version('h2', 'v2', 'HF11', 'shared language '),
    ],
  });
  assert.equal(result.edges.length, 0);
  assert.equal(result.report.coverage.sameChamberExactTextGroups, 1);
});


test('reciprocal current companion metadata without frozen source lineage does not create lineage', () => {
  const left = bill('h', 'HF10', 'house', 'SF20');
  const right = bill('s', 'SF20', 'senate', 'HF10');
  right.currentCompanionSourceSha256 = null;
  const result = buildLifecycleP7Lineage({
    bills: [left, right],
    processReferences: [],
    billVersions: [],
  });
  assert.equal(result.edges.length, 0);
  assert.ok(result.unresolved.some((row) =>
    row.kind === 'weak-unconfirmed-pair' &&
    (row.details.evidenceKinds as string[]).includes('current-companion-unlineaged')));
});

test('multi-bill components are audit-only; P7 outcome closure remains direct edges only', () => {
  const bills = [
    bill('h1', 'HF10', 'house'),
    bill('s1', 'SF20', 'senate'),
    bill('h2', 'HF30', 'house'),
  ];
  const result = buildLifecycleP7Lineage({
    bills,
    processReferences: [
      processReference('h1', 'Companion bill SF20 referred for further action', 'SF20'),
      processReference('h2', 'Companion bill SF20 referred for further action', 'SF20'),
    ],
    billVersions: [],
  });
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].bills.length, 3);
  assert.deepEqual(lifecycleP7DirectVehicleIds('h1', result.edges), ['h1', 's1']);
  assert.ok(!lifecycleP7DirectVehicleIds('h1', result.edges).includes('h2'));
  assert.equal(result.report.contract.outcomeClosure, 'direct-edges-only');
  assert.equal(result.report.policy.componentsTransitiveForOutcome, false);
});
