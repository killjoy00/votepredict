import assert from 'node:assert/strict';
import test from 'node:test';
import {
  historicalFiscalNoteAvailableOn,
  parseHistoricalFiscalNoteRecordCount,
  parseHistoricalFiscalNoteSearch,
} from '../src/evidence/historical-fiscal-note.js';

const SAMPLE = `
  <div>Record Count: 2</div>
  <table>
    <tr>
      <th>Bill / Version</th>
      <th>Title</th>
      <th>Type</th>
      <th>Author</th>
      <th>Complete Date</th>
    </tr>
    <tr>
      <td>HF23 - 1A</td>
      <td>Policy change</td>
      <td>Fiscal Note</td>
      <td>Department A</td>
      <td>03/01/2023</td>
    </tr>
    <tr>
      <td>HF23 - 3E</td>
      <td>Policy change</td>
      <td>Fiscal Note</td>
      <td>Department B</td>
      <td>03/24/2023</td>
    </tr>
  </table>
`;

test('parses official historical fiscal-note rows and applies conservative public lag', () => {
  assert.equal(parseHistoricalFiscalNoteRecordCount(SAMPLE), 2);
  assert.deepEqual(parseHistoricalFiscalNoteSearch(SAMPLE, 'HF23'), [
    {
      billIdentifier: 'HF23',
      version: '1A',
      title: 'Policy change',
      noteType: 'Fiscal Note',
      author: 'Department A',
      completeDate: '2023-03-01',
      availableOn: '2023-03-02',
    },
    {
      billIdentifier: 'HF23',
      version: '3E',
      title: 'Policy change',
      noteType: 'Fiscal Note',
      author: 'Department B',
      completeDate: '2023-03-24',
      availableOn: '2023-03-25',
    },
  ]);
});

test('filters rows to the exact requested bill identifier', () => {
  const html = SAMPLE.replace('</table>', `
    <tr>
      <td>SF23 - 2A</td>
      <td>Other bill</td>
      <td>Fiscal Note</td>
      <td>Department C</td>
      <td>03/05/2023</td>
    </tr>
  </table>`);
  const rows = parseHistoricalFiscalNoteSearch(html, 'HF 0023');
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.billIdentifier === 'HF23'));
});

test('availability lag crosses month and year boundaries safely', () => {
  assert.equal(historicalFiscalNoteAvailableOn('2023-03-31'), '2023-04-01');
  assert.equal(historicalFiscalNoteAvailableOn('2023-12-31'), '2024-01-01');
});

test('rejects malformed completion dates', () => {
  assert.throws(() => historicalFiscalNoteAvailableOn('2023-02-30'));
  assert.throws(() => historicalFiscalNoteAvailableOn('not-a-date'));
});
