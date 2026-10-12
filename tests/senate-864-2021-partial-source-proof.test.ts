import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const path='docs/evaluation/source-proof/senate-864-2021-committee-partial-official-original-source-roll-catalogue.json';
const sf9Path='docs/evaluation/source-proof/senate-2021-special1-sf9-original-rule1210-second-run-success.json';
function panel():any{return JSON.parse(readFileSync(path,'utf8'));}
test('#864 2021 original partial panel preserves six source-supported committees, 12 named rolls and 103 named occurrences',()=>{
 const p=panel();
 assert.equal(p.schemaVersion,'senate-864-independent-2021-journal-and-online-committee-original-partial-catalogue-v1');
 assert.equal(p.publishedOriginalCertifiedRolls,12);
 assert.equal(p.sourceRolls.length,12);
 assert.equal(p.originalSourceNamedChoiceOccurrences,103);
 assert.equal(p.sourceCommitteeGroups.length,6);
 assert.equal(p.sourceCommitteeGroups.reduce((n:number,c:any)=>
  n+c.independentlyOriginalAuthenticatedNamedCommitteeRolls,0),12);
 assert.equal(p.sourceCommitteeGroups.reduce((n:number,c:any)=>
  n+c.originalNamedChoiceOccurrences,0),103);
 for(const c of p.sourceCommitteeGroups)assert.equal(c.official2021PrintVolumeMeetingDenominator,null);
 assert.equal(p.notAnIndependentlyCensusedOfficial2021MeetingUniverse,true);
});
test('published journal dates are not fabricated committee hearing dates or independently proven first-public-by dates',()=>{
 const p=panel();
 const journal=p.sourceRolls.filter((r:any)=>r.sourceType==='official_senate_journal_rule_12_10_committee_vote_report');
 assert.equal(journal.length,11);
 assert.ok(journal.every((r:any)=>r.independentCommitteeHearingDay===null&&
  r.originalReportDay?.startsWith('2021-')&&r.originalPrintedJournalPage>0));
 const online=p.sourceRolls.filter((r:any)=>r.sourceType!=='official_senate_journal_rule_12_10_committee_vote_report');
 assert.equal(online.length,1);
 assert.equal(online[0]?.bill,'SF450');
 assert.equal(online[0]?.independentCommitteeHearingDay,'2021-03-10');
 assert.equal(online[0]?.originalReportDay,null);
 for(const r of p.sourceRolls){
  assert.equal(r.independentlyProvenOriginalPublicBy,null);
  assert.equal(r.original2021LRLPrintedVolumeCompared,false);
  assert.equal(r.notAStoredVoteReconciliation,true);
  assert.match(r.originalSourceByteSha256,/^[0-9a-f]{64}$/);
  assert.match(r.originalOfficialSourceUrl,/^https:\/\/www\.senate\.mn\//);
  assert.equal(r.originalNamedChoiceOccurrences,r.sourceNamedYeas+r.sourceNamedNays);
  assert.equal(r.year,2021);
 }
 assert.ok(!p.sourceRolls.some((r:any)=>r.bill==='SF2909'));
 assert.equal(p.reportDateMustNeverSubstituteHearingDate,true);
});
test('2021 distinct SF1159 amendments and SF2/SF173 shared Journal PDF do not collapse on identical counts or SHA',()=>{
 const p=panel();
 const sf1159=p.sourceRolls.filter((r:any)=>r.bill==='SF1159');
 assert.equal(sf1159.length,2);
 assert.equal(sf1159[0].originalOfficialSourceUrl,sf1159[1].originalOfficialSourceUrl);
 assert.equal(sf1159[0].originalSourceByteSha256,sf1159[1].originalSourceByteSha256);
 assert.equal(sf1159[0].originalPrintedJournalPage,2086);
 assert.equal(sf1159[1].originalPrintedJournalPage,2086);
 assert.notEqual(sf1159[0].motionAnchor,sf1159[1].motionAnchor);
 assert.deepEqual(sf1159.map((r:any)=>[r.sourceNamedYeas,r.sourceNamedNays]),[[4,6],[4,6]]);
 const sf2=p.sourceRolls.find((r:any)=>r.bill==='SF2');
 const sf173=p.sourceRolls.find((r:any)=>r.bill==='SF173');
 assert.equal(sf2.originalOfficialSourceUrl,sf173.originalOfficialSourceUrl);
 assert.notEqual(sf2.bill,sf173.bill);
 const identifiers=p.sourceRolls.map((r:any)=>[r.bill,r.session,r.motionAnchor,r.originalOfficialSourceUrl].join('|'));
 assert.equal(new Set(identifiers).size,12);
});
test('2021 special session SF9 later successful real source proof does not erase original strict failure',()=>{
 const p=panel();
 const sf9=p.sourceRolls.find((r:any)=>r.bill==='SF9');
 const receipt=JSON.parse(readFileSync(sf9Path,'utf8'));
 assert.equal(sf9.session,'first_special_session');
 assert.equal(sf9.sourceNamedYeas,6);
 assert.equal(sf9.sourceNamedNays,4);
 assert.equal(sf9.originalPrintedJournalPage,156);
 assert.equal(sf9.originalSourceByteSha256,receipt.originalPublication.originalPdfSHA256);
 assert.equal(receipt.originalFirstStrictSourceRunPreservedFailure.conclusion,'failure');
 assert.equal(receipt.newSecondStrictNamedRollAuthentication.actualRunConclusion,'success');
 assert.equal(receipt.newSecondStrictNamedRollAuthentication.strictOriginalNamedCommitteeRollCertified,true);
 assert.equal(p.firstSpecialSessionSF9FirstStrictRunFailedButLaterIndependentStrictRunSucceeded,true);
});
test('2021 publicly proven original named sides are not publicly exported or mapped to protected stored memberships',()=>{
 const s=readFileSync(path,'utf8');
 assert.doesNotMatch(s,/originalYeaNamesHashDigest|membershipId|normalizedMemberName|individualMemberVotes|privateRowId/);
 const p=JSON.parse(s);
 assert.equal(p.noPrivateMemberIdsOrNormalizedNamesOrSourceSideDigestsExported,true);
 assert.equal(p.noDBWritesOrSourceDateFabrication,true);
});
