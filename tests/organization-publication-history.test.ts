import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORGANIZATION_PUBLICATION_SEEDS,
  validateOrganizationPublicationSeeds,
} from '../src/evidence/organization-publication-history.js';

test('organization publication seeds are HTTPS, unique and bounded to the research window', () => {
  validateOrganizationPublicationSeeds();
  assert.equal(ORGANIZATION_PUBLICATION_SEEDS.length, 12);
  assert.ok(ORGANIZATION_PUBLICATION_SEEDS.every(seed => seed.url.startsWith('https://')));
  assert.ok(ORGANIZATION_PUBLICATION_SEEDS.every(seed => seed.to === '20261231'));
  assert.deepEqual(
    ORGANIZATION_PUBLICATION_SEEDS.slice(0, 3).map(seed => [seed.id, seed.publicationKind]),
    [
      ['mn-afl-cio-2024-legislative-report', 'legislative_voting_record'],
      ['mn-farm-bureau-2024-legislative-recap', 'legislative_recap'],
      ['education-minnesota-2024-legislative-recap', 'legislative_recap'],
    ],
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
