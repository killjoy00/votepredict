import test from 'node:test';
import assert from 'node:assert/strict';
import {
 select19OfficialUnverifiedLrlPdfMeetingSources,
 inspectHeldOfficialMinuteOriginalText
} from '../src/evidence/senate-864-held-original-pdf-print-identity.js';
const src='https://www.lrl.mn.gov/archive/minutes/senate/';
const held:Array<[number,string,string,number]>=[
 [2023,'Taxes','2023-04-27',1],[2023,'Taxes','2023-05-12',1],
 [2024,'Taxes','2024-03-07',2],
 [2024,'Energy, Utilities, Environment and Climate','2024-03-20',1],
 [2024,'Taxes','2024-04-03',2],
 [2024,'Health and Human Services','2024-04-04',1],
 [2024,'Taxes','2024-04-04',2],[2024,'Taxes','2024-04-09',2],
 [2024,'Taxes','2024-04-16',2],[2024,'Taxes','2024-04-17',2],
 [2024,'Taxes','2024-04-18',2],[2024,'Taxes','2024-04-25',2],
 [2024,'Taxes','2024-05-01',2],[2024,'Taxes','2024-05-02',2],
 [2024,'Taxes','2024-05-07',2],
 [2025,'Energy, Utilities, Environment, and Climate','2025-04-02',1],
 [2025,'Energy, Utilities, Environment, and Climate','2025-04-07',1],
 [2025,'Energy, Utilities, Environment, and Climate','2025-04-09',1],
 [2025,'Energy, Utilities, Environment, and Climate','2025-04-28',1],
];
function fixtures(){
 const data=held.map(([year,committeeName,hearingDate,n])=>{
  const day=hearingDate.replaceAll('-','');
  const key=committeeName.startsWith('Taxes')?'taxes':'energy';
  const originalPdfDocuments=Array.from({length:n},(_,i)=>({
   originalSourceUrl:
    src+year+'/'+key+'/'+day+'/'+key+'_'+day+
    (n===2?i?'_Previous-Meeting-Minutes.pdf':'_Final-Meeting-Minutes.pdf':
      '_Minutes-and-Attendance.pdf'),
   originalPdfSha256:null,
   status:'original_lrl_link_exists_but_pdf_transport_or_printed_identity_HOLD'
  }));
  return {year,committeeName,hearingDate,sourceStatus:'linked_original_lrl_pdf_unverified',
   originalMinutePdfCandidatesFound:n,originalMinutePdfsAuthenticated:0,originalPdfDocuments};
 });
 const others=Array.from({length:10},(_,i)=>({
  year:2022,committeeName:'Unlinked Source '+i,hearingDate:'2022-03-'+String(1+i).padStart(2,'0'),
  sourceStatus:'no_original_alternate_lrl_pdf_link_on_government_page',
  originalMinutePdfCandidatesFound:0,originalMinutePdfsAuthenticated:0,originalPdfDocuments:[]
 }));
 return [...data,...others];
}
test('all original held committee-day PDF index URLs conserve 19 days, exactly 30 possible signed/final/prior PDFs',()=>{
 const j=fixtures();
 assert.equal(j.length,29);
 const y23=select19OfficialUnverifiedLrlPdfMeetingSources(j,2023);
 const y24=select19OfficialUnverifiedLrlPdfMeetingSources(j,2024);
 const y25=select19OfficialUnverifiedLrlPdfMeetingSources(j,2025);
 assert.equal(y23.length,2);assert.equal(y24.length,24);assert.equal(y25.length,4);
 assert.ok(y23.every(x=>x.year===2023&&x.hearingDate.startsWith('2023-')&&x.committeeName==='Taxes'));
 assert.ok(y24.every(x=>x.year===2024&&x.hearingDate.startsWith('2024-')&&x.committeeName.length>1));
 assert.ok(y25.every(x=>x.year===2025&&x.hearingDate.startsWith('2025-')));
 assert.ok([...y23,...y24,...y25].every(r=>r.status.includes('HOLD')));
});
test('official archive target day and exact printed committee must BOTH match; previous minutes file is not same-day evidence',()=>{
 const url=src+'2024/taxes/20240307/taxes_20240307_Final-Meeting-Minutes.pdf';
 const t={hearingDate:'2024-03-07',committeeName:'Taxes',originalSourceUrl:url};
 const exact=inspectHeldOfficialMinuteOriginalText({
  ...t,text:'Minnesota Senate - Taxes Committee\nThursday, March 7, 2024\n' +
   'MINUTES Present: Senator Example was present. Motion failed. A record of the meeting.'
 });
 assert.equal(exact.status,'likely_same_day_original_requires_review');
 assert.equal(exact.firstPrintedDateFromOriginalHeader,'2024-03-07');
 assert.equal(exact.exactOriginalPrintedMeetingDay,true);
 const previous=inspectHeldOfficialMinuteOriginalText({
  ...t,text:'Senate Committee on Taxes Minutes\nMarch 6, 2024\n'+
   'Present: Senator Example. The minutes of March 7, 2024 were adopted by the committee.'
 });
 assert.equal(previous.status,'different_meeting_day_likely_prior_minutes_attachment');
 assert.equal(previous.firstPrintedDateFromOriginalHeader,'2024-03-06');
 assert.equal(previous.sourceTextHasTargetMeetingDay,true);
 assert.equal(previous.exactOriginalPrintedMeetingDay,false);
 assert.equal(previous.printableOriginalExcerptNotPublished,true);
 const wrong=inspectHeldOfficialMinuteOriginalText({
  ...t,text:'Senate Committee on Energy Minutes March 7, 2024 '+
   'Present: Senator Example. Original meeting printed minutes.'
 });
 assert.equal(wrong.status,'committee_heading_mismatch');
 const noDate=inspectHeldOfficialMinuteOriginalText({
  ...t,text:'Senate Committee on Taxes MINUTES Present Senator Example had an original '+
   'discussion on tax law. The report of this original meeting is unsigned.'
 });
 assert.equal(noDate.status,'printed_minutes_header_or_day_missing');
});
test('unverified original government sources cannot be changed to an off-year or non-official-host PDF',()=>{
 const j=fixtures();
 assert.throws(()=>select19OfficialUnverifiedLrlPdfMeetingSources(j.slice(1),2023),/29 originally held/);
 const corrupted=fixtures();
 corrupted[0]!.originalPdfDocuments[0]!.originalSourceUrl=
  'https://example.com/archive/minutes/senate/2023/taxes/20230427/Taxes_Minutes.pdf';
 assert.throws(()=>select19OfficialUnverifiedLrlPdfMeetingSources(corrupted,2023),
  /identity or hold drift/);
 const heldWrong=fixtures();
 heldWrong[0]!.sourceStatus='independently_authenticated_alternative_original_lrl_pdf';
 assert.throws(()=>select19OfficialUnverifiedLrlPdfMeetingSources(heldWrong,2023),
  /universe drift/);
 assert.throws(()=>inspectHeldOfficialMinuteOriginalText({
  text:'valid text'.repeat(20),hearingDate:'2021-01-01',
  committeeName:'Taxes',originalSourceUrl:src+'2024/taxes/20240307/Minutes.pdf'
 }),/text identity invalid/);
});
