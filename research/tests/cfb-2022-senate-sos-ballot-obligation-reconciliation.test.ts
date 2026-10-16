import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  SOS_2022_OFFICIAL_SENATE_FILES,
  deriveCfb2022OriginalSegmentRegistrationSet,
  parseSos2022SenateElectionResults,
  reconcileCfb2022SenateBallotPredicates,
  type SosSenate2022Result,
  type CfbSenate2022Candidate,
} from '../../src/evidence/cfb-2022-senate-sos-ballot-obligation-reconciliation.js';

const original=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json','utf8'));
const registrations=deriveCfb2022OriginalSegmentRegistrationSet(original);
function line(district:number,name:string,party='R',code='0301'){
  return ['MN','','',String(120+district).padStart(4,'0'),
    'State Senator District '+district,String(district),code,name,'','',party,'100','100','3500','100.00','3500'].join(';');
}
function textGeneral(){
  return Array.from({length:67},(_,i)=>
    line(i+1,i===0?'Mark Johnson':'Candidate '+(i+1)+' Williams')).join('\n')+'\n';
}
function textPrimary(){
  return Array.from({length:16},(_,i)=>
    line(i+1,i===0?'Mark Johnson':'Candidate '+(i+1)+' Williams')).join('\n')+'\n';
}
const parse=(election:'general'|'primary',text:string)=>
  parseSos2022SenateElectionResults({
    election,sourceUrl:SOS_2022_OFFICIAL_SENATE_FILES[election],text,
  });
function roster(){
  const regs=[...registrations].sort();
  assert.equal(regs.length,270);
  const rows:CfbSenate2022Candidate[]=regs.map((id,i)=>({
    district:1+(i%67),registrationNumber:id,candidateName:'Garcia, Temp Person',
  }));
  const johnson=rows.find(r=>r.registrationNumber==='18011');
  assert.ok(johnson);
  johnson!.district=1;johnson!.candidateName='Johnson, Mark T';
  return rows;
}
test('official 494-ID source mask retains exactly 270 2022 Senate registration labels, not active-lifecycle proof',()=>{
  assert.equal(registrations.size,270);
  assert.equal(original.provenance.runId,38081628130);
  assert.ok(registrations.has('18011'));
  const changed=structuredClone(original);
  changed.provenance.rawJsonSha256='0'.repeat(64);
  assert.throws(()=>deriveCfb2022OriginalSegmentRegistrationSet(changed),/source 494-ID index invalid/);
});
test('parse official 2022 SOS text rows with strict date, host, 67-district general and uncontested-primary limitations',()=>{
  const general=parse('general',textGeneral());
  const primary=parse('primary',textPrimary());
  assert.equal(general.length,67);
  assert.equal(new Set(general.map(r=>r.district)).size,67);
  assert.equal(primary.length,16);
  assert.equal(new Set(primary.map(r=>r.district)).size,16);
  assert.equal(general[0]?.candidateName,'Mark Johnson');
  assert.throws(()=>parseSos2022SenateElectionResults({
    election:'general',sourceUrl:'https://attacker.example/fake.txt',text:textGeneral(),
  }),/Unknown or out-of-year/);
  assert.throws(()=>parse('general',textGeneral().replace('State Senator District 1','House District 1')),
    /candidate\/vote identity malformed/);
  assert.throws(()=>parse('general',textGeneral().replace('MN;;;0121','WI;;;0121')),
    /results row layout/);
  assert.throws(()=>parse('general',textGeneral().split('\n').slice(0,66).join('\n')),
    /missing any of 67 districts/);
});
test('ignore WRITE-IN general summary as person; never translate primary contested absence to ballot nonfiling',()=>{
  const body=textGeneral()+line(1,'WRITE-IN','WI','9901')+'\n';
  const result=parse('general',body);
  assert.equal(result.length,67);
  assert.equal(result.filter(x=>x.candidateName==='WRITE-IN').length,0);
  assert.equal(parse('primary',textPrimary()).length,16);
});
test('match only independently identical first-name surname and Senate district, not fuzzy names',()=>{
  const input={
    cfbCandidates:roster(),sourcePinnedOriginal2022Registrations:registrations,
    sosPrimary:parse('primary',textPrimary()),sosGeneral:parse('general',textGeneral()),
  };
  const a=reconcileCfb2022SenateBallotPredicates(input);
  assert.equal(a.sourceCounts.generalBallotCandidateNameDistrictMatchesToCfb2022Viewer,1);
  assert.equal(a.sourceCounts.contestedPrimaryNameDistrictMatchesToCfb2022Viewer,1);
  const row=a.byCandidate.find(x=>x.cfbRegistrationNumber==='18011');
  assert.equal(row?.senateDistrict,1);
  assert.equal(row?.exact2022GeneralBallotParticipationObserved,true);
  assert.equal(row?.contested2022PrimaryResultObserved,true);
  assert.equal(row?.statutoryPreGeneralReportingObligationVerified,false);
  assert.equal(row?.wasLegallyRegisteredOnRelevant2022ReportDueDate,null);
  assert.equal(row?.actual2022CampaignReportFilingVerified,false);
  assert.equal(a.sourceCounts['2022StatutoryPrePrimaryFilingsLegallyOwedCount'],null);
  assert.equal(a.sourceCounts['2022StatutoryPreGeneralFilingsLegallyOwedCount'],null);
  assert.equal(a.sourceCounts.completeSenate2021to2025StatutoryDenominator,null);
  assert.equal(a.safeguards.noFuzzyCandidateJoins,true);
  assert.equal(a.safeguards.primaryResultAbsenceIsProofCandidateDidNotFile,false);
});
test('same-name different district never matches and multiple exact candidates cause manual ambiguity',()=>{
  const cfb=roster();
  const general=parse('general',textGeneral());
  const johnson=general.find(x=>x.district===1)!;
  const without=reconcileCfb2022SenateBallotPredicates({
    cfbCandidates:cfb,sourcePinnedOriginal2022Registrations:registrations,
    sosPrimary:[],sosGeneral:general.map(x=>x===johnson?{...x,district:2}:x),
  });
  assert.equal(without.byCandidate.find(x=>x.cfbRegistrationNumber==='18011')?.exact2022GeneralBallotParticipationObserved,false);
  const ambiguous=reconcileCfb2022SenateBallotPredicates({
    cfbCandidates:cfb,sourcePinnedOriginal2022Registrations:registrations,
    sosPrimary:[],sosGeneral:[...general,{...johnson,party:'DFL',resultsRowId:'0401'}],
  });
  assert.equal(ambiguous.byCandidate.find(x=>x.cfbRegistrationNumber==='18011')?.generalSourceMatchStatus,
    'ambiguous_multiple_results');
  assert.equal(ambiguous.sourceCounts.generalBallotCandidateNameDistrictMatchesToCfb2022Viewer,0);
});
test('misidentified or short 2022 official CFB roster set is not accepted as absent report evidence',()=>{
  const r=roster();
  assert.throws(()=>reconcileCfb2022SenateBallotPredicates({
    cfbCandidates:r.slice(1),sourcePinnedOriginal2022Registrations:registrations,
    sosGeneral:[],sosPrimary:[],
  }),/does not match original 270/);
  assert.throws(()=>reconcileCfb2022SenateBallotPredicates({
    cfbCandidates:[...r.slice(1),r[1]!],sourcePinnedOriginal2022Registrations:registrations,
    sosGeneral:[],sosPrimary:[],
  }),/invalid or repeated/);
});
