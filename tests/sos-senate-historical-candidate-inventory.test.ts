import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import manifest from '../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json' with { type: 'json' };
import {
  auditSenateSosWebsiteSeedInventory,
  parseHistoricalSosSenateCandidateFile,
  validCampaignWebsite,
  strictCandidateKey,
  type SenateSosSeedManifest,
} from '../src/evidence/sos-senate-historical-candidate-inventory.js';

const ledger = manifest as unknown as SenateSosSeedManifest;
const member = (name:string,district:string,sessionSlug:'2021-2022'|'2023-2024'|'2025-2026',count:number) =>
  ({ membershipId:name+'|'+sessionSlug,senatorName:name,sessionSlug,district,recordedIssuePositionItems:count });

test('independently sourced winner seeds span all 67 districts in each general election',()=>{
  const report=auditSenateSosWebsiteSeedInventory(ledger);
  assert.equal(report.counts.winnerElectionRecords,139);
  assert.equal(report.counts.originalGeneralElectionWinnerRecords,134);
  assert.equal(report.counts.specialWinnerElectionRecords,5);
  for(const src of ['sos-general-2020','sos-general-2022']){
    const entries=ledger.winners.filter(w=>w.sourceId===src);
    assert.deepEqual(new Set(entries.map(w=>Number(w.district))),new Set(Array.from({length:67},(_,i)=>i+1)));
  }
  assert.equal(report.scope.historicalWebsiteCoverageCertified,false);
  assert.equal(report.counts.zeroRecordedPositionMemberships,null);
});

test('SOS special-election filing lists preserve candidates absent from winner-only roster',()=>{
  const report=auditSenateSosWebsiteSeedInventory(ledger);
  assert.equal(report.counts.officialSpecialFiledCandidateRows,19);
  assert.equal(ledger.filedCandidates.filter(c=>c.sourceId==='sos-filed-2025-60').length,10);
  assert.equal(ledger.filedCandidates.filter(c=>c.sourceId==='sos-filed-2025-6').length,9);
  assert.ok(ledger.filedCandidates.every(c=>c.candidateWebsite===null));
  assert.equal(report.scope.officialFiledCandidateUniverseComplete,false);
});

test('four dated publisher links are only discovery leads, not SOS filing website proof',()=>{
  const report=auditSenateSosWebsiteSeedInventory(ledger);
  assert.equal(report.counts.publisherWebsiteLeads,4);
  assert.ok(ledger.websiteLeads.every(l=>!l.eligibleForHistoricalReplay && l.independentArchivePublicBy===null));
  assert.equal(report.unjoinedPublisherWebsiteLeads.length,4);
});

test('explicit exported zero-position memberships are prioritized without inferring unknown gaps are neutral',()=>{
  const report=auditSenateSosWebsiteSeedInventory(ledger,[
    member('Grant Hauschild','3','2023-2024',7),
    member('Mark Johnson','1','2021-2022',0),
    member('Amanda Hemmingsen-Jaeger','47','2025-2026',0),
  ]);
  assert.equal(report.counts.zeroRecordedPositionMemberships,2);
  assert.equal(report.counts.zeroRecordedPositionMembershipsWithWebsiteLead,1);
  assert.equal(report.membershipPriorities[0].priority,'P0_zero_recorded_positions');
  const amanda=report.membershipPriorities.find(x=>x.senatorName==='Amanda Hemmingsen-Jaeger')!;
  assert.equal(amanda.identityMatch,'exact_name_district_candidate');
  assert.deepEqual(amanda.candidateWebsiteDiscoveryLeads,['https://amandaformn.com/']);
  assert.equal(amanda.independentlyProvenSitePublicBy,null);
  assert.equal(amanda.historicalStatementEligible,false);
  assert.ok(amanda.gapCodes.includes('SITE_ORIGINAL_BYTES_AND_HISTORICAL_AVAILABILITY_UNPROVEN'));
  assert.equal(report.membershipPriorities.find(x=>x.senatorName==='Grant Hauschild')?.priority,'P1_existing_positions_source_recheck');
});

