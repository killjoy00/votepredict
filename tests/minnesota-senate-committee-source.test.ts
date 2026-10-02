import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSenateMinutesYearHtml } from '../src/evidence/minnesota-senate-committee-source.js';

test('Senate year-page parser extracts direct official minute PDFs by committee section', () => {
  const parsed=parseSenateMinutesYearHtml({
    year:2024,
    sourceUrl:'https://www.lrl.mn.gov/minutes/default?body=senate&year=2024',
    html:[
      '<h2>Agriculture, Broadband and Rural Development (Senate)</h2>',
      '<a href="/archive/minutes/senate/2024/agr/20240219/Agr_20240219_Agenda.pdf">Agenda</a>',
      '<a href="/archive/minutes/senate/2024/agr/20240219/Agr_20240219_Minutes.pdf">Minutes</a>',
      '<h2>Finance (Senate)</h2>',
      '<a href="/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Minutes.pdf">Minutes</a>',
      '<a href="/archive/minutes/senate/2024/fin/20240306/Fin_20240306_Minutes.pdf">Minutes</a>',
      '<h2>House Finance</h2>',
      '<a href="/archive/minutes/senate/2024/fin/20240401/Should_Not_Use.pdf">Minutes</a>',
      '<h2>Taxes (Senate)</h2>',
      '<a href="/archive/minutes/senate/2023/tax/20230306/Tax_20230306_Minutes.pdf">Minutes</a>',
      '<a href="https://example.com/archive/minutes/senate/2024/tax/20240409/Tax_20240409_Minutes.pdf">Minutes</a>',
    ].join('\n'),
  });

  assert.deepEqual(parsed.committeeNames,[
    'Agriculture, Broadband and Rural Development',
    'Finance',
    'Taxes',
  ]);
  assert.deepEqual(parsed.documents.map(row=>[row.meetingDate,row.committeeName,row.url]),[
    ['2024-02-19','Agriculture, Broadband and Rural Development','https://www.lrl.mn.gov/archive/minutes/senate/2024/agr/20240219/Agr_20240219_Minutes.pdf'],
    ['2024-02-29','Finance','https://www.lrl.mn.gov/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Minutes.pdf'],
    ['2024-03-06','Finance','https://www.lrl.mn.gov/archive/minutes/senate/2024/fin/20240306/Fin_20240306_Minutes.pdf'],
  ]);
});

test('Senate year-page parser deduplicates duplicate Minutes links', () => {
  const parsed=parseSenateMinutesYearHtml({
    year:2025,
    sourceUrl:'https://www.lrl.mn.gov/minutes/default?body=senate&year=2025',
    html:[
      '<h2>Finance (Senate)</h2>',
      '<a href="/archive/minutes/senate/2025/fin/20250203/Fin_20250203_Minutes.pdf">Minutes</a>',
      '<a href="/archive/minutes/senate/2025/fin/20250203/Fin_20250203_Minutes.pdf">Minutes</a>',
    ].join('\n'),
  });
  assert.equal(parsed.documents.length,1);
  assert.equal(parsed.documents[0].meetingDate,'2025-02-03');
});
