import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SENATE_FINAL_OCR_EXPECTED,
  SENATE_FINAL_OCR_SOURCE_RUN,
  SENATE_FINAL_OCR_MAX_BYTES,
  SENATE_FINAL_OCR_MAX_PAGES,
  isOfficialPinnedOriginal,
  selectVerifiedFinalOriginals,
} from '../src/evidence/senate-committee-final-ocr-cohort.js';

test('final scan recovery is bounded to exactly the independent original run and remaining 152 PDFs',()=>{
  assert.equal(SENATE_FINAL_OCR_SOURCE_RUN,38066441841);
  assert.equal(SENATE_FINAL_OCR_MAX_BYTES,8_000_000);
  assert.equal(SENATE_FINAL_OCR_MAX_PAGES,8);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2022].sourceArtifactId,11674729430);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2025].sourceArtifactId,11675014092);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2022].fullLowText,121);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2025].fullLowText,51);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2022].priorOcr,11);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2025].priorOcr,9);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2022].remaining,110);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2025].remaining,42);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2022].batches,6);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2025].batches,3);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2022].remaining+
    SENATE_FINAL_OCR_EXPECTED[2025].remaining,152);
  for(const year of [2022,2025] as const) {
    assert.match(SENATE_FINAL_OCR_EXPECTED[year].originalJsonSha256,/^[a-f0-9]{64}$/);
    assert.match(SENATE_FINAL_OCR_EXPECTED[year].fullSourceUrlListSha256,/^[a-f0-9]{64}$/);
    assert.match(SENATE_FINAL_OCR_EXPECTED[year].selectedUrlsSha256,/^[a-f0-9]{64}$/);
    assert.ok(Math.ceil(SENATE_FINAL_OCR_EXPECTED[year].remaining/
      SENATE_FINAL_OCR_EXPECTED[year].batches)<=20);
  }
});

test('original PDF identity is Senate+year+hearing date only, not inferred from unrelated sources',()=>{
  const valid = {
    year:2022 as const,committeeName:'Finance',meetingDate:'2022-03-10',
    url:'https://www.lrl.mn.gov/archive/minutes/senate/2022/Fin/20220310/Fin_20220310_minutes.pdf',
  };
  assert.equal(isOfficialPinnedOriginal(valid),true);
  for(const changed of [
    {...valid,url:valid.url.replace('/senate/','/house/')},
    {...valid,url:valid.url.replace('20220310','20220311')},
    {...valid,url:valid.url+'?test=1'},
    {...valid,url:valid.url.replace('https:','http:')},
    {...valid,url:valid.url.replace('www.lrl.mn.gov','example.com')},
    {...valid,meetingDate:'2022-03-11'},
    {...valid,committeeName:''},
  ]) assert.equal(isOfficialPinnedOriginal(changed),false);
  assert.equal(isOfficialPinnedOriginal({
    year:2025, committeeName:'Judiciary and Public Safety',
    meetingDate:'2025-03-12',
    url:'https://www.lrl.mn.gov/archive/minutes/senate/2025/jud/20250312/Jud_20250312_minutes.pdf',
  }),true);
});

test('source batch refuses any artifact without the exact prior independently archived source hash',()=>{
  for(const year of [2022,2025] as const){
    assert.throws(()=>selectVerifiedFinalOriginals(year,'{}'),/Unverified original Actions source metadata/);
    assert.throws(()=>selectVerifiedFinalOriginals(year,'not json'),/Unverified original Actions source metadata/);
  }
});

test('no 2021 print, no 2023/24 already completed, no fabricated member votes',()=>{
  const fixedYears=Object.keys(SENATE_FINAL_OCR_EXPECTED).sort();
  assert.deepEqual(fixedYears,['2022','2025']);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2022].fullLowText-
    SENATE_FINAL_OCR_EXPECTED[2022].priorOcr,110);
  assert.equal(SENATE_FINAL_OCR_EXPECTED[2025].fullLowText-
    SENATE_FINAL_OCR_EXPECTED[2025].priorOcr,42);
});
