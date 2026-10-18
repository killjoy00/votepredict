import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {buildOfflineP8DailyCapture,latestP8CaptureBeforeEvent,
  type P8DailyBillInput} from '../src/evaluation/lifecycle-p8-daily-capture.js';
import {writeOfflineP8DailyCapture,verifyOfflineP8BatchIntegrity}
  from '../src/evaluation/lifecycle-p8-offline-store.js';
import {
  P8_UNIVERSE_AUDIT_SCHEMA,P8_UNIVERSE_PROOF,
  sealP8SuppliedUniverseIndex,verifyP8SuppliedUniverseIndex,
  auditP8OfflineUniverseCoverage,auditP8OfflineCaptureContinuity,
  type P8SuppliedUniverseRow,type P8SuppliedUniverseIndex,
} from '../src/evaluation/lifecycle-p8-universe-coverage.js';

const base = (billId:string,identifier:string,firstObservedAt:string,
  parsed:boolean):P8DailyBillInput => ({
  billId,identifier,firstObservedAt,session:'2027-2028',
  chamber:identifier.startsWith('HF')?'house':'senate',
  introducedOn:'2027-01-04',adjournmentOn:'2028-05-20',
  sourceUrl:'https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/42/',
  sourceSha256:'a'.repeat(64),
  process: parsed?{status:'parsed',observedAt:firstObservedAt,
    parserVersion:'revisor-process-v2',events:[]}:
    {status:'source_deferred',observedAt:null,parserVersion:null,events:[]},
  billVersions:[],
});
const first=base('fixture-hf42','HF42','2027-01-05T16:00:00.000Z',true);
const second=base('fixture-sf7','SF7','2027-01-06T16:00:00.000Z',false);
const late=base('fixture-hf99','HF99','2027-01-08T16:00:00.000Z',true);
const bills:P8SuppliedUniverseRow[]=[
  {billId:first.billId,identifier:first.identifier,firstObservedAt:first.firstObservedAt},
  {billId:second.billId,identifier:second.identifier,firstObservedAt:second.firstObservedAt},
  {billId:late.billId,identifier:late.identifier,firstObservedAt:late.firstObservedAt},
];
function manifest(cutoffDateExclusive='2027-01-10',
  observedAt='2027-01-09T17:00:00.000Z',rows=bills) {
  return sealP8SuppliedUniverseIndex({
    schemaVersion:P8_UNIVERSE_AUDIT_SCHEMA,session:'2027-2028',
    cutoffDateExclusive,
    source:{sourceUrl:'https://www.revisor.mn.gov',
      sourceSha256:'c'.repeat(64),observedAt,proofLevel:P8_UNIVERSE_PROOF},
    bills:rows,
  });
}
const capture=(cutoff='2027-01-10',inputs=[first,second])=>
  buildOfflineP8DailyCapture({
    cutoffDateExclusive:cutoff,capturedAt:cutoff+'T18:00:00.000Z',
    source:'offline_supplied_asof_fixtures',bills:inputs,
  });

