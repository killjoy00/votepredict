import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORGANIZATION_PUBLICATION_SEEDS,
  selectOrganizationPublicationBatch,
  validateOrganizationPublicationSeeds,
} from '../src/evidence/organization-publication-history.js';

test('organization publication seeds are HTTPS, unique and bounded to the research window', () => {
  validateOrganizationPublicationSeeds();
  assert.equal(ORGANIZATION_PUBLICATION_SEEDS.length, 16);
  assert.ok(ORGANIZATION_PUBLICATION_SEEDS.every(seed => seed.url.startsWith('https://')));
  assert.ok(ORGANIZATION_PUBLICATION_SEEDS.every(seed => seed.to === '20261231'));
  assert.deepEqual(
    ORGANIZATION_PUBLICATION_SEEDS.slice(0, 4).map(seed => [seed.id, seed.sector, seed.publicationKind]),
    [
      ['league-mn-cities-2024-legislative-session', 'local_government', 'legislative_advocacy'],
      ['mn-medical-association-2024-legislative-priorities', 'professional', 'legislative_advocacy'],
      ['aclu-mn-legislation-index', 'advocacy', 'legislative_advocacy'],
      ['mn-family-council-legislative-scorecard-index', 'advocacy', 'legislative_scorecard_index'],
    ],
  );
  assert.deepEqual(
    [...new Set(ORGANIZATION_PUBLICATION_SEEDS.map(seed => seed.sector))].sort(),
    ['advocacy','business','education','environmental','healthcare','labor','local_government','professional'],
  );
});

test('organization publication seed validation fails closed on duplicate ids', () => {
  const first = ORGANIZATION_PUBLICATION_SEEDS[0];
  assert.throws(
    () => validateOrganizationPublicationSeeds([first, { ...first, url: 'https://example.com/other' }]),
    /Duplicate or empty/,
  );
});

test('organization publication seed validation fails closed on insecure URLs and bad windows', () => {
  const first = ORGANIZATION_PUBLICATION_SEEDS[0];
  assert.throws(
    () => validateOrganizationPublicationSeeds([{ ...first, id: 'bad-http', url: 'http://example.com' }]),
    /must use HTTPS/,
  );
  assert.throws(
    () => validateOrganizationPublicationSeeds([{ ...first, id: 'bad-window', from: '20270101', to: '20261231' }]),
    /Invalid archive window/,
  );
});


test('organization publication batch selection preserves the rotation cursor for targeted retries', () => {
  const rotation = selectOrganizationPublicationBatch({
    priorNextOffset: 14,
    batchSize: 2,
  });
  assert.equal(rotation.targetedRetry, false);
  assert.deepEqual(rotation.batch.map(seed => seed.id), [
    'afscme-mn-legislative-scorecards',
    'abc-mnnd-legislative-scorecard',
  ]);
  assert.equal(rotation.offset, 14);
  assert.equal(rotation.nextOffset, 0);

  const retry = selectOrganizationPublicationBatch({
    priorNextOffset: 0,
    batchSize: 2,
    requestedSeedIds: [
      'mcea-2026-legislative-recap',
      'mn-afl-cio-2024-legislative-report',
    ],
  });
  assert.equal(retry.targetedRetry, true);
  assert.deepEqual(retry.batch.map(seed => seed.id), [
    'mcea-2026-legislative-recap',
    'mn-afl-cio-2024-legislative-report',
  ]);
  assert.equal(retry.offset, 0);
  assert.equal(retry.nextOffset, 0);
});

test('organization publication targeted retry selection fails closed on invalid requests', () => {
  assert.throws(
    () => selectOrganizationPublicationBatch({
      priorNextOffset: 0,
      batchSize: 2,
      requestedSeedIds: ['not-a-registered-seed'],
    }),
    /Unknown organization publication retry seed id/,
  );
  assert.throws(
    () => selectOrganizationPublicationBatch({
      priorNextOffset: 0,
      batchSize: 2,
      requestedSeedIds: [
        'mcea-2026-legislative-recap',
        'mn-afl-cio-2024-legislative-report',
        'afscme-mn-legislative-scorecards',
      ],
    }),
    /at most 2/,
  );
  assert.throws(
    () => selectOrganizationPublicationBatch({
      priorNextOffset: 0,
      batchSize: 2,
      requestedSeedIds: [
        'mcea-2026-legislative-recap',
        'mcea-2026-legislative-recap',
      ],
    }),
    /must be unique/,
  );
});
