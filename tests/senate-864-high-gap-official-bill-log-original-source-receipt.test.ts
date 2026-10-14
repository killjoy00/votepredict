import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const LEDGER='docs/evaluation/source-proof/senate-864-2024-25-high-gap-official-bill-log-original-source-receipt.json';
const CLERK='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-source-receipts.json';
const INDEX='docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const sha=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const key=(year:number,committee:string,hearingDate:string)=>year+'|'+committee+'|'+hearingDate;

test('two full original government Senate Bill Log PDF hashes and 14 exact missing-Clerk dates are immutable',()=>{
 const p=read(LEDGER),c=read(CLERK),i=read(INDEX);
 assert.equal(p.schemaVersion,'senate-864-2024-25-two-official-original-bill-logs-source-receipt-v1');
 assert.equal(p.proof.successfulActualSourceRunId,38356613399);
 assert.equal(p.proof.originalArtifactId,11793330192);
 assert.equal(p.proof.originalArtifactZipSha256,'758e0d0d8968018a3751fb8f254f32a04c3b7e25646f66f955334623bfb7fcb5');
 assert.equal(p.typedOriginals.length,2);
 const received=p.typedOriginals.map((d:any)=>[
  d.year,d.committee,d.originalPdfSha256,d.originalPdfBytes,d.originalPdfPages,
  d.extractedTextSha256,d.observedBillSections,d.observedSourceStatusRows,
  d.dayBillStatusRows.length
 ]);
 assert.deepEqual(received,[
  [2024,'Taxes','ac52199cd91e87cbe243daa58334ef0e02cf3f3113696ea674a47385bf5a12e3',2516787,76,'68911d8af4852117faea491b0ad34efaf25e63145f9814e5a61116a7ee705d08',271,63,11],
  [2025,'Energy, Utilities, Environment, and Climate','8bbb79ed3583ace73ac84ef73d6c9696b5a8d34454b214776b87b22fde92f278',249428,9,'48dbca240097fa58ab8d14adaf043c20c40bcd81e562c9964357961739a53fd8',28,7,3]
 ]);
 const official=new Set(i.meetings.map((m:any)=>key(m.year,m.committeeName,m.hearingDate)));
 const held=new Set(c.everyOriginalMeeting.filter((m:any)=>m.senateClerkHtmlSha===null)
  .map((m:any)=>key(m.year,m.committeeName,m.hearingDate)));
 assert.equal(official.size,53);
 assert.equal(held.size,15);
 const observed=new Set<string>();
 for(const d of p.typedOriginals){
  assert.equal(d.sourceUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'),true);
  assert.equal(sha(d.originalPdfSha256)&&sha(d.extractedTextSha256),true);
  assert.equal(Number.isFinite(Date.parse(d.sourceFetchedAt)),true);
  let subtotal=0;
  for(const row of d.dayBillStatusRows){
   const k=key(d.year,d.committee,row.hearingDate);
   assert.equal(official.has(k),true,'Every supplemental bill-log day is officially indexed');
   assert.equal(held.has(k),true,'Bill logs cannot replace an already authenticated Clerk original');
   assert.equal(observed.has(k),false,'Duplicate source day');
   observed.add(k);
   assert.equal(Number.isSafeInteger(row.printedBillDateStatuses)&&row.printedBillDateStatuses>0,true);
   subtotal+=row.printedBillDateStatuses;
  }
  assert.equal(subtotal,d.observedSourceStatusRows);
 }
 assert.equal(observed.size,14);
 assert.deepEqual([...held].filter(k=>!observed.has(k)),[
  key(2025,'Energy, Utilities, Environment, and Climate','2025-04-28')
 ]);
});

test('bill/date status context cannot be promoted to parliamentary motions, member choices, stored rows or historical PDF publication time',()=>{
 const p=read(LEDGER);
 assert.equal(p.summary.historicallyIndexedMeetingsWithoutClerkOriginalCoveredByLog,14);
 assert.equal(p.summary.sourceBillDateStatusEntries,70);
 assert.equal(p.summary.originalOfficialParliamentaryMotionIdentitiesVerified,0);
 assert.equal(p.summary.independentlyProvenNamedYeaNayFromBillLogs,0);
 assert.equal(p.summary.independentHistoricalExactSourceFirstPublicByCount,0);
 assert.equal(p.originalFullRecordedMotionDenominatorKnown,false);
 assert.equal(p.namedSenatorChoiceInferred,false);
 assert.equal(p.privateRowExported,false);
 assert.equal(p.sourceToDatabaseMatched,false);
 assert.equal(p.ownerConvention.sameDayCutoffExcluded,true);
 assert.ok(p.holds.some((s:string)=>s.includes('not establish 70 distinct motions')));
 const json=JSON.stringify(p);
 assert.doesNotMatch(json,/member_vote_row_id|storedEventId|originalYeaPersonName|namedSideSha256/);
});
