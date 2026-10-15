import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {compareSenate864OriginalClerkDocumentsToStored} from
 '../src/evidence/senate-864-clerk-written-source-db-audit.js';
const rows=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json','utf8')
).perOriginallyIndexedNoPdfMeeting;
const auth=rows.filter((x:any)=>x.originalClerkSha256!==null);
const url=(x:any)=>'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id='+
 x.originalSenateHearingId+'&ls='+(x.year===2022?92:x.year===2025?94:93)+'&type=minutes';
const sample=auth[0];
test('full 141 official committee dates conserves 111 independently authenticated Clerk original and one orphan LRL PDF; no claimed DB rows',()=>{
 const v=compareSenate864OriginalClerkDocumentsToStored(rows,[],[]);
 assert.equal(v.independentlyAuthenticatedAlternateOriginalSourceDocuments,112);
 assert.equal(v.alternateOriginalClerkHtmlBodies,111);
 assert.equal(v.otherOriginalLrlPdfs,1);
 assert.equal(v.originalSourceNotFound,112);
 assert.equal(v.oneExactStoredSourceMetadataMatch,0);
 assert.equal(v.storedCommitteeEventsOnExactMatchingSource,0);
 assert.deepEqual(v.byYear.map(x=>[
  x.year,x.expectedClerkBodies,x.expectedOrphanPdfs]),[
  [2022,7,1],[2023,58,0],[2024,28,0],[2025,18,0]
 ]);
 assert.equal(v.noDatabaseWrites,true);
 assert.equal(v.positionalBackfillNotAuthorized,true);
 assert.equal(v.exactOriginalActionsToStoredMemberVotesNotCompared,true);
 assert.equal(v.deployedProductionNeonBranchBindingNotAsserted,true);
 assert.equal(v.year2021ExcludedFromAllOriginalSourceMembershipAndVotes,true);
 assert.doesNotMatch(JSON.stringify(v),/source_url|source_member_name|membership_id|sourceSha256|postgresql/i);
});
test('one exact Senate source SHA plus original hearing ID and committee/date proves only stored document and numerical event/choice presence',()=>{
 const doc={id:'fake-document-id',source_url:url(sample),
  content_sha256:sample.originalClerkSha256,
  committee_name:sample.committeeName,meeting_date:sample.hearingDate};
 const a={source_document_id:doc.id,recorded_events:3,recorded_member_choices:18,
  choices_with_membership:16};
 const r=compareSenate864OriginalClerkDocumentsToStored(rows,[doc],[a]);
 assert.equal(r.oneExactStoredSourceMetadataMatch,1);
 assert.equal(r.originalSourceNotFound,111);
 assert.equal(r.storedCommitteeEventsOnExactMatchingSource,3);
 assert.equal(r.storedMemberChoicesOnExactMatchingSource,18);
 assert.equal(r.storedResolvedMemberChoicesOnExactMatchingSource,16);
 assert.equal(r.exactOriginalActionsToStoredMemberVotesNotCompared,true);
});
test('source original SHA exists under alternate URL, wrong SHA, missing committee/date and duplicates are never promoted to exact stored parity',()=>{
 const d={id:'doc-1',source_url:url(sample),content_sha256:sample.originalClerkSha256,
  meeting_date:sample.hearingDate,committee_name:sample.committeeName};
 const alternate=compareSenate864OriginalClerkDocumentsToStored(rows,[
  {...d,source_url:'https://www.example.org/copy-of-official-minutes.html'}
 ],[]);
 assert.equal(alternate.bodyOnlyStoredUnderOtherSourceUrl,1);
 assert.equal(alternate.oneExactStoredSourceMetadataMatch,0);
 const mismatch=compareSenate864OriginalClerkDocumentsToStored(rows,[
  {...d,content_sha256:'b'.repeat(64)}
 ],[]);
 assert.equal(mismatch.duplicatedOrMismatchedSourceRecord,1);
 const stale=compareSenate864OriginalClerkDocumentsToStored(rows,[
  {...d,meeting_date:'2022-01-01'}
 ],[]);
 assert.equal(stale.duplicatedOrMismatchedSourceRecord,1);
 const dup=compareSenate864OriginalClerkDocumentsToStored(rows,[
  d,{...d,id:'doc-2'}
 ],[]);
 assert.equal(dup.duplicatedOrMismatchedSourceRecord,1);
});
test('truncated source census, 2021, duplicate indexed hearing or unbounded SQL summary cannot produce a confident gap result',()=>{
 assert.throws(()=>compareSenate864OriginalClerkDocumentsToStored(rows.slice(1),[],[]),/Strict original/);
 assert.throws(()=>compareSenate864OriginalClerkDocumentsToStored([
  {...rows[0],year:2021},...rows.slice(1)
 ],[],[]),/Not an exact original indexed/);
 assert.throws(()=>compareSenate864OriginalClerkDocumentsToStored([
  rows[0],...rows.slice(1,-1),rows[0]
 ],[],[]),/Not an exact original indexed|Duplicate/);
 const d={id:'dup',source_url:url(sample),content_sha256:sample.originalClerkSha256,
  meeting_date:sample.hearingDate,committee_name:sample.committeeName};
 assert.throws(()=>compareSenate864OriginalClerkDocumentsToStored(rows,[d,d],[]),/duplicate/);
 assert.throws(()=>compareSenate864OriginalClerkDocumentsToStored(rows,[d],[
  {source_document_id:d.id,recorded_events:1,recorded_member_choices:1,choices_with_membership:2}
 ]),/aggregate invalid/);
});
