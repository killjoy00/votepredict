import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generatedSenateFormerMemberCandidateUrls,
  parseBoundedSenateArchiveMembershipIds,
} from '../src/evidence/senate-former-member-archive.js';

const IDS = [
  'd98b4c59-261a-459a-9b91-fcd10f7b0842',
  '66757112-31ab-4963-93b5-0c0311722a99',
  'fc04e166-2f68-4eb9-b29d-bc6bc364361e',
] as const;

test('Senate former-member candidate URLs stay caucus-specific and deterministic', () => {
  assert.deepEqual(
    generatedSenateFormerMemberCandidateUrls(
      { name: 'Ann H. Rest', party: 'DFL' },
      'https://senatedfl.mn/senator-ann-rest/',
    ),
    [
      'https://senatedfl.mn/senator-ann-rest/',
      'https://senatedfl.mn/author/ann-rest/',
      'https://senatedfl.mn/author/senator-ann-rest/',
    ],
  );
  assert.deepEqual(
    generatedSenateFormerMemberCandidateUrls({ name: 'Bill G. Ingebrigtsen', party: 'R' }),
    [
      'https://www.mnsenaterepublicans.com/bill-ingebrigtsen',
      'https://www.mnsenaterepublicans.com/senator-bill-ingebrigtsen',
    ],
  );
  assert.deepEqual(
    generatedSenateFormerMemberCandidateUrls({ name: 'David J. Tomassoni', party: 'I' }),
    [],
  );
});

test('Senate archive membership-id parsing is bounded and fail-closed', () => {
  assert.deepEqual(parseBoundedSenateArchiveMembershipIds(IDS.join(',')), [...IDS]);
  assert.throws(
    () => parseBoundedSenateArchiveMembershipIds('not-a-uuid'),
    /Invalid Senate archive membership id/,
  );
  assert.throws(
    () => parseBoundedSenateArchiveMembershipIds(`${IDS[0]},${IDS[0]}`),
    /must be unique/,
  );
  assert.throws(
    () => parseBoundedSenateArchiveMembershipIds([
      ...IDS,
      'd9bfc4bf-f62a-4341-b10b-f7e7b065463e',
      'a330fece-70da-471d-afe4-388e21a50a86',
      '655fc3e7-9227-4f38-afeb-75ff5ed4d03d',
      '81e150a7-0c06-481e-b3e0-24014cb613a6',
      'aa1fe369-dedd-4ff0-883c-bd258be94404',
      '19218254-b4c1-4a51-945f-e66f08bde699',
    ].join(',')),
    /at most 8/,
  );
});
