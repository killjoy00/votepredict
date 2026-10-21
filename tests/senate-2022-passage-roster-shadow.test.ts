import test from 'node:test';
import assert from 'node:assert/strict';
import {ballotSignature} from '../src/operations/senate-vote-paper-parser.js';
import {
 independentlyPrintedAttendanceNames,summarize2022PassageRosterShadow,
 SENATE_2022_PASSAGE_ROSTER_SHADOW,type StoredJournal
} from '../src/operations/senate-2022-passage-roster-shadow.js';
import type {AcceptedVote,ParsedAction}
 from '../src/operations/senate-same-source-question-census.js';

const url='https://www.senate.mn/journals/2021-2022/20220510106.pdf';
const day='2022-05-10',sourceId='source-a';
const question='The question was taken on the passage of the bill.';
const roster=[
 'Abeler','Housley',...Array.from({length:58},(_,i)=>{
  const a=String.fromCharCode(65+Math.floor(i/26));
  const b=String.fromCharCode(65+i%26);
  return 'Example'+a+b;
 })
];
function original(args:{additionalRoll?:boolean;quorum?:boolean}={}):string{
 const attending=[
  'ONE HUNDRED SIXTH DAY',
  'The roll was called, and the following Senators were present:',
  ...roster,
  ...(args.quorum===false?[]:['Pursuant to Rule 14.1, the President announced remote voting.']),
  'The President declared a quorum present.'
 ];
 const roll=[
  'S.F. No. 1391 was read the third time and placed on its final passage.',
  question,
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  'Those who voted in the affirmative were:',
  'Abeler',
  'Those who voted in the negative were:',
  'Housley',
  'So the bill passed and its title was agreed to.'
 ].join('\n');
 // Source shadow intentionally rejects tiny/truncated originals; preserve a
 // full-length fixture without changing the source roll or named ballots.
 return attending.join('\n')+'\n'+roll+(args.additionalRoll?'\n'+roll:'')+
  '\n'+('Official Senate Journal proceedings continued. '.repeat(45));
}
function action(changes:Partial<ParsedAction>={}):ParsedAction{
 return {id:'action-a',source_id:sourceId,source_url:url,bill_id:'bill-1',
  day,kind:'passage',sequence:1,question_text:question,motion_text:question,
  yea_count:1,nay_count:1,ballot_sha256:null,original_source_verified:true,...changes};
}
function vote(changes:Partial<AcceptedVote>={}):AcceptedVote{
 return {id:'vote-a',source_id:sourceId,source_url:url,bill_id:'bill-1',
  bill:'SF1391',session:'2021-2022',day,vote_kind:'passage',motion_text:question,
  yea_count:1,nay_count:1,
  votes:[{name:'Abeler',choice:'yea'},{name:'Housley',choice:'nay'}],
  exact_linked:false,stored_link:false,...changes};
}
function doc(changes:Partial<StoredJournal>={}):StoredJournal{
 return {id:sourceId,source_url:url,source_type:'mn_senate_journal',
  raw_text:original(),content_sha256:'a'.repeat(64),...changes};
}
test('source roster requires an original bounded opening quorum list with 55–67 unambiguous printed names',()=>{
 assert.equal(independentlyPrintedAttendanceNames(original()).length,60);
 assert.deepEqual(independentlyPrintedAttendanceNames(original({quorum:false}).replace('The President declared a quorum present.','Unverified ending.')),[]);
 assert.deepEqual(independentlyPrintedAttendanceNames(original().replace('Abeler\nHousley','Abeler\nAbeler')),[]);
 assert.deepEqual(independentlyPrintedAttendanceNames(original().replace('Pursuant to Rule 14.1','Unverified source')),roster);
 assert.deepEqual(independentlyPrintedAttendanceNames('The roll was called, and the following Senators were present:\nAbeler\nThe President declared a quorum present.'),[]);
});
test('source-attendance shadow recovers strict complete ballot + question WITHOUT creating a link',()=>{
 const r=summarize2022PassageRosterShadow([vote()],[action()],[doc()],1);
 assert.equal(r.schemaVersion,SENATE_2022_PASSAGE_ROSTER_SHADOW);
 assert.equal(r.targeted2021PassageVotes,1);
 assert.equal(r.sourceAttendanceRosters,1);
 assert.equal(r.strictlyUniqueQuestionAndFullBallotCandidates,1);
 assert.equal(r.stages.strict_unique_question_full_ballot_candidate,1);
 assert.equal(r.dbLinksCreated,0);
 assert.equal(r.acceptedVoteEventsChanged,false);
 assert.equal(r.paperActionsChanged,false);
 assert.equal(r.fullBillTextsCertified,0);
 const json=JSON.stringify(r);
 for(const disallowed of [sourceId,'Abeler','Housley',url,'The question was taken'])
  assert.equal(json.includes(disallowed),false);
});
test('source-only replay never promotes repeated source or accepted named ballots',()=>{
 const repeated=summarize2022PassageRosterShadow([vote()],[action()],[doc({raw_text:original({additionalRoll:true})})],1);
 assert.equal(repeated.stages.repeated_paper_ballot,1);
 const other=vote({id:'vote-b'});
 const duplicate=summarize2022PassageRosterShadow([vote(),other],[action()],[doc()],2);
 assert.equal(duplicate.stages.repeated_accepted_ballot,2);
 assert.equal(duplicate.strictlyUniqueQuestionAndFullBallotCandidates,0);
});
test('tampered/missing attendance, ballot, question, or original evidence remains held',()=>{
 const start=vote();
 assert.equal(summarize2022PassageRosterShadow([start],[action()],[doc({raw_text:original().replace('Abeler\nThose who','ExampleAA\nThose who')})],1)
  .stages.named_ballot_disagrees,1);
 assert.equal(summarize2022PassageRosterShadow([vote({motion_text:'The question was taken on tabling the bill.'})],[action()],[doc()],1)
  .stages.substantive_question_difference,1);
 assert.equal(summarize2022PassageRosterShadow([start],[action()],[doc({raw_text:'truncated'})],1)
  .stages.original_attendance_missing,1);
 assert.equal(summarize2022PassageRosterShadow([start],[action()],[doc({content_sha256:'wrong'})],1)
  .stages.original_attendance_missing,1);
 assert.equal(summarize2022PassageRosterShadow([start],[action({original_source_verified:false})],[doc()],1)
  .stages.no_verified_original_source,1);
 assert.throws(()=>summarize2022PassageRosterShadow([start],[action()],[doc()],2),/denominator/);
 assert.throws(()=>summarize2022PassageRosterShadow([start],[action()],[doc(),doc()],1),/duplicate|bounds/);
});
test('source attendance is not substituted for a missing named choice',()=>{
 const s=original().replace('Those who voted in the affirmative were:\nAbeler',
  'Those who voted in the affirmative were:\nNO VERIFIED SENATOR');
 const r=summarize2022PassageRosterShadow([vote()],[action()],[doc({raw_text:s})],1);
 assert.equal(r.stages.named_ballot_still_missing,1);
 assert.equal(r.dbLinksCreated,0);
 // A full printed roll is still needed: knowing who was present is insufficient.
 assert.equal(ballotSignature([],1,1),null);
});
