import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {check29HeldOriginalMeetings,inspectOtherOriginalLrlCommitteePdfUrls,
 validateOriginalAlternatePdfText} from
 '../src/evidence/senate-864-nonstandard-lrl-minutes-source.js';
const src=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json','utf8'));
const held=src.perOriginallyIndexedNoPdfMeeting.filter((x:any)=>
 x.sourceClass==='no_written_minutes_authenticated_through_independent_routes');
const PAGE='https://www.lrl.mn.gov/minutes/comm?commid=9216-0&year=2023';
const HEAD='<html><h1>Education Finance - Senate - 2023</h1>'+
 '                                                                                                                    '.repeat(45);
const a=(url:string)=>'<a href="'+url+'">Open document in new tab</a>Minutes';
test('strict original 29 source leads excludes 2021 and preserves all year counts, no zeros inferred',()=>{
 const rows=check29HeldOriginalMeetings(held);
 assert.equal(rows.length,29);
 assert.deepEqual([2022,2023,2024,2025].map(year=>rows.filter(x=>x.year===year).length),
  [4,6,14,5]);
 assert.throws(()=>check29HeldOriginalMeetings([...rows.slice(0,-1),rows[0]]));
 assert.throws(()=>check29HeldOriginalMeetings([...rows.slice(0,-1),{
  ...rows.at(-1)!,year:2021
 }]));
});
test('official alternate archive extracts evening, morning and different filename Minutes, not other meeting PDFs',()=>{
 const morning='https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230315morning/fineduc_20230315_Minutes-morning.pdf';
 const evening='https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230315evening/fineduc_20230315_Minutes-evening.pdf';
 const otherDay='https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230314/fineduc_20230314_minutes.pdf';
 const agenda='https://www.lrl.mn.gov/archive/minutes/senate/2023/fineduc/20230315evening/fineduc_20230315_Agenda.pdf';
 const lookAlike='https://www.example.com/archive/minutes/senate/2023/fineduc/20230315evening/fineduc_20230315_Minutes.pdf';
 const html=HEAD+a(morning)+a(evening)+a(evening)+a(agenda)+a(otherDay)+a(lookAlike)+'</html>';
 const x=inspectOtherOriginalLrlCommitteePdfUrls({
  year:2023,committeeName:'Education Finance',meetingDate:'2023-03-15',
  lrlCommitteePageUrl:PAGE,html
 });
 assert.deepEqual(x.map(p=>p.sourceUrl),[evening,morning]);
 assert.ok(x.every(p=>p.recoveredFromNonstandardArchivePath));
 assert.ok(x.every(p=>p.sourceArchiveDateDirectory.startsWith('20230315')));
 const wrongDay=inspectOtherOriginalLrlCommitteePdfUrls({
  year:2023,committeeName:'Education Finance',meetingDate:'2023-02-16',
  lrlCommitteePageUrl:PAGE,html
 });
 assert.equal(wrongDay.length,0);
});
test('named 2023 original committee, hearing date and formal Senate minutes must be printed in authentic PDF',()=>{
 const sample='Education Finance Committee Thursday, February 16, 2023 6:00 PM Livestream YouTube Minutes\n'+
  'Present: Senator Mary K. Kunesh. Senator McEwen offered the a-1 amendment, a-1 amendment passed with a voice vote. '+ 
  'Senator Gustafson moved that S.F. 32 be recommended to pass and re-referred to Higher Education. - MOTION PREVAILED.';
 const good=validateOriginalAlternatePdfText({
  year:2023,committeeName:'Education Finance',meetingDate:'2023-02-16',originalText:sample
 });
 assert.equal(good.officialExactCommitteeAndDayPrinted,true);
 assert.match(good.originalNormalizedTextSha256,/^[0-9a-f]{64}$/);
 assert.throws(()=>validateOriginalAlternatePdfText({
  year:2023,committeeName:'Education Finance',meetingDate:'2023-03-15',
  originalText:sample
 }),/different hearing date/);
 assert.throws(()=>validateOriginalAlternatePdfText({
  year:2023,committeeName:'Taxes',meetingDate:'2023-02-16',originalText:sample
 }),/different Senate committee/);
 assert.throws(()=>validateOriginalAlternatePdfText({
  year:2023,committeeName:'Education Finance',meetingDate:'2023-02-16',
  originalText:sample.replace('Minutes','Agenda')
 }),/formal official Senate Minutes/);
});
test('no automatic member identity, DB write, legacy backfill or 2021 source can enter original-only scanner',()=>{
 const text=readFileSync('scripts/recover-senate-864-nonstandard-lrl-original-minutes.ts','utf8');
 assert.doesNotMatch(text,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE|2021,\s*2022)\b/);
 assert.match(text,/validateOriginalAlternatePdfText/);
 assert.match(text,/sourceIndividualHistoricalMemberIdJoinPerformed:false/);
 assert.match(text,/originalPdfSha256:result.contentSha256/);
 assert.match(text,/originalMinutePdfsAuthenticated/);
});