test('externally supplied universe is sealed deterministically and visibly uncertified',()=>{
  const m=manifest();const shuffled=manifest('2027-01-10',
    '2027-01-09T17:00:00.000Z',[...bills].reverse());
  assert.deepEqual(m,shuffled);
  verifyP8SuppliedUniverseIndex(m);
  const report=auditP8OfflineUniverseCoverage(m,capture());
  assert.equal(report.coverage.suppliedManifestCount,3);
  assert.equal(report.coverage.capturedRows,2);
  assert.equal(report.coverage.missingRows,1);
  assert.deepEqual(report.coverage.missingPublicIdentifierPreview,['HF99']);
  assert.equal(report.coverage.processSourceParsedRows,1);
  assert.deepEqual(report.coverage.byChamber,{
    house:{expected:2,captured:1,parsed:1},
    senate:{expected:1,captured:1,parsed:0},
  });
  assert.equal(report.independentOfficialDenominatorVerified,false);
  assert.equal(report.primaryProspectiveScoringAllowed,false);
  assert.equal(report.productionCaptureActivated,false);
});
test('a changed, duplicate or future-sourced manifest fails rather than improving coverage',()=>{
  const m=manifest();
  const {contentSha256: _ignored, ...unsigned}=m;
  assert.throws(()=>verifyP8SuppliedUniverseIndex({...m,contentSha256:'0'.repeat(64)}),
    /Modified/);
  assert.throws(()=>sealP8SuppliedUniverseIndex({
    ...unsigned,bills:[bills[0],{...bills[0],billId:'other'}],
  }),/Duplicate/);
  assert.throws(()=>sealP8SuppliedUniverseIndex({
    ...unsigned,bills:[{...bills[0],firstObservedAt:'2027-01-10T00:00:00.000Z'}],
  }),/future-observed|earlier universe/);
  assert.throws(()=>sealP8SuppliedUniverseIndex({...unsigned,
    source:{...m.source,observedAt:'2027-01-10T18:00:00.000Z'},
  }),/post-cutoff/);
  assert.throws(()=>sealP8SuppliedUniverseIndex({...unsigned,
    actualOutcome:true,
  } as unknown as Omit<P8SuppliedUniverseIndex,'contentSha256'>),/Unexpected/);
});
test('unknown or mismatched daily bill, edited hash, and future event are rejected',()=>{
  const m=manifest();
  assert.throws(()=>auditP8OfflineUniverseCoverage(m,capture('2027-01-10',[
    {...first,billId:'phantom'}])),/unenumerated/);
  assert.throws(()=>auditP8OfflineUniverseCoverage(m,capture('2027-01-10',[
    {...first,identifier:'HF43'}])),/unenumerated/);
  const original=capture();
  assert.throws(()=>auditP8OfflineUniverseCoverage(m,{
    ...original,rows:[{...original.rows[0],memberVoteLabel:'yea'} as
      unknown as typeof original.rows[number]],
  }),/immutable|Invalid/);
  assert.throws(()=>auditP8OfflineUniverseCoverage(m,{
    ...original,contentSha256:'f'.repeat(64),
  }),/immutable|modified/i);
  const wrongDay=manifest('2027-01-11','2027-01-10T17:00:00.000Z');
  assert.throws(()=>auditP8OfflineUniverseCoverage(wrongDay,original),/cutoff/);
});
test('two-day continuity catches loss and never uses same-day future events',()=>{
  const before=capture();
  const after=capture('2027-01-11',[first,second,late]);
  const check=auditP8OfflineCaptureContinuity({
    previousManifest:manifest(),previousBatch:before,
    currentManifest:manifest('2027-01-11','2027-01-10T17:00:00.000Z'),
    currentBatch:after,
  });
  assert.equal(check.previouslyCapturedNowMissing,0);
  assert.equal(check.changedOriginalFirstObservation,0);
  const selected=latestP8CaptureBeforeEvent(
    [...before.rows,...after.rows],'fixture-hf42','2027-01-11');
  assert.equal(selected?.cutoff.asOfDateExclusive,'2027-01-10');
  assert.equal(latestP8CaptureBeforeEvent(after.rows,'fixture-hf42','2027-01-11'),null);
  const missing=auditP8OfflineCaptureContinuity({
    previousManifest:manifest(),previousBatch:before,
    currentManifest:manifest('2027-01-11','2027-01-10T17:00:00.000Z'),
    currentBatch:capture('2027-01-11',[late]),
  });
  assert.equal(missing.previouslyCapturedNowMissing,2);
});
test('daily local files remain immutable and audit follows reloaded verified bytes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vp-p8-universe-audit-'));
  try{
    const day=capture();
    assert.equal((await writeOfflineP8DailyCapture(day,dir)).result,'created');
    assert.equal((await writeOfflineP8DailyCapture(day,dir)).result,'already_present');
    const path=join(dir,'lifecycle-p8-2027-01-10.json');
    const reloaded=JSON.parse(await readFile(path,'utf8'));
    verifyOfflineP8BatchIntegrity(reloaded);
    assert.equal(auditP8OfflineUniverseCoverage(manifest(),reloaded).coverage.missingRows,1);
    await assert.rejects(()=>writeOfflineP8DailyCapture(
      capture('2027-01-10',[first,late]),dir),/Immutable/);
  }finally{await rm(dir,{recursive:true,force:true})}
});
test('runnable offline proof emits gaps but never scoring or official completeness',()=>{
  const out=execFileSync(process.execPath,[
    '--import','tsx','scripts/rehearse-lifecycle-p8-universe-coverage.ts',
  ],{encoding:'utf8'});
  const report=JSON.parse(out);
  assert.equal(report.source,'synthetic_offline');
  assert.equal(report.firstDay.missing,1);
  assert.equal(report.secondDay.missing,0);
  assert.equal(report.replayIdempotent,true);
  assert.equal(report.officialDenominatorVerified,false);
  assert.equal(report.productionCaptureActivated,false);
});
