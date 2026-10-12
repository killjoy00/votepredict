import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {compareOriginalSenateCommitteeToStored,
 type CommitteeStoredDoc,type CommitteeStoredEvent,type CommitteeStoredChoice,
} from '../src/evidence/senate-864-source-db-sanitized-compare.js';
import type {OriginalSenateCommitteeYearAudit} from
 '../src/evidence/senate-committee-source-to-db-reconciliation.js';
import {
 SOURCE_PARITY_ONESHOT_MARKER,ORIGINAL_ARTIFACT_SOURCE_RUN,
 COMMITTEE_PARITY_QUERIES,DOC_SQL,EVENT_SQL,CHOICE_SQL,
 verifyPinnedOfficialSourceManifests,protectedCommitteeSourceParity,
} from '../scripts/audit-senate-864-protected-source-db-parity.js';

const source='https://www.lrl.mn.gov/archive/minutes/senate/2023/fin/20230308/Fin_20230308_Minutes.pdf';
const unresolved='https://www.lrl.mn.gov/archive/minutes/senate/2023/fin/20230309/Fin_20230309_Minutes.pdf';
const originalSha='a'.repeat(64);
const sha=(str:string)=>createHash('sha256').update(str).digest('hex');
const eventKey='senate-committee:'+sha(source).slice(0,16)+':0';
const id='11',eventId='22';
const docs:CommitteeStoredDoc[]=[
 {id,source_url:source,source_sha:originalSha,meeting_date:'2023-03-08',committee_name:'Finance'},
 {id:'12',source_url:unresolved,source_sha:'b'.repeat(64),
  meeting_date:'2023-03-09',committee_name:'Finance'},
];
const events:CommitteeStoredEvent[]=[{
 id:eventId,source_document_id:id,external_key:eventKey,
 occurred_on:'2023-03-08',yea_count:1,nay_count:1,
}];
const choices:CommitteeStoredChoice[]=[
 {vote_event_id:eventId,normalized_member_name:'Johnson',choice:'yea',membership_id:'mn1'},
 {vote_event_id:eventId,normalized_member_name:'Murphy',choice:'nay',membership_id:'mn2'},
];
const original=():OriginalSenateCommitteeYearAudit=>({
 auditedYear:2023,independentlyDiscoveredOriginalMinutesPdfLinks:2,
 originalPdfsFetchedAndParsed:1,originalPdfsFailedOrUnparsed:1,
 documentProofs:[{
  document:{year:2023,committeeName:'Finance',meetingDate:'2023-03-08',
   sourceUrl:source,originalRawPdfSha256:originalSha},
  voteObservations:[{
   externalKey:eventKey,yeaCount:1,nayCount:1,individualVotesAvailable:true,
   namedMemberChoicesInPdf:2,choiceIdentitySha256:[
    sha('yea:Johnson'),sha('nay:Murphy'),
   ].sort(),
  }],
  contextOnlyActions:[],
 }],
 unresolvedOriginalDocuments:[{sourceUrl:unresolved,meetingDate:'2023-03-09'}],
});

test('strictly compare original raw PDF bytes/URL/date and original named choices, sanitize public result',()=>{
 const r=compareOriginalSenateCommitteeToStored([original()],{documents:docs,events,choices});
 assert.equal(r.schemaVersion,'mn-864-senate-committee-original-vs-neon-sanitized-v1');
 assert.deepEqual(r.scopeYears,[2023]);
 assert.equal(r.sourceOriginalPdfUrlReferences,2);
 assert.equal(r.originalPdfsWithIndependentRawPdfSha,1);
 assert.equal(r.originalPdfsWithoutIndependentRawPdfSha,1);
 assert.equal(r.sourceExactUrlOneToOne,2);
 assert.equal(r.sourceParsedRawPdfShaMatches,1);
 assert.equal(r.sourceParsedRawPdfShaMismatches,0);
 assert.equal(r.originalUrlsAbsentFromStoredRecords,0);
 assert.equal(r.duplicateStoredUrlsForOriginals,0);
 assert.equal(r.sourceCandidateRollCallEvents,1);
 assert.equal(r.matchedCandidateRollCallEvents,1);
 assert.equal(r.sourceCandidateNamedChoiceTokens,2);
 assert.equal(r.matchingCandidateNamedChoiceTokensWithNonNullMembership,2);
 assert.equal(r.byYear[0]?.unparsedUrlLocated,1);
 assert.equal(r.sourceContextActionsReconciled,false);
 assert.equal(r.fullHistoricalReconciliationCertified,false);
 assert.equal(r.neverEligibleForPredictionFromThisAudit,true);
 const safe=JSON.stringify(r);
 assert.doesNotMatch(safe,/Johnson|Murphy|lrl\.mn\.gov|[a-f]{64}|2023-03-08|mn1|mn2|source_url/);
});

