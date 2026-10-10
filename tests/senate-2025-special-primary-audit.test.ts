import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import specialJson from '../data/evaluation/senate-2025-special-primary-candidate-observations-v1.json' with { type:'json' };
import websiteJson from '../data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json' with { type:'json' };
import { audit2025SenateSpecialPrimary,parse2025SenateSpecialCandidateLookup,
  type SpecialPrimaryManifest } from '../src/evidence/senate-2025-special-primary-audit.js';
import type { SenateSosSeedManifest } from '../src/evidence/sos-senate-historical-candidate-inventory.js';
const source=specialJson as unknown as SpecialPrimaryManifest;
const seeds=websiteJson as unknown as SenateSosSeedManifest;
const sos20250826=[
'01490301;Bradley Kurtz;0149;State Senator District 29;88;03;R',
'01490302;Rachel Davis;0149;State Senator District 29;88;03;R',
'01490303;Michael Holmstrom Jr;0149;State Senator District 29;88;03;R',
'01490401;Louis McNutt;0149;State Senator District 29;88;04;DFL',
'01670301;Dwight Dorau;0167;State Senator District 47;88;03;R',
'01670401;Ethan Cha;0167;State Senator District 47;88;04;DFL',
'01670402;Amanda Hemmingsen-Jaeger;0167;State Senator District 47;88;04;DFL',
].join('\n');
const syntheticMembership=(name:string,district:string,count:number)=>
  ({membershipId:'2025:'+name,senatorName:name,district,sessionSlug:'2025-2026' as const,
    recordedIssuePositionItems:count});
