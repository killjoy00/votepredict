import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseSenateCommitteeMinuteText,
  parseSenateCommitteeIndexHtml,
  parseSenateCommitteePageHtml,
} from '../src/evidence/minnesota-senate-committee-source.js';

test('Senate year page parser extracts verified committee-page links', () => {
  const rows=parseSenateCommitteeIndexHtml({
    year:2024,
    sourceUrl:'https://www.lrl.mn.gov/minutes/default?body=senate&year=2024',
    html:[
      '<h2><a href="/minutes/comm.aspx?body=senate&commid=9236-0&year=2024">Finance (Senate)</a></h2>',
      '<h2><a href="/minutes/comm?body=Senate&commid=9224-0&year=2024">Taxes (Senate)</a></h2>',
      '<a href="/minutes/comm?commid=9236-0&date=02%2F29%2F2024&year=2024">2/29/2024</a>',
      '<h2><a href="/minutes/comm?body=house&commid=1&year=2024">Finance (House)</a></h2>',
      '<h2><a href="/minutes/comm?body=senate&commid=1&year=2023">Old (Senate)</a></h2>',
    ].join('\n'),
  });
  assert.deepEqual(rows.map(row=>[row.committeeName,row.url]),[
    ['Finance','https://www.lrl.mn.gov/minutes/comm.aspx?body=senate&commid=9236-0&year=2024'],
    ['Taxes','https://www.lrl.mn.gov/minutes/comm?body=Senate&commid=9224-0&year=2024'],
  ]);
});

test('Senate committee page parser extracts Minutes PDFs by verified archive filename', () => {
  const rows=parseSenateCommitteePageHtml({
    year:2024,
    committeeName:'Finance',
    sourceUrl:'https://www.lrl.mn.gov/minutes/comm?commid=9236-0&year=2024',
    html:[
      '<h2>2/29/2024</h2>',
      '<a href="/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Agenda.pdf">Open document in new tab</a> Agenda',
      '<a href="/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Minutes.pdf">Open document in new tab</a> Minutes',
      '<h2>3/6/2024</h2>',
      '<a href="/archive/minutes/senate/2024/fin/20240306/Fin_20240306_Minutes.pdf"><img alt="Open document in new tab"></a> Minutes',
      '<a href="/archive/minutes/senate/2023/fin/20230306/Fin_20230306_Minutes.pdf">Open</a> Minutes',
      '<a href="https://example.com/archive/minutes/senate/2024/fin/20240401/Fin_20240401_Minutes.pdf">Open</a> Minutes',
    ].join('\n'),
  });
  assert.deepEqual(rows.map(row=>[row.meetingDate,row.committeeName,row.url]),[
    ['2024-02-29','Finance','https://www.lrl.mn.gov/archive/minutes/senate/2024/fin/20240229/Fin_20240229_Minutes.pdf'],
    ['2024-03-06','Finance','https://www.lrl.mn.gov/archive/minutes/senate/2024/fin/20240306/Fin_20240306_Minutes.pdf'],
  ]);
});

test('Senate committee page parser deduplicates repeated Minutes links', () => {
  const rows=parseSenateCommitteePageHtml({
    year:2025,
    committeeName:'Finance',
    sourceUrl:'https://www.lrl.mn.gov/minutes/comm?commid=9236-0&year=2025',
    html:[
      '<a href="/archive/minutes/senate/2025/fin/20250203/Fin_20250203_Minutes.pdf">Open</a>',
      '<a href="/archive/minutes/senate/2025/fin/20250203/Fin_20250203_Minutes.pdf">Open</a>',
    ].join('\n'),
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].meetingDate,'2025-02-03');
});


test('Senate committee minute text selection uses OCR only when embedded text is unavailable', () => {
  assert.deepEqual(
    chooseSenateCommitteeMinuteText({embeddedText:'Digitally extractable official committee minutes text with ample content.'}),
    {
      text:'Digitally extractable official committee minutes text with ample content.',
      extractionMethod:'embedded_text',
    },
  );
  assert.deepEqual(
    chooseSenateCommitteeMinuteText({
      embeddedText:' ',
      ocrText:'OCR fallback text from a scanned official committee minutes page with ample content.',
    }),
    {
      text:'OCR fallback text from a scanned official committee minutes page with ample content.',
      extractionMethod:'ocr_tesseract',
    },
  );
  assert.throws(
    ()=>chooseSenateCommitteeMinuteText({embeddedText:'short',ocrText:'also short'}),
    /too little extractable text/,
  );
});
