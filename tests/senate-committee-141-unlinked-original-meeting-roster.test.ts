import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const bytes=readFileSync(new URL('../docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json',import.meta.url));
const j=JSON.parse(bytes.toString('utf8'));
const hash=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
const gitBlob=(data:Uint8Array)=>createHash('sha1').update('blob '+data.byteLength+'\0').update(data).digest('hex');
const expectedNoMedia=[
 [2022,'Energy and Utilities Finance and Policy','2022-04-21'],
 [2024,'Environment, Climate, and Legacy','2024-05-16'],
 [2025,'Rules and Administration - Subcommittee on Committees','2025-05-12'],
];

test('complete date-by-committee inventory is permanently pinned to independently SHA-verified source artifacts',()=>{
 assert.equal(gitBlob(bytes),'e6cff658e18fb7ef61b1391e0af5403e3071fd2e');
 assert.equal(j.issue,864);
 assert.equal(j.schemaVersion,'senate-2022-25-original-index-141-unlinked-minutes-compact-review-roster-v1');
 const s=j.originalIndexedCensus;
 assert.equal(s.runId,38065594898);
 assert.equal(s.artifactId,11674762938);
 assert.equal(s.artifactZipSha256,'cd39d5b334a4917616d614a03ae8b2ec0776e70214ae111ac5b54f877e890c7b');
 assert.equal(s.originalJsonSha256,'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0');
 assert.equal(s.exactMissingMeetingRosterSha256InPriorProof,'b7702da8e81ae960fc20ae950e957c5172b4d7053a6c1c1424af0e4403cf2558');
 assert.deepEqual([s.indexedMeetings,s.indexedMeetingsWithLinkedMinutes,s.indexedMeetingsWithoutLinkedMinutes,s.originalPdfLinks],[1592,1451,141,1452]);
 assert.equal(s.indexedMeetingsWithLinkedMinutes+s.indexedMeetingsWithoutLinkedMinutes,s.indexedMeetings);
 assert.equal(s.originalPdfLinks-s.indexedMeetingsWithLinkedMinutes,1);
});

test('every 2022-25 missing-minutes meeting is uniquely preserved by its original year/committee/day',()=>{
 assert.equal(j.meetingGroups.length,20);
 const rows=[] as {year:number,committeeName:string,committeeUrl:string,meetingDate:string}[];
 const byYear=new Map<number,number>();
 for(const g of j.meetingGroups){
   assert.ok(Number.isInteger(g.year)&&g.year>=2022&&g.year<=2025);
   assert.match(g.officialIndexCommitteeId,/^\d+-\d+$/);
   const url='https://www.lrl.mn.gov/minutes/comm.aspx?commid='+g.officialIndexCommitteeId+'&year='+g.year+'&body=senate';
   assert.deepEqual(g.missingMinutesMeetingDates,[...g.missingMinutesMeetingDates].sort());
   for(const day of g.missingMinutesMeetingDates){
     assert.match(day,/^\d{2}-\d{2}$/);
     const date=g.year+'-'+day;
     assert.equal(new Date(date+'T00:00:00Z').toISOString().slice(0,10),date);
     rows.push({year:g.year,committeeName:g.committeeName,committeeUrl:url,meetingDate:date});
     byYear.set(g.year,(byYear.get(g.year)??0)+1);
   }
 }
 assert.equal(rows.length,141);
 assert.equal(new Set(rows.map(r=>[r.year,r.committeeName,r.meetingDate].join('|'))).size,141);
 assert.deepEqual([...byYear.entries()].sort((a,b)=>a[0]-b[0]),[[2022,12],[2023,64],[2024,42],[2025,23]]);
 rows.sort((a,b)=>a.year-b.year||a.committeeName.localeCompare(b.committeeName,'en')||a.meetingDate.localeCompare(b.meetingDate,'en'));
 const canonical=rows.map(r=>({committeeName:r.committeeName,committeeUrl:r.committeeUrl,meetingDate:r.meetingDate,year:r.year}));
 assert.equal(hash(JSON.stringify(canonical)),j.originalIndexedCensus.canonicalFourFieldRosterSha256ThisLedger);
 assert.equal(hash(JSON.stringify(canonical)),'19b1766e42602e5267e6f9f4db0d3fc9b7eacc120b4f023ea2f15da7565c4584');
});

test('dated media links remain leads, and exactly three meetings lack even this candidate',()=>{
 const t=j.datedMediaCandidateTriage;
 assert.equal(t.runId,38076153790);
 assert.equal(t.indexOnlyMediaCandidateMeetings,138);
 assert.equal(t.indexedMeetingsWithoutDatedMediaCandidate,3);
 assert.equal(t.indexOnlyMediaCandidateMeetings+t.indexedMeetingsWithoutDatedMediaCandidate,141);
 assert.deepEqual(t.threeNoMediaCandidates.map((r:any)=>[r.year,r.committeeName,r.meetingDate]),expectedNoMedia);
 assert.deepEqual(t.sourceArtifacts.map((x:any)=>[x.year,x.artifactId]),[
 [2022,11678695461],[2023,11678735983],[2024,11679565102],[2025,11679555047]
 ]);
 for(const a of t.sourceArtifacts){assert.match(a.zipSha256,/^[a-f0-9]{64}$/);assert.match(a.jsonSha256,/^[a-f0-9]{64}$/);}
 const set=new Set(j.meetingGroups.flatMap((g:any)=>g.missingMinutesMeetingDates.map((d:string)=>g.year+'|'+g.committeeName+'|'+g.year+'-'+d)));
 for(const [y,c,d] of expectedNoMedia)assert.ok(set.has(y+'|'+c+'|'+d));
 assert.equal(t.mediaLinksDoNotProvePlayableContentOrRecordedVotes,true);
});

test('2021 print/2022 print versus electronic and source-to-database completeness always fail closed',()=>{
 assert.equal(j.limitations.years2021PrintOnlyMeetingVoteDenominator,null);
 assert.equal(j.limitations.year2022PrintAndElectronicCollectionsMayDiffer,true);
 assert.equal(j.limitations.completeOfficial2021To2025SenateCommitteeRecordedVoteDenominator,null);
 assert.equal(j.limitations.unlinkedMinutesDoesNotProveNoMeetingOrRecordedVote,true);
 assert.equal(j.limitations.mediaRecordLeadIsNotVerifiedRecordingOrNamedVote,true);
 assert.equal(j.limitations.noPrivateProductionDatabaseAccessOrWrites,true);
 assert.equal(j.limitations.noModelForecastServingTrainingSchedulerFloor2027Changes,true);
 assert.equal(j.limitations.issue864MustRemainOpen,true);
});
