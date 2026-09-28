import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHistoricalFiscalNoteSearchPostBody,
  historicalFiscalNoteAvailableOn,
  parseHistoricalFiscalNoteRecordCount,
  parseHistoricalFiscalNoteSearch,
  parseHistoricalFiscalNoteSearchForm,
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

const FORM_SAMPLE = `
  <form method="post" action="./?year=2021" id="form1">
    <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="view+state/123" />
    <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="5FD87952" />
    <input type="hidden" name="__VIEWSTATEENCRYPTED" id="__VIEWSTATEENCRYPTED" value="" />
    <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="event&amp;validation" />
    <input name="ctl00$cpContent$txtBillNbr" type="text" id="cpContent_txtBillNbr" />
    <input name="ctl00$cpContent$txtTitle" type="text" id="cpContent_txtTitle" />
    <select name="ctl00$cpContent$ddlLeg" id="cpContent_ddlLeg">
      <option selected="selected" value="-1">Select (15)...</option>
      <option value="2025">2025-26</option>
      <option value="2023">2023-24</option>
      <option value="2021">2021-22</option>
    </select>
    <a id="cpContent_lbSearch" href="javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions(&quot;ctl00$cpContent$lbSearch&quot;, &quot;&quot;, true, &quot;&quot;, &quot;&quot;, false, true))">Search</a>
  </form>
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

test('parses the official LBO WebForms search contract', () => {
  const form = parseHistoricalFiscalNoteSearchForm(FORM_SAMPLE, 2021);
  assert.equal(form.method, 'post');
  assert.equal(form.action, './?year=2021');
  assert.equal(form.sessionFieldName, 'ctl00$cpContent$ddlLeg');
  assert.equal(form.sessionValue, '2021');
  assert.equal(form.billNumberFieldName, 'ctl00$cpContent$txtBillNbr');
  assert.equal(form.titleFieldName, 'ctl00$cpContent$txtTitle');
  assert.equal(form.searchEventTarget, 'ctl00$cpContent$lbSearch');
  assert.equal(form.hiddenFields.__VIEWSTATE, 'view+state/123');
  assert.equal(form.hiddenFields.__EVENTVALIDATION, 'event&validation');
});

test('builds a WebForms postback body for a session-wide search', () => {
  const form = parseHistoricalFiscalNoteSearchForm(FORM_SAMPLE, 2021);
  const body = new URLSearchParams(buildHistoricalFiscalNoteSearchPostBody(form));
  assert.equal(body.get('__VIEWSTATE'), 'view+state/123');
  assert.equal(body.get('__EVENTVALIDATION'), 'event&validation');
  assert.equal(body.get('__EVENTTARGET'), 'ctl00$cpContent$lbSearch');
  assert.equal(body.get('__EVENTARGUMENT'), '');
  assert.equal(body.get('ctl00$cpContent$ddlLeg'), '2021');
  assert.equal(body.get('ctl00$cpContent$txtBillNbr'), '');
  assert.equal(body.get('ctl00$cpContent$txtTitle'), '');
});

test('fails closed when the requested session or search postback is missing', () => {
  assert.throws(() => parseHistoricalFiscalNoteSearchForm(FORM_SAMPLE, 2019));
  assert.throws(() => parseHistoricalFiscalNoteSearchForm(
    FORM_SAMPLE.replace('>Search</a>', '>Lookup</a>'),
    2021,
  ));
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
