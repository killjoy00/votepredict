import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHouseCommitteeAttachmentPdfUrl,
  HOUSE_COMMITTEE_ATTACHMENT_CONTENT_VERSION,
  normalizeHouseCommitteeAttachmentExcerpt,
  officialHouseCommitteeAttachmentListedAt,
} from '../src/evidence/house-committee-attachment-content.js';

test('accepts only official Minnesota House HTTPS PDF attachment URLs', () => {
  assert.equal(
    canonicalHouseCommitteeAttachmentPdfUrl('https://www.house.mn.gov/comm/docs/HF0400_Summary.pdf#page=1'),
    'https://www.house.mn.gov/comm/docs/HF0400_Summary.pdf',
  );
  assert.throws(
    () => canonicalHouseCommitteeAttachmentPdfUrl('http://www.house.mn.gov/comm/docs/HF0400.pdf'),
    /official Minnesota House HTTPS host/,
  );
  assert.throws(
    () => canonicalHouseCommitteeAttachmentPdfUrl('https://example.com/HF0400.pdf'),
    /official Minnesota House HTTPS host/,
  );
  assert.throws(
    () => canonicalHouseCommitteeAttachmentPdfUrl('https://www.house.mn.gov/comm/docs/HF0400.docx'),
    /supports PDF attachments only/,
  );
});

test('normalizes the official archive listing date without treating it as content availability', () => {
  assert.equal(
    officialHouseCommitteeAttachmentListedAt('2024-03-14'),
    '2024-03-14T12:00:00.000Z',
  );
  assert.throws(() => officialHouseCommitteeAttachmentListedAt('2024-02-30'), /real calendar date/);
  assert.throws(() => officialHouseCommitteeAttachmentListedAt('03/14/2024'), /YYYY-MM-DD/);
});

test('normalizes extracted PDF text without manufacturing content', () => {
  assert.equal(normalizeHouseCommitteeAttachmentExcerpt('  HF 400\n\ncommittee   summary  '), 'HF 400 committee summary');
  assert.equal(normalizeHouseCommitteeAttachmentExcerpt('   '), undefined);
  assert.equal(HOUSE_COMMITTEE_ATTACHMENT_CONTENT_VERSION, 'house-committee-attachment-content-v1');
});
