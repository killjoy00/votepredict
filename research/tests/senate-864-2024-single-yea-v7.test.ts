import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseSenateCommitteeMinuteVotes} from
 '../../src/evidence/minnesota-senate-committee-minutes.js';
import {MEMBERSHIP_SQL,recognizeMissing2024YeaNameInMemory,
  findUniqueMissing2024Choice} from
 '../scripts/audit-senate-864-2024-one-yea-readonly-v7.js';

const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const text='S.F. 100 was before the committee.\n'+
 'Senator Mock requested a roll call vote for the adoption of 10 amendment.\n'+
 '4/6 (Ayes: Alpha, Beta, Gamma, Delta; Nays: Epsilon, Zeta, Eta, Theta, Iota, Kappa) MOTION FAILED.';
const row=parseSenateCommitteeMinuteVotes(text)[0]!;
const all=row.memberVotes.map(x=>sha(x.choice+':'+x.normalizedName)).sort();
const pdf={document:{year:2024,committeeName:'Mock',meetingDate:'2024-02-01',
 sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2024/mock/20240201/mock_Minutes.pdf',
 originalRawPdfSha256:'a'.repeat(64)},
 voteObservations:[{externalKey:'test',yeaCount:4,nayCount:6,
  individualVotesAvailable:true,namedMemberChoicesInPdf:10,choiceIdentitySha256:all}],
};
test('unique YEA source name is reconstructed only from matching original choices',()=>{
 assert.equal(row.memberVotes.length,10);
 const fingerprint=sha('yea:'+row.memberVotes[0]!.normalizedName);
 assert.equal(recognizeMissing2024YeaNameInMemory(fingerprint,text,pdf),
  row.memberVotes[0]!.normalizedName);
 assert.throws(()=>recognizeMissing2024YeaNameInMemory(sha('yea:AbsentMock'),text,pdf));
});
test('same original number with altered original choice set fails closed',()=>{
 const mutated={...pdf,voteObservations:pdf.voteObservations.map(x=>({
  ...x,choiceIdentitySha256:[sha('yea:Unexpected'),...x.choiceIdentitySha256.slice(1)]
 }))};
 assert.throws(()=>recognizeMissing2024YeaNameInMemory(sha('yea:'+row.memberVotes[0]!.normalizedName),text,mutated));
});
test('protected-only membership SQL is SELECT-only and parameter bound',()=>{
 assert.match(MEMBERSHIP_SQL,/^SELECT /);
 assert.match(MEMBERSHIP_SQL,/lower\(\$1\)/);
 assert.match(MEMBERSHIP_SQL,/LIMIT 31$/);
 assert.doesNotMatch(MEMBERSHIP_SQL,/insert|update|delete|create|alter|drop|grant/i);
 assert.throws(()=>findUniqueMissing2024Choice([],{documents:[],events:[],choices:[]}));
});