test('matching totals alone do not hide absent source, extra stored source or duplicate source URL',()=>{
 const d=[docs[0]!,{...docs[0]!,id:'extra-id'},
  {id:'untrusted',source_url:'https://www.lrl.mn.gov/archive/minutes/senate/2023/fin/20230310/Fin_20230310_Minutes.pdf',
   source_sha:'f'.repeat(64),meeting_date:'2023-03-10',committee_name:'Finance'}];
 const r=compareOriginalSenateCommitteeToStored([original()],{
  documents:d,events,choices,
 });
 assert.equal(r.storedCommitteeSourceRows,3);
 assert.equal(r.duplicateStoredUrlsForOriginals,1);
 assert.equal(r.originalUrlsAbsentFromStoredRecords,1);
 assert.equal(r.storedRowsOutsideOriginalUrlSet,1);
 assert.equal(r.sourceParsedRawPdfShaMatches,0);
 assert.equal(r.matchedCandidateRollCallEvents,0);
 assert.ok(r.mismatchDocumentCountsByCategory.duplicate_persisted_source!>0);
});

test('same original PDF URL but different SHA, date, roll key, tally or choice is NOT exact match',()=>{
 const x=compareOriginalSenateCommitteeToStored([original()],{
  documents:[{...docs[0]!,source_sha:'b'.repeat(64),meeting_date:'2023-03-07'},docs[1]!],
  events,choices,
 });
 assert.equal(x.sourceParsedRawPdfShaMismatches,1);
 assert.equal(x.byYear[0]?.parsedMetadataMismatches,1);
 assert.equal(x.matchedCandidateRollCallEvents,0);
 assert.ok(x.mismatchDocumentCountsByCategory.original_pdf_hash_mismatch!>0);
 const y=compareOriginalSenateCommitteeToStored([original()],{
  documents:docs,
  events:[{...events[0]!,nay_count:5}],
  choices:[{...choices[0]!,choice:'nay'},choices[1]!],
 });
 assert.equal(y.matchedCandidateRollCallEvents,0);
 assert.equal(y.matchingCandidateNamedChoiceTokensWithNonNullMembership,0);
 assert.ok(y.mismatchDocumentCountsByCategory.persisted_roll_call_tally_mismatch!>0);
 assert.ok(y.mismatchDocumentCountsByCategory.original_named_choices_mismatch!>0);
});

test('unparsed original document URL can match but its PDF byte SHA is NOT certified',()=>{
 const r=compareOriginalSenateCommitteeToStored([original()],{
  documents:[docs[1]!],events:[],choices:[],
 });
 assert.equal(r.sourceExactUrlOneToOne,1);
 assert.equal(r.originalPdfsWithoutIndependentRawPdfSha,1);
 assert.equal(r.byYear[0]?.unparsedMeetingDateMatches,1);
 assert.equal(r.sourceParsedRawPdfShaMatches,0);
 assert.equal(r.originalUrlsAbsentFromStoredRecords,1);
});

test('invalid original source, duplicate row ID, unexpected choice and oversized query fail closed',()=>{
 const o=original();o.auditedYear=2026;
 assert.throws(()=>compareOriginalSenateCommitteeToStored([o],{
  documents:docs,events,choices,
 }),/invalid/i);
 assert.throws(()=>compareOriginalSenateCommitteeToStored([original()],{
  documents:[docs[0]!,docs[0]!],events,choices,
 }),/collision/);
 assert.throws(()=>compareOriginalSenateCommitteeToStored([original()],{
  documents:docs,events,choices:[{...choices[0]!,choice:'imaginary'}],
 }),/Malformed/);
 assert.throws(()=>compareOriginalSenateCommitteeToStored([original()],{
  documents:Array.from({length:2201},()=>docs[0]!),events,choices,
 }),/bound/);
});