test('identity remains unresolved instead of forcing a candidate by matching district alone',()=>{
  const report=auditSenateSosWebsiteSeedInventory(ledger,[member('An Unknown Alias','47','2025-2026',0)]);
  assert.equal(report.membershipPriorities[0].identityMatch,'not_matched');
  assert.equal(report.membershipPriorities[0].candidateWebsiteDiscoveryLeads.length,0);
  assert.ok(report.membershipPriorities[0].gapCodes.includes('MEMBERSHIP_TO_ELECTION_IDENTITY_UNRESOLVED'));
});

test('suffix normalization does not change Senate district or backdate publisher metadata',()=>{
  assert.equal(strictCandidateKey('Michael Holmstrom Jr.'),strictCandidateKey('Michael Holmstrom'));
  const report=auditSenateSosWebsiteSeedInventory(ledger,[member('Michael Holmstrom','29','2025-2026',0)]);
  assert.deepEqual(report.membershipPriorities[0].candidateWebsiteDiscoveryLeads,['https://www.mike4mnsenate.com/']);
  assert.equal(report.membershipPriorities[0].independentlyProvenSitePublicBy,null);
});

test('2026 election-year website fields must not be imported as 2025 historical proofs',()=>{
  assert.throws(()=>parseHistoricalSosSenateCandidateFile('not-a-candidate-row',{
    electionYear:2026,officialFileUrl:'https://sos.mn.gov/2026-candidates.txt',
    capturedAt:null,externallyVerifiedOfficialCapture:false,
  }),/Out-of-scope/);
});

function candidateFileLine(name:string,office:string,website:string,email:string){
  const fields=Array.from({length:19},()=> '');
  fields[0]='1';fields[1]=name;fields[2]='1';fields[3]=office;
  fields[4]='88';fields[5]='DFL';
  fields[6]='PRIVATE STREET';fields[7]='PRIVATE TOWN';fields[14]='PRIVATE PHONE';
  fields[15]=website;fields[16]=email;
  return fields.join(';');
}
const fileSource={electionYear:2022,officialFileUrl:'https://www.sos.mn.gov/elections/2022-file.txt',
  capturedAt:'2022-07-01T00:00:00Z',externallyVerifiedOfficialCapture:true};

