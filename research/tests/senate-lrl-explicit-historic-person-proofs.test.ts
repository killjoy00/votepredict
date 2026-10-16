import test from 'node:test';
import assert from 'node:assert/strict';
import {
 SOURCE_TARGETS,verifyOfficialSenatorExceptionalSource,
 exceptionalFormerOrLaterSenatorMatch,validateVerifiedExceptionalProofs,
 LRL_EXACT_SENATE_HISTORIC_IDENTITY_PROOFS_VERSION,
 type VerifiedSenateExceptionalPersonSources,
} from '../../src/evidence/senate-lrl-explicit-historic-person-proofs.js';
import type {AuditedOfficialSenateDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
const DATE='2026-10-10T19:00:00.000Z';
function html(id:typeof SOURCE_TARGETS[number]['id']):Uint8Array{
 const info={
  'mary-former-name':[
   'Mary K. Kunesh','Former Name: Kunesh-Podein',
   'Senate 2021-2022 (District 41)',
  ],
  'bonnie-prior-loss':[
   'Bonnie Westlin',
   'She was an unsuccessful candidate for District 34 of the Minnesota Senate in 2016 and 2020.',
   'Senate 2023-Present (District 42)',
  ],
  'roger-redistrict-loss':[
   'Roger C. Chamberlain',
   'He ran in the Senate District 36 election in 2022, but was defeated.',
   'Senate 2013-2022 (District 38)',
  ],
 } as const;
 return Buffer.from('<html><h1>'+info[id][0]+'</h1>'+
   '<main><p>'+info[id][1]+'</p><p>'+info[id][2]+'</p></main>'+
   '<footer>'+' Official legislator record '.repeat(400)+'</footer></html>');
}
function original(){
 const people=[
  {officialName:'Mary K. Kunesh',terms:[{startsYear:2021,endsYear:2022,district:'41'}]},
  {officialName:'Bonnie Westlin',terms:[{startsYear:2023,endsYear:null,district:'42'}]},
  {officialName:'Roger C. Chamberlain',terms:[{startsYear:2013,endsYear:2022,district:'38'}]},
  {officialName:'Paul T. Anderson',terms:[{startsYear:2017,endsYear:2020,district:'44'}]},
 ];
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir',
   observedAt:DATE,sourceBytesSha256:'a'.repeat(64),sourceBytesLength:100000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:people.map(person=>({
   officialName:person.officialName,officialNameRaw:person.officialName,
   officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
   senateServiceTerms:person.terms,
  })),
 } as unknown as AuditedOfficialSenateDirectory;
}
function checked():VerifiedSenateExceptionalPersonSources{
 return {
  schema:LRL_EXACT_SENATE_HISTORIC_IDENTITY_PROOFS_VERSION,
  proofs:SOURCE_TARGETS.map(t=>verifyOfficialSenatorExceptionalSource(t.id,html(t.id),DATE)),
 };
}
test('three actual original LRL full biographies pin 2026 observedAt, SHA256, candidate-district and specific explicit cross-election facts',()=>{
 const p=checked();
 assert.doesNotThrow(()=>validateVerifiedExceptionalProofs(p));
 assert.equal(p.proofs.length,3);
 assert.ok(p.proofs.every(x=>x.observedAt===DATE));
 assert.ok(p.proofs.every(x=>x.officialOriginalTextContainsBothRequiredFacts
   &&x.pageOriginallyPublishedOnKnown===false
   &&x.originalCandidatePolicySourceTextVerified===false
   &&x.usableForForecastTimeSeries===false));
});
test('2020 former name, 2020 loser/later senator and 2022 losing former senator are individually independently linked',()=>{
 const p=checked(),roster=original();
 const mary=exceptionalFormerOrLaterSenatorMatch(roster,p,'Mary Kunesh-Podein','41',2020)!;
 const bonnie=exceptionalFormerOrLaterSenatorMatch(roster,p,'Bonnie Westlin','34',2020)!;
 const roger=exceptionalFormerOrLaterSenatorMatch(roster,p,'Roger Chamberlain','36',2022)!;
 assert.equal(mary.officialName,'Mary K. Kunesh');
 assert.equal(mary.serviceForThisElectionFollowingYearVerified,true);
 assert.equal(bonnie.officialName,'Bonnie Westlin');
 assert.equal(bonnie.serviceForThisElectionFollowingYearVerified,false);
 assert.equal(bonnie.term,'2023-Present SD42');
 assert.equal(roger.officialName,'Roger C. Chamberlain');
 assert.equal(roger.term,'2013-2022 SD38');
 assert.equal(roger.serviceForThisElectionFollowingYearVerified,false);
 assert.ok([mary,bonnie,roger].every(x=>x.officialIdentityProofObservedAt===DATE
   &&/^[0-9a-f]{64}$/.test(x.officialIdentityProofSourceSha256)));
});
test('unrelated same-name Paul Anderson SD59 never gets another senator in SD44 source proof',()=>{
 const p=checked(),roster=original();
 assert.equal(exceptionalFormerOrLaterSenatorMatch(roster,p,'Paul Anderson','59',2020),null);
 assert.equal(exceptionalFormerOrLaterSenatorMatch(roster,p,'Bonnie Westlin','44',2020),null);
 assert.equal(exceptionalFormerOrLaterSenatorMatch(roster,p,'Bonnie Westlin','34',2022),null);
 assert.equal(exceptionalFormerOrLaterSenatorMatch(roster,p,'Mary Kunesh','41',2020),null);
});
test('wrong historical biography text, false current year, wrong SHA or future-dated claim fails closed',()=>{
 assert.throws(()=>verifyOfficialSenatorExceptionalSource('bonnie-prior-loss',
  html('mary-former-name'),DATE),/lacks exact/);
 assert.throws(()=>verifyOfficialSenatorExceptionalSource('mary-former-name',
  html('mary-former-name'),'2020-11-03T00:00:00.000Z'),/fabricated\/backdated/);
 const p=checked();
 p.proofs[1].sourceBodySha256='garbage';
 assert.throws(()=>validateVerifiedExceptionalProofs(p),/Unverified LRL/);
 const htmlChanged=Buffer.from(html('bonnie-prior-loss').toString().replace('2016 and 2020','2016 and 2024'));
 assert.throws(()=>verifyOfficialSenatorExceptionalSource('bonnie-prior-loss',htmlChanged,DATE),/lacks exact/);
});
