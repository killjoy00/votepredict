import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRevisorIntroductionMetadata } from '../src/sources/minnesota/revisor-introduction.js';

test('introduction parser refuses a status record for a different bill', () => {
  const xml = '<BILL><FILE_TYPE>HF</FILE_TYPE><FILE_NUMBER>11</FILE_NUMBER></BILL>';
  assert.throws(
    () => parseRevisorIntroductionMetadata({ xml, identifier: 'HF10' }),
    /Revisor bill mismatch: expected HF10, found HF11/,
  );
});
