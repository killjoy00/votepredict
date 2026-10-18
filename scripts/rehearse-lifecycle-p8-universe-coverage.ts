/**
 * #310 deterministic synthetic-only two-day rehearsal. No network, Neon,
 * Vercel, official 2027 data, stored outcomes, serving model, or cron.
 */
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildOfflineP8DailyCapture,type P8DailyBillInput,
} from '../src/evaluation/lifecycle-p8-daily-capture.js';
import {
  writeOfflineP8DailyCapture,verifyOfflineP8BatchIntegrity,
} from '../src/evaluation/lifecycle-p8-offline-store.js';
import {
  P8_UNIVERSE_AUDIT_SCHEMA,P8_UNIVERSE_PROOF,
  sealP8SuppliedUniverseIndex,auditP8OfflineUniverseCoverage,
  auditP8OfflineCaptureContinuity,
} from '../src/evaluation/lifecycle-p8-universe-coverage.js';

const makeBill=(billId:string,identifier:string,firstObservedAt:string):P8DailyBillInput=>({
  billId,identifier,session:'2027-2028',
  chamber:identifier.startsWith('HF')?'house':'senate',
  introducedOn:'2027-01-04',adjournmentOn:'2028-05-20',
  firstObservedAt,sourceUrl:'https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/42/',
  sourceSha256:'1'.repeat(64),
  process:{status:'source_deferred',observedAt:null,parserVersion:null,events:[]},
  billVersions:[],
});
const known=[
  makeBill('synthetic-hf42','HF42','2027-01-05T16:00:00.000Z'),
  makeBill('synthetic-sf7','SF7','2027-01-06T16:00:00.000Z'),
  makeBill('synthetic-hf99','HF99','2027-01-08T16:00:00.000Z'),
];
const capture=(cutoffDateExclusive:string,bills:P8DailyBillInput[])=>
  buildOfflineP8DailyCapture({cutoffDateExclusive,
    capturedAt:cutoffDateExclusive+'T18:00:00.000Z',
    source:'offline_supplied_asof_fixtures',bills});
const universe=(cutoffDateExclusive:string,observedAt:string)=>
  sealP8SuppliedUniverseIndex({
    schemaVersion:P8_UNIVERSE_AUDIT_SCHEMA,session:'2027-2028',cutoffDateExclusive,
    source:{sourceUrl:'https://www.revisor.mn.gov',
      sourceSha256:'2'.repeat(64),observedAt,proofLevel:P8_UNIVERSE_PROOF},
    bills:known.map(x=>({billId:x.billId,identifier:x.identifier,
      firstObservedAt:x.firstObservedAt})),
  });
async function main(){
  const folder=await mkdtemp(join(tmpdir(),'votepredict-310-universe-'));
  try{
    const previous=capture('2027-01-10',known.slice(0,2));
    const current=capture('2027-01-11',known);
    const prevUniverse=universe('2027-01-10','2027-01-09T17:00:00.000Z');
    const currUniverse=universe('2027-01-11','2027-01-10T17:00:00.000Z');
    const initial=await writeOfflineP8DailyCapture(previous,folder);
    const idempotent=await writeOfflineP8DailyCapture(previous,folder);
    await writeOfflineP8DailyCapture(current,folder);
    const fromDisk=JSON.parse(await readFile(initial.filePath,'utf8'));
    verifyOfflineP8BatchIntegrity(fromDisk);
    const firstDay=auditP8OfflineUniverseCoverage(prevUniverse,fromDisk);
    const secondDay=auditP8OfflineUniverseCoverage(currUniverse,current);
    const continuity=auditP8OfflineCaptureContinuity({
      previousManifest:prevUniverse,previousBatch:fromDisk,
      currentManifest:currUniverse,currentBatch:current,
    });
    console.log(JSON.stringify({
      source:'synthetic_offline',
      firstDay:{captured:firstDay.coverage.capturedRows,missing:firstDay.coverage.missingRows},
      secondDay:{captured:secondDay.coverage.capturedRows,missing:secondDay.coverage.missingRows},
      replayIdempotent:idempotent.result==='already_present',
      firstObservationDrift:continuity.changedOriginalFirstObservation,
      officialDenominatorVerified:false,
      productionCaptureActivated:false,
      targetSessionOutcomesRead:false,
      predictionsComputed:false,
      servingChanged:false,
    }));
  }finally{await rm(folder,{recursive:true,force:true})}
}
void main().catch(()=>{console.error('P8_SYNTHETIC_UNIVERSE_REHEARSAL_HOLD');process.exitCode=1});
