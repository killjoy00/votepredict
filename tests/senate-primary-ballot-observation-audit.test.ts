import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import primaryJson from '../data/evaluation/senate-primary-ballot-candidate-observations-2022-24-v1.json' with { type: 'json' };
import winnerJson from '../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json' with { type: 'json' };
import {
  auditSenatePrimaryBallotObservations,
  parseSosSenateElectionCandidateRoster,
  type PrimaryBallotManifest,
} from '../src/evidence/senate-primary-ballot-observation-audit.js';
import type { SenateSosSeedManifest } from '../src/evidence/sos-senate-historical-candidate-inventory.js';
const primary=primaryJson as unknown as PrimaryBallotManifest;
const winners=winnerJson as unknown as SenateSosSeedManifest;
const syntheticMembership=(name:string,district:string,sessionSlug:'2021-2022'|'2023-2024'|'2025-2026',recordedIssuePositionItems:number)=>
  ({membershipId:name+'|'+sessionSlug,senatorName:name,district,sessionSlug,recordedIssuePositionItems});
test('pin real 2022 and 2024 primary candidate tables with 79 total Senate observations',()=>{
  const report=auditSenatePrimaryBallotObservations(primary,winners);
  assert.deepEqual({
    total:report.counts.observations,year2022:report.counts.senatePrimary2022,
    year2024:report.counts.senatePrimary2024,districts2022:report.counts.observed2022PrimaryDistricts,
    districts2024:report.counts.observed2024SpecialPrimaryDistricts,
  },{total:79,year2022:75,year2024:4,districts2022:24,districts2024:1});
  assert.equal(report.counts.totalSenateDistricts,67);
  assert.equal(report.counts.otherCandidateObservations,54);
  assert.equal(report.counts.exactGeneralWinnerIdentitiesPresentInThesePrimaryFiles,25);
  assert.equal(report.counts.zeroRecordedCampaignPositionsMemberRows,null);
  assert.equal(report.prioritizedMemberships.length,0);
});
test('2022 other-candidate observations exclude eventual winners without claiming they all lost primaries',()=>{
  const report=auditSenatePrimaryBallotObservations(primary,winners);
  const other=report.otherCandidateResearchLeads;
  const has=(name:string,district:string)=>other.some(c=>c.candidateName===name&&c.district===district);
  assert.ok(has('Dave Hughes','1'));
  assert.ok(has('Andrea Zupancich','3'));
  assert.ok(has('Dan Bohmer','4'));
  assert.ok(has('Suzanne M. Cekalla','10'));
  assert.ok(has('Kathleen Fowke','45'));
  assert.ok(has('Emily Reitan','45'));
  assert.ok(report.knownPrimaryWinnerIdentityObservations.some(c=>c.candidateName==='Ann Johnson Stewart'&&c.electionYear===2024));
  assert.ok(report.knownPrimaryWinnerIdentityObservations.some(c=>c.candidateName==='Grant Hauschild'&&c.electionYear===2022));
  assert.ok(other.every(c=>c.campaignWebsite===null&&c.publicBeforeGeneralElection===null&&!c.sourceOriginalByteHashVerified));
});
test('every primary candidate retains a pinned SOS source ID and content-addressed research mirror',()=>{
  const report=auditSenatePrimaryBallotObservations(primary,winners);
  for(const source of report.sources){
    assert.match(source.officialPublishedCandidateRosterUrl,/^https:\/\/electionresultsfiles\.sos\.mn\.gov\/20(?:22|24)\d{4}\/cand\.txt$/);
    assert.match(source.mirrorBlobGitSha1,/^[a-f0-9]{40}$/);
    assert.match(source.mirrorImmutableCommit,/^[a-f0-9]{40}$/);
    assert.equal(source.originalSOSCampaignFilingExport,false);
    assert.equal(source.containsCampaignWebsiteField,false);
    assert.equal(source.officialFileBytesCryptographicallyVerifiedInThisRun,false);
  }
});
test('member joins use same normalized name, district, and time-scope not an opponent',()=>{
  const report=auditSenatePrimaryBallotObservations(primary,winners,[
    syntheticMembership('Mark Johnson','1','2021-2022',0),
    syntheticMembership('Mark Johnson','1','2023-2024',0),
    syntheticMembership('Grant Hauschild','3','2023-2024',0),
    syntheticMembership('Ann Johnson Stewart','45','2025-2026',0),
    syntheticMembership('Andrea Zupancich','3','2023-2024',1),
  ]);
  assert.equal(report.counts.zeroRecordedCampaignPositionsMemberRows,4);
  const look=(name:string,session:string)=>report.prioritizedMemberships.find(m=>m.senatorName===name&&m.sessionSlug===session)!;
  assert.equal(look('Mark Johnson','2021-2022').primaryBallotCandidateIds.length,0);
  assert.equal(look('Mark Johnson','2023-2024').primaryBallotCandidateIds.length,1);
  assert.equal(look('Grant Hauschild','2023-2024').primaryBallotCandidateIds.length,1);
  assert.equal(look('Ann Johnson Stewart','2025-2026').primaryBallotCandidateIds.length,1);
  assert.equal(look('Andrea Zupancich','2023-2024').primaryBallotCandidateIds.length,1);
  assert.ok(report.prioritizedMemberships.every(m=>!m.websiteEvidenceGainedFromPrimaryList));
});
test('2024 candidate table is not treated as statewide Senate contest',()=>{
  const report=auditSenatePrimaryBallotObservations(primary,winners);
  assert.deepEqual(new Set(report.otherCandidateResearchLeads.filter(c=>c.electionYear===2024).map(c=>c.district)),new Set(['45']));
  assert.equal(report.sources[1].distinctSenateDistricts,1);
  assert.equal(report.scope.primaryBallotResultsAreNotFilingUniverse,true);
});
test('source table parser drops non-Senate rows and keeps no campaign contacts',()=>{
  const raw=[
    '01210301;Mark Johnson;0121;State Senator District 1;88;03;R',
    '02010301;PRIVATE HOUSE PERSON;0201;State Representative District 1A;88;03;R',
    '01210302;Dave Hughes;0121;State Senator District 1;88;03;R',
  ].join('\n');
  const parsed=parseSosSenateElectionCandidateRoster(raw,{
    sourceId:'sos-2022-08-09-senate-primary-candidates',year:2022});
  assert.deepEqual(parsed.candidates.map(c=>c.candidateName),['Mark Johnson','Dave Hughes']);
  assert.equal(parsed.nonSenateLines,1);
  assert.equal(parsed.rejectedInvalidSenateLines,0);
  assert.equal(parsed.candidates[0].campaignWebsite,null);
  assert.equal(parsed.officialBytesAuthenticated,false);
  assert.equal(parsed.independentPreElectionPublicationProof,false);
  assert.equal(parsed.originalLocalSha256,createHash('sha256').update(raw).digest('hex'));
  assert.equal(JSON.stringify(parsed).includes('PRIVATE HOUSE PERSON'),false);
});
test('address-bearing 21-field election CandTbl cannot be confused with 7-field identity table',()=>{
  const row=['01210301','Mark Johnson','0121','State Senator District 1','88','03','R',
    'PRIVATE STREET','PRIVATE TOWN','MN','12345','PRIVATE ADDRESS','CITY','MN','12345','5550000',
    'example.org','email@example.org','RUNMATE','PRIVATE EMAIL','PRIVATE NUMBER'].join(';');
  const parsed=parseSosSenateElectionCandidateRoster(row,{
    sourceId:'sos-2022-08-09-senate-primary-candidates',year:2022});
  assert.equal(parsed.candidates.length,0);
  assert.equal(parsed.rejectedInvalidSenateLines,1);
  assert.equal(JSON.stringify(parsed).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(parsed).includes('email@example.org'),false);
});
test('bad identifier, impossible Senate district, wrong source-year are rejected',()=>{
  const raw='foo;A Candidate;0121;State Senator District 1;88;03;R';
  const parsed=parseSosSenateElectionCandidateRoster(raw,{
    sourceId:'sos-2022-08-09-senate-primary-candidates',year:2022});
  assert.equal(parsed.rejectedInvalidSenateLines,1);
  assert.throws(()=>parseSosSenateElectionCandidateRoster(raw,{
    sourceId:'sos-2024-08-13-sd45-primary-candidates',year:2022}),/Source\/election-year/);
});
test('duplicate SOS candidate identifier is rejected on parse',()=>{
  const row='01210301;Mark Johnson;0121;State Senator District 1;88;03;R';
  assert.throws(()=>parseSosSenateElectionCandidateRoster(row+'\n'+row,{
    sourceId:'sos-2022-08-09-senate-primary-candidates',year:2022}),/Duplicate/);
});
test('tampering manifest counts or candidate website claim fails closed',()=>{
  const c=structuredClone(primary);
  c.sources[0].observations=74;
  assert.throws(()=>auditSenatePrimaryBallotObservations(c,winners),/do not reconcile/);
  const d=structuredClone(primary);
  (d.candidates[0] as unknown as {campaignWebsite:string}).campaignWebsite='https://example.org';
  assert.throws(()=>auditSenatePrimaryBallotObservations(d,winners),/Invalid primary candidate/);
});
test('tampered mirror SHA and source URLs cannot be presented as original evidence',()=>{
  const a=structuredClone(primary);
  a.sources[0].officialPublishedCandidateRosterUrl='https://untrusted.example/2022.csv';
  assert.throws(()=>auditSenatePrimaryBallotObservations(a,winners),/provenance/);
  const b=structuredClone(primary);
  (b.sources[0] as unknown as {containsCampaignWebsiteField:boolean}).containsCampaignWebsiteField=true;
  assert.throws(()=>auditSenatePrimaryBallotObservations(b,winners),/provenance/);
});
test('manifest candidates must attach to exactly one previously sourced general winner',()=>{
  const w=structuredClone(winners);
  w.winners=w.winners.filter(x=>!(x.sourceId==='sos-general-2022'&&x.district==='1'));
  assert.throws(()=>auditSenatePrimaryBallotObservations(primary,w),/district lacks exactly one/);
});
test('offline CLI preserves unknown member gap count when no export is supplied',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sos-primary-'));
  try{
    const output=join(dir,'report.json');
    execFileSync('node',['--import','tsx','scripts/audit-senate-primary-ballot-observations-offline.ts','--output',output],
      {timeout:15_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(output,'utf8'));
    assert.equal(report.counts.observations,79);
    assert.equal(report.counts.otherCandidateObservations,54);
    assert.equal(report.counts.zeroRecordedCampaignPositionsMemberRows,null);
    assert.equal(report.prioritizedMemberships.length,0);
    assert.equal(report.scope.noNetwork,true);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline CLI ranks explicitly supplied zero-issue campaign site member and never provides site proof',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sos-primary-roster-'));
  try{
    const roster=join(dir,'members.jsonl'),out=join(dir,'out.json');
    writeFileSync(roster,JSON.stringify(syntheticMembership('Grant Hauschild','3','2023-2024',0))+'\n');
    execFileSync('node',['--import','tsx','scripts/audit-senate-primary-ballot-observations-offline.ts',
      '--memberships',roster,'--output',out],{timeout:15_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(report.counts.zeroRecordedCampaignPositionsMemberRows,1);
    assert.equal(report.prioritizedMemberships[0].primaryBallotCandidateIds.length,1);
    assert.equal(report.prioritizedMemberships[0].websiteEvidenceGainedFromPrimaryList,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline CLI rejects mismatching local 2022 input, never silently substitutes it for SOS source',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sos-primary-bad-'));
  try{
    const source=join(dir,'fake.txt'),out=join(dir,'report.json');
    writeFileSync(source,'01210301;Mark Johnson;0121;State Senator District 1;88;03;R\n');
    assert.throws(()=>execFileSync('node',['--import','tsx','scripts/audit-senate-primary-ballot-observations-offline.ts',
      '--2022-cand-file',source,'--output',out],{timeout:15_000,stdio:'pipe'}),/Command failed/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