test('reconcile 25 independently observed primary candidates across 4 official 2025 special Senate districts',()=>{
  const report=audit2025SenateSpecialPrimary(source,seeds);
  assert.deepEqual(report.counts.candidatesByDistrict,{'6':9,'29':4,'47':3,'60':9});
  assert.equal(report.counts.sourceElections,3);
  assert.equal(report.counts.primaryCandidatesObserved,25);
  assert.equal(report.counts.exactEventualGeneralWinnerIdentities,4);
  assert.equal(report.counts.otherPrimaryCandidateObservations,21);
  assert.equal(report.counts.specialPrimaryPublisherWebsiteLeads,5);
  assert.equal(report.counts.zeroCampaignPositionMemberRows,null);
  assert.equal(report.scope.preVoteCampaignIssuePositionsVerified,false);
});
test('District 60 SOS filed list has exactly one name not in primary contest, with no inference of withdrawal',()=>{
  const report=audit2025SenateSpecialPrimary(source,seeds);
  assert.equal(report.counts.overlappingKnownFiledCandidates,18);
  assert.equal(report.counts.filedNamesNotSeenInPrimaryResults,1);
  assert.deepEqual(report.officialSpecialFiledCandidateNamesNotInPrimaryResult,[
    {name:'Mohamed Jama',district:'60',sourceId:'sos-filed-2025-60',
      primaryResultAbsenceInterpretation:'unknown_not_withdrawal_or_missing_website'}]);
  assert.deepEqual(report.primaryCandidateNamesNotInExistingOfficialFilerList,[]);
});
test('winner identities from Senate SD6 SD29 SD47 SD60 are strict, without opponent transfer',()=>{
  const report=audit2025SenateSpecialPrimary(source,seeds);
  const winners=report.primaryCandidateObservations.filter(c=>c.exactGeneralElectionWinnerIdentity);
  assert.deepEqual(winners.map(c=>[c.district,c.candidateName]).sort((a,b)=>a[0].localeCompare(b[0])),
    [['29','Michael Holmstrom Jr'],['47','Amanda Hemmingsen-Jaeger'],
      ['6','Keri Heintzeman'],['60','Doron Clark']]);
  const nonwinner=report.primaryCandidateObservations.find(c=>c.candidateName==='Dwight Dorau')!;
  assert.equal(nonwinner.exactGeneralElectionWinnerIdentity,false);
  assert.deepEqual(nonwinner.publisherCampaignSiteDiscoveryLeads.map(x=>x.url),['https://votefordwight.com/']);
  assert.equal(nonwinner.independentlyVerifiedCampaignSitePublicBy,null);
});
test('publisher-linked sites never become primary-filing websites or historically verified statements',()=>{
  const report=audit2025SenateSpecialPrimary(source,seeds);
  const withLeads=report.primaryCandidateObservations.filter(c=>c.publisherCampaignSiteDiscoveryLeads.length>0);
  assert.equal(withLeads.length,5);
  assert.ok(report.primaryCandidateObservations.every(c=>c.campaignWebsiteFromPrimaryResult===null));
  assert.ok(report.primaryCandidateObservations.every(c=>c.verifiedPreVoteIssueStatements===0));
  assert.ok(withLeads.every(c=>c.publisherCampaignSiteDiscoveryLeads.every(l=>
    l.claimStatus==='discovery_only_no_historical_site_capture')));
});
test('SOS 2025 candidate-ID table matches source identities exactly; no raw-byte provenance claim',()=>{
  const report=audit2025SenateSpecialPrimary(source,seeds,undefined,sos20250826);
  assert.equal(report.localCandTextIdentityCheck?.compared,7);
  assert.equal(report.localCandTextIdentityCheck?.exactCandidateIdNamePartyMatch,true);
  assert.equal(report.localCandTextIdentityCheck?.provesOriginalSourceBytes,false);
  assert.equal(report.originalSources[2].originalSourceByteHashVerified,false);
});
test('2025 SOS candidate lookup parser rejects 21-col phone and address candidate files',()=>{
  const raw=sos20250826.split('\n')[0]+';PRIVATE STREET;PRIVATE PHONE;PRIVATE EMAIL';
  assert.throws(()=>parse2025SenateSpecialCandidateLookup(raw),/Invalid/);
  assert.equal(JSON.stringify(source).includes('PRIVATE'),false);
});
test('candidate ID table parser enforces correct Senate office, party, and unique candidate IDs',()=>{
  assert.throws(()=>parse2025SenateSpecialCandidateLookup('01490301;Fake;0167;State Senator District 29;88;03;R'),/Invalid|mismatch/);
  assert.throws(()=>parse2025SenateSpecialCandidateLookup(sos20250826.split('\n')[0]+'\n'+sos20250826.split('\n')[0]),/Duplicate/);
  assert.throws(()=>parse2025SenateSpecialCandidateLookup('01490301;Fake;0149;State Senator District 29;88;03;I'),/Invalid/);
});
test('manifest mutation to suggest a campaign website or pre-election source timing fails closed',()=>{
  const m=structuredClone(source);
  (m.candidates[0] as unknown as {originalCampaignWebsite:string}).originalCampaignWebsite='https://some.site';
  assert.throws(()=>audit2025SenateSpecialPrimary(m,seeds),/Invalid or duplicate/);
  const t=structuredClone(source);
  (t.candidates[0] as unknown as {actualStatementTextObserved:boolean}).actualStatementTextObserved=true;
  assert.throws(()=>audit2025SenateSpecialPrimary(t,seeds),/Invalid or duplicate/);
  const date=structuredClone(source);
  date.sources[0].electionOn='2026-01-14';
  assert.throws(()=>audit2025SenateSpecialPrimary(date,seeds),/source metadata/);
});
test('manifest missing a primary competitor or adding duplicate candidate fails source/count constraints',()=>{
  const missing=structuredClone(source);
  missing.candidates.pop();
  assert.throws(()=>audit2025SenateSpecialPrimary(missing,seeds),/count mismatch/);
  const doubled=structuredClone(source);
  doubled.candidates.push({...doubled.candidates[0]});
  assert.throws(()=>audit2025SenateSpecialPrimary(doubled,seeds),/Invalid or duplicate/);
});
test('if official list differs from published SOS primary file, local match is rejected',()=>{
  const raw=sos20250826.replace('Rachel Davis','Rachel Dobbs');
  assert.throws(()=>audit2025SenateSpecialPrimary(source,seeds,undefined,raw),/does not exactly match/);
});
test('opt-in read-only membership priority ranks 2025 calendar-year gap, no evidence promotion',()=>{
  const report=audit2025SenateSpecialPrimary(source,seeds,[
    syntheticMembership('Keri Heintzeman','6',0),
    syntheticMembership('Doron Clark','60',0),
    syntheticMembership('Michael Holmstrom Jr','29',3),
  ]);
  assert.equal(report.counts.zeroCampaignPositionMemberRows,2);
  assert.equal(report.counts.memberRowsProvided,3);
  assert.ok(report.membershipPriorities.every(m=>m.specialPrimaryIdentityMatchOnly));
  assert.ok(report.membershipPriorities.every(m=>!m.historicalCampaignStatementPromoted));
});
test('2026 or wrong-cohort memberships cannot be falsely linked to 2025 primaries',()=>{
  const report=audit2025SenateSpecialPrimary(source,seeds,[{
    ...syntheticMembership('Keri Heintzeman','6',0),sessionSlug:'2023-2024',
  }]);
  assert.equal(report.counts.memberRowsProvided,0);
  assert.equal(report.counts.zeroCampaignPositionMemberRows,0);
});
test('offline 2025 CLI without membership export reports unknown gaps',()=>{
  const dir=mkdtempSync(join(tmpdir(),'senate2025-audit-'));
  try{
    const out=join(dir,'result.json');
    execFileSync('node',['--import','tsx','scripts/audit-senate-2025-special-primary-offline.ts',
      '--output',out],{timeout:15_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(report.counts.primaryCandidatesObserved,25);
    assert.equal(report.counts.filedNamesNotSeenInPrimaryResults,1);
    assert.equal(report.counts.zeroCampaignPositionMemberRows,null);
    assert.equal(report.scope.noProductionDbRead,true);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline CLI accepts local SOS candidate text but never claims authenticated original source bytes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'senate2025-cand-'));
  try{
    const data=join(dir,'cand.txt'),out=join(dir,'report.json');
    writeFileSync(data,sos20250826+'\n');
    execFileSync('node',['--import','tsx','scripts/audit-senate-2025-special-primary-offline.ts',
      '--candidate-file',data,'--output',out],{timeout:15_000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(report.localCandTextIdentityCheck.compared,7);
    assert.equal(report.localCandTextIdentityCheck.provesOriginalSourceBytes,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
