import assert from 'node:assert/strict';
import test from 'node:test';
import {
  historicalFiscalNoteAvailableOn,
  parseHistoricalFiscalNoteRecordCount,
  parseHistoricalFiscalNoteSearch,
  parseHistoricalFiscalNoteSearchRows,
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
      <td>Regular Fiscal Note</td>
      <td>Wolgamott, Dan</td>
      <td>03/01/2023</td>
    </tr>
    <tr>
      <td>HF23 - 3E</td>
      <td>Policy change</td>
      <td>Regular Fiscal Note</td>
      <td>Wolgamott, Dan</td>
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
      noteType: 'Regular Fiscal Note',
      author: 'Wolgamott, Dan',
      completeDate: '2023-03-01',
      availableOn: '2023-03-02',
    },
    {
      billIdentifier: 'HF23',
      version: '3E',
      title: 'Policy change',
      noteType: 'Regular Fiscal Note',
      author: 'Wolgamott, Dan',
      completeDate: '2023-03-24',
      availableOn: '2023-03-25',
    },
  ]);
});

test('parses a complete session snapshot before filtering to target bills', () => {
  const html = SAMPLE
    .replace('Record Count: 2', 'Record Count: 3')
    .replace('</table>', `
      <tr>
        <td>SF23 - 2A</td>
        <td>Other bill</td>
        <td>Regular Fiscal Note</td>
        <td>Example, Alex</td>
        <td>03/05/2023</td>
      </tr>
    </table>`);
  assert.deepEqual(
    parseHistoricalFiscalNoteSearchRows(html).map((row) => row.billIdentifier),
    ['HF23', 'HF23', 'SF23'],
  );
  assert.equal(parseHistoricalFiscalNoteSearch(html, 'HF 0023').length, 2);
});

test('availability lag crosses month and year boundaries safely', () => {
  assert.equal(historicalFiscalNoteAvailableOn('2023-03-31'), '2023-04-01');
  assert.equal(historicalFiscalNoteAvailableOn('2023-12-31'), '2024-01-01');
});

test('rejects malformed completion dates', () => {
  assert.throws(() => historicalFiscalNoteAvailableOn('2023-02-30'));
  assert.throws(() => historicalFiscalNoteAvailableOn('not-a-date'));
});
