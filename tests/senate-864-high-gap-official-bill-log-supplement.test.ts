import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOriginalOfficialSenateBillLogText,SENATE864_OFFICIAL_LOG_SOURCES} from
 '../scripts/reconcile-senate-864-high-gap-original-bill-logs.js';
function fixture(year:2024|2025){
 const src=SENATE864_OFFICIAL_LOG_SOURCES.find(x=>x.year===year)!;
 const blocks=Array.from({length:18},(_,i)=>{
  const bill=String(i+1).padStart(4,'0');
  const special=i===0||i===1;
  const date=year===2024?'04/03/2024':'04/02/2025';
  return [
   'S.F.'+bill+': (AUTHORS: FICTIONAL; Companion to HF No. '+bill+'.)',
   'A bill for an act relating to '+src.committeeName+'; a fictional test bill.',
   'DATE       UNOFFICIAL STATUS FOR SF'+bill,
   special?date+'    Meeting scheduled for eight in Room G-15 Capitol':
    '06/03/'+year+'    Meeting scheduled for eight in Room G-15 Capitol',
   special?(i===0?'Amended, recommended to pass':'Not heard'):'Discussion only',
  ].join('\n');
 });
 return src.expectedSourcePdfTitle+'\n'+src.originalTextCommitteeHeader+'\n'+blocks.join('\n\n')+'\n';
}
test('2024 Taxes government bill log independently indexes date-scoped bill statuses without claiming named roll or Clerk-motion identities',()=>{
 const s=SENATE864_OFFICIAL_LOG_SOURCES[0]!;
 assert.equal(s.year,2024);assert.equal(s.targetDays.length,11);
 const r=inspectOriginalOfficialSenateBillLogText(fixture(2024),s,['2024-04-03']);
 assert.equal(r.recoveredBillLogDateStatusRows,2);
 assert.deepEqual(r.sourceLogBillStatuses.map(x=>[x.billReference,x.sourceLogActionClass]),[
  ['SF1','amended_or_recommended'],['SF2','not_heard']]);
 assert.equal(r.sourceLogBillStatuses.every(x=>x.individualMemberVoteAttributionProven===false),true);
 assert.equal(r.sourceLogBillStatuses.every(x=>x.parliamentaryMotionIdentityProven===false),true);
 assert.equal(r.byDay[0]?.sourceBillStatusRows,2);
 assert.match(r.extractedTextSha256,/^[0-9a-f]{64}$/);
 assert.equal(r.historicBillLogPublicByDateUnknown,true);
});
test('2025 Energy official bill log has separate government original source identity and date bounds',()=>{
 const s=SENATE864_OFFICIAL_LOG_SOURCES[1]!;
 assert.equal(s.year,2025);assert.equal(s.targetDays.length,3);
 assert.equal(s.originalOfficialUrl,
  'https://www.lrl.mn.gov/archive/minutes/senate/2025/energy/energy_2025_Bill-Log.pdf');
 const r=inspectOriginalOfficialSenateBillLogText(fixture(2025),s,['2025-04-02']);
 assert.equal(r.sourceLogBillStatuses.length,2);
 assert.equal(r.sourceLogBillStatuses[0]?.hearingDate,'2025-04-02');
 assert.ok(r.sourceLogBillStatuses[0]?.originalContextSha256);
});
test('cannot source-match date outside frozen 14 or a government PDF with the wrong committee title',()=>{
 const s=SENATE864_OFFICIAL_LOG_SOURCES[0]!;
 assert.throws(()=>inspectOriginalOfficialSenateBillLogText(fixture(2024),s,['2023-04-03']),/unrelated/);
 assert.throws(()=>inspectOriginalOfficialSenateBillLogText(fixture(2024),s,
  ['2024-04-03','2024-04-03']),/Prohibited/);
 assert.throws(()=>inspectOriginalOfficialSenateBillLogText(
  fixture(2024).replace('Committee on Taxes','Committee on Judiciary'),s,['2024-04-03']),
  /title or committee source HOLD/);
});
test('no source bill status for target day remains unverified, never a no-vote claim',()=>{
 const s=SENATE864_OFFICIAL_LOG_SOURCES[0]!;
 const r=inspectOriginalOfficialSenateBillLogText(fixture(2024),s,['2024-05-07']);
 assert.equal(r.recoveredBillLogDateStatusRows,0);
 assert.equal(r.byDay[0]?.sourceBillStatusRows,0);
 assert.equal(r.byDay[0]?.noBillStatusInSourceDoesNotEstablishNoCommitteeAction,true);
});
