import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicInputs,validateOwnerEvent,ROSTER_SQL,CAMPAIGN_SQL,PRIMARY_SQL}
 from '../scripts/audit-senate-864-95-historical-source-neon-readonly.mjs';
import {canonicalKey,compareHistoric95,validatePublicReport,OWNER_MARKER}
 from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
test('all 95 actual-service people, 339 person-years, 1285 excerpts, 29 source ledgers',()=>{
 const {manifest,research}=readPublicInputs();
 assert.equal(manifest.people.length,95);
 assert.equal(manifest.people.reduce((n,p)=>n+p.serviceYears.length,0),339);
 assert.equal(manifest.people.reduce((n,p)=>n+p.selectedCandidateOwnedResearchExcerpts,0),1285);
 assert.equal(manifest.people.filter(p=>p.selectedCandidateOwnedResearchExcerpts>0).length,92);
 assert.equal(research.ledgersRead,29);
 assert.equal(research.pages.length,95);
 assert.ok(research.pages.reduce((n,p)=>n+p.length,0)>10,'Authentic original URLs with whole page SHA should exist');
});
test('conservative name join supports public aliases, initials, diacritics',()=>{
 assert.equal(canonicalKey('Sr., Charles W. Wiger'),'charles|wiger');
 assert.equal(canonicalKey('Chuck Wiger'),'charles|wiger');
 assert.equal(canonicalKey('D. Scott Dibble'),'scott|dibble');
 assert.equal(canonicalKey('Sandy Pappas'),'sandra|pappas');
 assert.equal(canonicalKey('Sandra L. Pappas'),'sandra|pappas');
 assert.equal(canonicalKey('Melisa López Franzen'),'melisa|franzen');
 assert.equal(canonicalKey('Jennifer A. McEwen'),'jennifer|mcewen');
});
test('fixed read-only SQL cannot be arbitrary query',()=>{
 for(const sql of [ROSTER_SQL,CAMPAIGN_SQL,PRIMARY_SQL]){
  assert.match(sql,/^SELECT /);
  assert.doesNotMatch(sql,/\b(?:insert|update|delete|create|drop|alter|truncate)\b/i);
  assert.match(sql,/LIMIT \d+$/);
 }
});
test('synthetic all-person match, exact original URL and page SHA, never quote completeness',()=>{
 const {manifest,research}=readPublicInputs();
 const roster=manifest.people.map((p,i)=>({name:p.officialName,legislatorId:'fake_l_'+i,membershipId:'fake_m_'+i}));
 const first=research.pages.findIndex(x=>x.length);
 assert.ok(first>=0);
 const page=research.pages[first][0];
 const evidence=[{membershipId:'fake_m_'+first,sourceDocumentId:'fake_d_1',sourceUrl:page.url,
   contentSha256:page.sha,publishedAt:'2022-01-01T00:00:00.000Z'}];
 const pub=compareHistoric95(manifest,research,roster,evidence,[]);
 assert.equal(pub.uniqueLegislatorJoins,95);
 assert.equal(pub.unjoinedOrAmbiguousOfficialPeople,0);
 assert.equal(pub.exactUrlShaStoredLinkedPages,1);
 assert.equal(pub.storedCampaignSiteEvidenceRowsAcrossJoinedHistoricMemberships,1);
 assert.equal(pub.readOnlyTransaction,true);
 assert.equal(pub.explicitRollback,true);
 assert.equal(pub.noProofOf1285ExactQuotesMatched,true);
 assert.equal(pub.rows[first].storedCampaignRowsByPublishedMetadataYear['2022'],1);
 const leaked=structuredClone(pub);leaked.rows[first].membershipId='should-not-export';
 assert.throws(()=>validatePublicReport(leaked,manifest));
});
test('unmatched public actual-serving senator is HOLD not zero',()=>{
 const {manifest,research}=readPublicInputs();
 const pub=compareHistoric95(manifest,research,[],[],[]);
 assert.equal(pub.unjoinedOrAmbiguousOfficialPeople,95);
 assert.equal(pub.rows[0].storedCampaignSiteIssueRows,null);
 assert.equal(pub.rows[0].researchedExactUrlNotObserved,null);
});
test('owner-event gate rejects unauthorized users, attempts, issue bodies',()=>{
 const env={GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_EVENT_NAME:'issue_comment',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),VOTEPREDICT_864_95_APPROVAL:OWNER_MARKER,
  VOTEPREDICT_864_95_PRECI:'true'};
 const event={issue:{number:864},comment:{user:{login:'killjoy00'},body:OWNER_MARKER}};
 assert.doesNotThrow(()=>validateOwnerEvent(env,event));
 assert.throws(()=>validateOwnerEvent(env,{...event,comment:{user:{login:'attacker'},body:OWNER_MARKER}}));
 assert.throws(()=>validateOwnerEvent({...env,GITHUB_RUN_ATTEMPT:'2'},event));
 assert.throws(()=>validateOwnerEvent(env,{...event,issue:{number:863}}));
});
