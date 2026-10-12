import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import type {OriginalSenateCommitteeYearAudit} from
 '../src/evidence/senate-committee-source-to-db-reconciliation.js';
import {compareOriginalSenateCommitteeToStored} from
 '../src/evidence/senate-864-source-db-sanitized-compare.js';
import {COMPLETE_OCR_PARITY_ONESHOT_MARKER} from
 '../scripts/audit-senate-864-protected-source-db-parity-v2.js';

const url='https://www.lrl.mn.gov/archive/minutes/senate/2024/Test/20240305/test_minutes.pdf';
const extra='https://www.lrl.mn.gov/archive/minutes/senate/2024/Test/20240306/test_minutes.pdf';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const key=(u:string)=>'senate-committee:'+sha(u).slice(0,16)+':0';
const originals=():OriginalSenateCommitteeYearAudit[]=>[{
 auditedYear:2024,independentlyDiscoveredOriginalMinutesPdfLinks:2,
 originalPdfsFetchedAndParsed:2,originalPdfsFailedOrUnparsed:0,
 unresolvedOriginalDocuments:[],
 documentProofs:[{
  document:{year:2024,sourceUrl:url,originalRawPdfSha256:'a'.repeat(64),
   meetingDate:'2024-03-05',committeeName:'Test'},
  voteObservations:[{
   externalKey:key(url),yeaCount:6,nayCount:4,
   individualVotesAvailable:true,namedMemberChoicesInPdf:10,
   choiceIdentitySha256:[
    ...Array.from({length:6},(_,i)=>sha('yea:Senator'+i)),
    ...Array.from({length:4},(_,i)=>sha('nay:Senator'+(6+i))),
   ].sort(),
  }],contextOnlyActions:[],
 },{
  document:{year:2024,sourceUrl:extra,originalRawPdfSha256:'b'.repeat(64),
   meetingDate:'2024-03-06',committeeName:'Test'},
  voteObservations:[],contextOnlyActions:[],
 }],
}];
const docs=[
 {id:'doc1',source_url:url,source_sha:'a'.repeat(64),meeting_date:'2024-03-05',committee_name:'Test'},
 {id:'doc2',source_url:extra,source_sha:'b'.repeat(64),meeting_date:'2024-03-06',committee_name:'Test'},
];
const events=[
 {id:'event1',source_document_id:'doc1',external_key:key(url),
  occurred_on:'2024-03-05',yea_count:6,nay_count:4},
 {id:'event2',source_document_id:'doc2',external_key:key(extra),
  occurred_on:'2024-03-06',yea_count:4,nay_count:4},
];
const choices=[
 ...Array.from({length:6},(_,i)=>({
  vote_event_id:'event1',normalized_member_name:'Senator'+i,
  choice:'yea',membership_id:'mem'+i,
 })),
 ...Array.from({length:3},(_,i)=>({
  vote_event_id:'event1',normalized_member_name:'Senator'+(6+i),
  choice:'nay',membership_id:'mem'+(6+i),
 })),
 ...Array.from({length:8},(_,i)=>({
  vote_event_id:'event2',normalized_member_name:'Extra'+i,
  choice:i<4?'yea':'nay',membership_id:'ext'+i,
 })),
];
test('2024 original roll has exactly one missing choice digest rather than ten missing votes',()=>{
 const r=compareOriginalSenateCommitteeToStored(originals(),{
  documents:docs,events,choices,
 },[{year:2024,sourceUrl:extra,externalKey:key(extra),
    meetingDate:'2024-03-06',sourceNamedChoiceTokensKnownCount:8}]);
 assert.equal(r.sourceParsedRawPdfShaMatches,2);
 assert.equal(r.matchedCandidateRollCallEvents,0);
 assert.equal(r.sourceCandidateRollCallEvents,1);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.sourceRollEventsWithNamedChoiceMismatch,1);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.originalNamedTokensInThoseRolls,10);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.persistedNamedTokensInThoseRolls,9);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.exactChoiceDigestIntersectionTokensInThoseRolls,9);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.originalNamedChoiceTokensAbsentFromPersistedDigestSet,1);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.storedNamedChoiceTokensNotInOriginalDigestSet,0);
 assert.equal(r.keyOnlyOriginalEventVerification.sourceRecognizedButOriginalTallyOrNameDigestsUnavailable,1);
 assert.equal(r.keyOnlyOriginalEventVerification.persistedExactKeyAndHearingDateMatches,1);
 assert.equal(r.keyOnlyOriginalEventVerification.persistedKeyDateAndChoiceCountMatches,1);
 assert.equal(r.keyOnlyOriginalEventVerification.sourceKeyOnlyNamedChoiceTokens,8);
 assert.equal(r.keyOnlyOriginalEventVerification.storedCountMatchedButIndividualNamedChoiceIdentitiesNotProven,8);
 assert.doesNotMatch(JSON.stringify(r),/Senator[0-9]|Extra[0-9]|lrl\.mn\.gov|source_url|normalized_member_name/);
});

test('same member count with wrong YEA/NAY identity is NOT falsely classified as missing count-only',()=>{
 const bad=[...choices.slice(0,9),{
  vote_event_id:'event1',normalized_member_name:'Intruder',
  choice:'nay',membership_id:'intruder',
 },...choices.slice(9)];
 const r=compareOriginalSenateCommitteeToStored(originals(),{
  documents:docs,events,choices:bad,
 });
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.sourceRollEventsWithNamedChoiceMismatch,1);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.originalNamedTokensInThoseRolls,10);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.persistedNamedTokensInThoseRolls,10);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.exactChoiceDigestIntersectionTokensInThoseRolls,9);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.originalNamedChoiceTokensAbsentFromPersistedDigestSet,1);
 assert.equal(r.originalVsPersistedNamedChoiceDigestDiscrepancy.storedNamedChoiceTokensNotInOriginalDigestSet,1);
});

test('key-only original cannot be double counted, source-unattributed or promoted to exact named votes',()=>{
 assert.equal(COMPLETE_OCR_PARITY_ONESHOT_MARKER,
  'SENATE_864_FULL_207_OCR_NEON_PARITY_ONESHOT_20261012_V2');
 assert.throws(()=>compareOriginalSenateCommitteeToStored(originals(),{
  documents:docs,events,choices,
 },[{year:2024,sourceUrl:extra,externalKey:key(url),
    meetingDate:'2024-03-06',sourceNamedChoiceTokensKnownCount:8}]),
 /double-counted/);
 assert.throws(()=>compareOriginalSenateCommitteeToStored(originals(),{
  documents:docs,events,choices,
 },[{year:2024,sourceUrl:'https://fake.org/extra',externalKey:key(extra),
    meetingDate:'2024-03-06',sourceNamedChoiceTokensKnownCount:8}]),
 /double-counted/);
});
