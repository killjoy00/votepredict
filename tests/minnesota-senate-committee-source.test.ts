import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSenateCommitteeIndexHtml,
  parseSenateCommitteePageHtml,
} from '../src/evidence/minnesota-senate-committee-source.js';

test('Senate committee index parser extracts Senate committee pages for the requested year', () => {
  const rows=parseSenateCommitteeIndexHtml({
    year:2024,
    sourceUrl:'https://www.lrl.mn.gov/minutes/default?body=senate&year=2024',
    html:[
      '<a href="/minutes/comm?commid=9236-0&year=2024">Finance (Senate)</a>',
      '<a href="/minutes/comm?commid=9224-0&year=2024">Taxes (Senate)</a>',
      '<a href="/minutes/comm?commid=9999-0&year=2023">Old committee</a>',
      '<a href="https://example.com/minutes/comm?commid=1&year=2024">External</a>',
    ].join('\n'),
  });
  assert.deepEqual(rows.map(row=>[row.committeeName,row.url]),[
    ['Finance','https://www.lrl.mn.gov/minutes/comm?commid=9236-0&year=2024'],
    ['Taxes','https://www.lrl.mn.gov/minutes/comm?commid=9224-0&year=2024'],
  ]);
});

test('Senate committee page parser extracts official minute PDFs and meeting dates', () => {
  const rows=parseSenateCommitteePageHtml({
    year:2024,
    committeeName:'Finance',
    sourceUrl:'https://www.lrl.mn.gov/minutes/comm?commid=9236-0&year=2024',
    html:[
      '<a href="/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Agenda.pdf">Agenda</a>',
      '<a href="/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Minutes.pdf">Minutes</a>',
      '<a href="/archive/minutes/senate/2024/fin/20240306/Fin_20240306_Minutes.pdf">Minutes</a>',
      '<a href="/archive/minutes/senate/2023/fin/20230306/Fin_20230306_Minutes.pdf">Minutes</a>',
    ].join('\n'),
  });
  assert.deepEqual(rows.map(row=>[row.meetingDate,row.committeeName,row.url]),[
    ['2024-02-29','Finance','https://www.lrl.mn.gov/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Minutes.pdf'],
    ['2024-03-06','Finance','https://www.lrl.mn.gov/archive/minutes/senate/2024/fin/20240306/Fin_20240306_Minutes.pdf'],
  ]);
});
