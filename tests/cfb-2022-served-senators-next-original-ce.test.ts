import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  load2022PinnedOriginalViewerRows,selectServed2022NextOriginalCe,
  SERVED_2022_GENERAL_SOURCE_SHA,SERVED_2022_NEXT_DISTRICTS,
  SERVED_2022_396_SOURCE_PSV_SHA,
} from '../src/evidence/cfb-2022-served-senators-next-original-ce.js';
import type {AuditedOfficialSenateDirectory}
  from '../src/evidence/senate-official-ever-served-directory.js';
import type {SosSenate2022Result}
  from '../src/evidence/cfb-2022-senate-sos-ballot-obligation-reconciliation.js';
import type {CfbSenateDistrictPageObservation}
  from '../src/evidence/cfb-senate-district-registration-inventory.js';
import {cfbSenateDistrictPageUrl}
  from '../src/evidence/cfb-senate-district-registration-inventory.js';
import {createHash} from 'node:crypto';

const psv=readFileSync(
  'docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv',
  'utf8');
const regIndex=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json',
  'utf8'));
const existing=new Set(readFileSync(
  'docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv','utf8')
  .trim().split('\n').map(x=>x.split('|')[0]!));
const observedAt='2026-10-11T02:00:00.000Z';
const official:AuditedOfficialSenateDirectory={
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{url:'https://www.lrl.mn.gov/legdb/senate_dir',observedAt,
    sourceBytesSha256:'a'.repeat(64),sourceBytesLength:1000000,
    originalHistoricDateForDisplayedDirectoryEstablished:false,
    directoryIsSenatorServiceNotCandidateFiling:true},
  senators:[{officialName:'Ada Testcase',officialNameRaw:'Testcase, Ada',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{district:'13',startsYear:2023,endsYear:null}]}],
};
const sos:SosSenate2022Result[]=Array.from({length:67},(_,i)=>({
  election:'general',district:i+1,
  candidateName:i===12?'Ada Testcase':'Different Nonserving Person',
  party:'DFL',voteCount:1000,resultsRowId:String(3000+i),
}));
const pages:CfbSenateDistrictPageObservation[]=SERVED_2022_NEXT_DISTRICTS.map(d=>({
  district:d,segmentEndYear:2022,sourceUrl:cfbSenateDistrictPageUrl(d,2022),
  retrievedAt:observedAt,htmlSha256:'b'.repeat(64),responseBytes:1500,
  status:d===13?'candidate_labels_observed':'no_candidate_labels_visible',
  candidates:d===13?[{registrationNumber:'17373',candidateDisplayName:'Testcase, Ada'}]:[],
  malformedCandidateLabels:0,error:null,
}));
const args=()=>({
  official,sosGeneral:sos,originalSosGeneralBytesSha256:SERVED_2022_GENERAL_SOURCE_SHA,
  cfbDistrictPages:pages,viewerPsv:psv,registrationCheckpoint:regIndex,
  alreadyAuthenticatedReportIds:new Set<string>(),
});
test('real permanent 396-row ledger SHA, 270 source-scoped registrations and empty report tabs',()=>{
  assert.equal(createHash('sha256').update(psv).digest('hex'),SERVED_2022_396_SOURCE_PSV_SHA);
  const rows=load2022PinnedOriginalViewerRows(psv);
  assert.equal(rows.size,270);
  assert.ok(rows.get('17373')?.keys.has('22:pcc:C:0:0'));
  assert.ok(rows.get('17373')?.keys.has('22:pcc:E:0:0'));
  assert.ok([...rows.values()].some(row=>row.keys.size===0));
  assert.throws(()=>load2022PinnedOriginalViewerRows(psv+'\n'),/hash mismatch/);
});
test('new district cohort admits ONLY uniquely matched verified Senate members',()=>{
  const data=selectServed2022NextOriginalCe(args());
  assert.equal(data.targets.length,2);
  assert.deepEqual(data.targets.map(t=>t.period),['C','E']);
  assert.deepEqual(data.targets.map(t=>t.id),[
    '17373:22:pcc:C:0:0','17373:22:pcc:E:0:0']);
  assert.deepEqual(data.selectedSenators.map(t=>t.officialName),['Ada Testcase']);
  assert.equal(data.skippedDistricts.length,11);
  assert.equal(data.skippedDistricts.some(t=>Object.hasOwn(t,'candidateName')),false);
  assert.equal(data.legalSenateReportDenominator,null);
  assert.ok(data.targets.every(t=>t.expectedPeriodEndOn==='2022-07-18'
    ||t.expectedPeriodEndOn==='2022-10-24'));
});
test('a winning candidate who did not serve is never eligible for named finance acquisition',()=>{
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    official:{...official,senators:[]}}),/cohort empty/);
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    official:{...official,senators:[{...official.senators[0]!,
      senateServiceTerms:[{district:'13',startsYear:2024,endsYear:null}]}]}}),
    /cohort empty/);
});
test('same name in wrong CFB district, two registrations and malformed service proof fail closed',()=>{
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    cfbDistrictPages:pages.map(p=>p.district===13?{...p,
      candidates:[{registrationNumber:'17373',candidateDisplayName:'Testcase, Another'}]}:p)}),
    /cohort empty/);
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    cfbDistrictPages:pages.map(p=>p.district===13?{...p,
      candidates:[...p.candidates,{...p.candidates[0]!}]}:p)}),/cohort empty/);
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    originalSosGeneralBytesSha256:'0'.repeat(64)}),/provenance missing/);
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    official:{...official,source:{...official.source,sourceBytesSha256:'bad'}}}),
    /provenance missing/);
});
test('never double-count previously authenticated original PDF identities',()=>{
  assert.equal(existing.size,24);
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    alreadyAuthenticatedReportIds:existing}),/double-counted/);
});
test('source roster completeness, original API-body hash and winner tie are mandatory',()=>{
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    cfbDistrictPages:pages.slice(0,-1)}),/district pages/);
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    viewerPsv:psv.replace('2022|17373|','2022|17374|')}),/hash mismatch/);
  assert.throws(()=>selectServed2022NextOriginalCe({...args(),
    sosGeneral:[...sos,{...sos[12]!,candidateName:'Second',voteCount:1000}]}),
    /cohort empty/);
});