test('SOS semicolon parser extracts only Senate candidate, district and website, never addresses/email',()=>{
  const text=[
    candidateFileLine('Grant Hauschild','State Senator District 3','grantformn.com','private@example.org'),
    candidateFileLine('Not Senate','State Representative District 3A','housecandidate.com','private@example.org'),
    candidateFileLine('Doubtful','State Senator District 9','private@example.org','private@example.org'),
    candidateFileLine('Unknown','State Senator District 14','','private@example.org'),
  ].join('\n');
  const result=parseHistoricalSosSenateCandidateFile(text,fileSource);
  assert.equal(result.rows.length,3);
  assert.equal(result.rows[0].candidateName,'Grant Hauschild');
  assert.equal(result.rows[0].website,'https://grantformn.com/');
  assert.equal(result.rows[0].independentlyVerifiedPublicBy,null);
  assert.equal(result.rows[0].sourceAuthenticatedByThisTool,false);
  assert.deepEqual(result.rows.map(r=>r.websiteFieldStatus),['provided_valid_url','invalid_or_email','empty']);
  assert.equal(JSON.stringify(result).includes('private@'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  assert.equal(result.sourceSha256,createHash('sha256').update(text).digest('hex'));
});

test('bad candidate export rows are counted, not silently parsed into official Senator records',()=>{
  const result=parseHistoricalSosSenateCandidateFile('malformed\n'
    +candidateFileLine('Not a senator','State Representative District 3A','house.com','')
    +'\n'+candidateFileLine('Valid','State Senator District 60','http://example.org',''),fileSource);
  assert.equal(result.rejectedMalformedRows,1);
  assert.equal(result.rows.length,1);
});

test('website normalization rejects email-style fields and local/private URL candidates',()=>{
  for(const raw of ['mary@example.com','http://127.0.0.1/foo','localhost:8080','http://example.test','file:///tmp/secrets','https://admin:secret@example.org/']){
    assert.equal(validCampaignWebsite(raw),null,raw);
  }
  assert.equal(validCampaignWebsite('www.example.org/path'),'https://www.example.org/path');
});

test('duplicate election-result districts and tampered website replay eligibility are rejected',()=>{
  const dupe=structuredClone(ledger);
  dupe.winners.push({...dupe.winners[0]});
  assert.throws(()=>auditSenateSosWebsiteSeedInventory(dupe),/Duplicate election result district/);
  const unsafe=structuredClone(ledger);
  unsafe.websiteLeads[0].eligibleForHistoricalReplay=true;
  assert.throws(()=>auditSenateSosWebsiteSeedInventory(unsafe),/discovery-only/);
});

test('bad or duplicate membership export cannot turn unknown into a trusted count',()=>{
  const m=member('Mark Johnson','1','2021-2022',0);
  assert.throws(()=>auditSenateSosWebsiteSeedInventory(ledger,[m,m]),/Invalid or duplicate/);
  assert.throws(()=>auditSenateSosWebsiteSeedInventory(ledger,[{...m,recordedIssuePositionItems:-1}]),/Invalid or duplicate/);
});

test('provided 2022 SOS candidate-file website is still unproven for historic use',()=>{
  const s=parseHistoricalSosSenateCandidateFile(
    candidateFileLine('Grant Hauschild','State Senator District 3','grantformn.com',''),fileSource);
  const report=auditSenateSosWebsiteSeedInventory(ledger,[member('Grant Hauschild','3','2023-2024',0)],s.rows);
  assert.deepEqual(report.membershipPriorities[0].candidateWebsiteDiscoveryLeads,['https://grantformn.com/']);
  assert.equal(report.membershipPriorities[0].historicalStatementEligible,false);
  assert.equal(report.scope.historicalWebsiteCoverageCertified,false);
});

test('offline CLI runs without an export and writes an explicit unknown-zero count',()=>{
  const directory=mkdtempSync(join(tmpdir(),'sos-senate-seeds-'));
  try{
    const target=join(directory,'report.json');
    execFileSync('node',['--import','tsx','scripts/audit-sos-senate-campaign-inventory-offline.ts',
      '--output',target],{timeout:15_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(target,'utf8'));
    assert.equal(report.counts.winnerElectionRecords,139);
    assert.equal(report.counts.zeroRecordedPositionMemberships,null);
    assert.equal(report.membershipPriorities.length,0);
    assert.equal(report.scope.noProductionReads,true);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('offline CLI ranks a synthetic read-only membership export and excludes personal contact fields',()=>{
  const directory=mkdtempSync(join(tmpdir(),'sos-senate-members-'));
  try{
    const roster=join(directory,'roster.jsonl'),output=join(directory,'report.json');
    writeFileSync(roster,JSON.stringify(member('Mark Johnson','1','2021-2022',0))+'\n');
    execFileSync('node',['--import','tsx','scripts/audit-sos-senate-campaign-inventory-offline.ts',
      '--memberships',roster,'--output',output],{timeout:15_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(output,'utf8'));
    assert.equal(report.counts.zeroRecordedPositionMemberships,1);
    assert.equal(report.membershipPriorities[0].priority,'P0_zero_recorded_positions');
    assert.equal(report.membershipPriorities[0].identityMatch,'exact_name_district_candidate');
  }finally{rmSync(directory,{recursive:true,force:true});}
});