test('all three SQL queries are immutable, bounded and separately plan-checkable',()=>{
 assert.equal(SOURCE_PARITY_ONESHOT_MARKER,'SENATE_864_SOURCE_TO_DB_PARITY_ONESHOT_20261011_V1');
 assert.equal(ORIGINAL_ARTIFACT_SOURCE_RUN,38066441841);
 assert.deepEqual([...COMMITTEE_PARITY_QUERIES],[DOC_SQL,EVENT_SQL,CHOICE_SQL]);
 for(const q of COMMITTEE_PARITY_QUERIES){
  assert.match(q,/^SELECT /);
  assert.match(q,/\bLIMIT (?:2201|601|4001)\b/);
  assert.doesNotMatch(q,/;|\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY)\b/i);
 }
 assert.match(DOC_SQL,/source_kind='senate_committee_minutes'/);
 assert.match(EVENT_SQL,/committeeVote/);
 assert.match(CHOICE_SQL,/JOIN vote_events/);
 assert.throws(()=>verifyPinnedOfficialSourceManifests(()=>Buffer.from('tampered')),
  /SHA\/bound/);
});

test('protected Neon reuse opens READ ONLY, executes only three fixed SELECTs, explicitly ROLLBACK, never emits source names',async()=>{
 const apiKey='DUMMY_KEY',projectId='blue-owl-12345',branchId='br-quiet-moon-111';
 const endpoint='ep-brisk-stream-123',host=endpoint+'.us-east-2.aws.neon.tech';
 const uri='postgresql://neondb_owner:TEST_PASSWORD@'+host+'/neondb?sslmode=require&channel_binding=require';
 const base='https://console.neon.tech/api/v2/projects/'+projectId;
 const seen:string[]=[];
 let released=0,ended=0;
 const fakeFetch=async(url:string,init:RequestInit)=>{
  assert.equal(init.method,'GET');
  assert.equal((init.headers as Record<string,string>).Authorization,'Bearer '+apiKey);
  let body:unknown;
  if(url===base)body={project:{id:projectId,name:'VotePredict'}};
  else if(url===base+'/branches?limit=100')
   body={branches:[{id:branchId,project_id:projectId,default:true}],pagination:{next:null}};
  else if(url===base+'/branches/'+branchId+'/databases')
   body={databases:[{name:'neondb',branch_id:branchId,owner_name:'neondb_owner'}]};
  else if(url===base+'/endpoints')
   body={endpoints:[{id:endpoint,project_id:projectId,branch_id:branchId,type:'read_write',host}]};
  else if(url.startsWith(base+'/connection_uri?'))body={uri};
  else throw Error('Unexpected Neon API action');
  return new Response(JSON.stringify(body),{status:200});
 };
 const fakePool=(o:ConstructorParameters<typeof Pool>[0])=>{
  assert.equal(o?.user,'neondb_owner');
  assert.equal(o?.host,host);
  assert.equal(o?.password,'TEST_PASSWORD');
  assert.match(String(o?.options),/default_transaction_read_only=on/);
  return {
   connect:async()=>({
    query:async(sql:string)=>{
     seen.push(sql);
     if(sql.startsWith('BEGIN')||sql==='ROLLBACK')return {rows:[]};
     if(sql.includes('current_database()'))return {rows:[{db:'neondb',role:'neondb_owner',ro:'on'}]};
     if(sql===DOC_SQL)return {rows:docs};
     if(sql===EVENT_SQL)return {rows:events};
     if(sql===CHOICE_SQL)return {rows:choices};
     throw Error('Unexpected SQL');
    },
    release:()=>{released++},
   }),
   end:async()=>{ended++},
  } as unknown as Pick<Pool,'connect'|'end'>;
 };
 const phases:string[]=[];
 const r=await protectedCommitteeSourceParity([original()],{
  apiKey,projectId,
 },fakeFetch as Parameters<typeof protectedCommitteeSourceParity>[2],fakePool,
  p=>phases.push(p));
 assert.equal(r.matchedCandidateRollCallEvents,1);
 assert.equal(r.matchingCandidateNamedChoiceTokensWithNonNullMembership,2);
 assert.equal(seen[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.deepEqual(seen.filter(q=>COMMITTEE_PARITY_QUERIES.includes(q as typeof DOC_SQL)),
  [...COMMITTEE_PARITY_QUERIES]);
 assert.equal(seen.at(-1),'ROLLBACK');
 assert.equal(released,1);assert.equal(ended,1);
 assert.equal(phases.at(-1),'rolled_back');
 assert.doesNotMatch(JSON.stringify(r),/Johnson|Murphy|lrl|neondb|TEST_PASSWORD/);
});
