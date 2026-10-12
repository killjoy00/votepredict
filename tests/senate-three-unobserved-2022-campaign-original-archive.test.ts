import assert from 'node:assert/strict';
import test from 'node:test';
import {
 UNOBSERVED_SENATE_SITE_2022_LEADS,
 parseOriginalThreeSenatorCdxResponse,
 sourceYear2022CitationLimit,
} from '../src/evidence/senate-three-unobserved-2022-campaign-original-archive.js';

const header=['timestamp','original','mimetype','statuscode','digest','length'];
const D='A'.repeat(32);
test('three exact currently uncovered actually-serving senator people and original host identities cannot drift',()=>{
 assert.deepEqual(UNOBSERVED_SENATE_SITE_2022_LEADS.map(x=>x.officialName),[
  'Gene Dornink','Matt D. Klein','Susan Pha']);
 assert.deepEqual(UNOBSERVED_SENATE_SITE_2022_LEADS.map(x=>x.host),[
  'genedorninkforsenate.com','mattklein.org','susanphaforsenate.com']);
 assert.ok(UNOBSERVED_SENATE_SITE_2022_LEADS.every(x=>
  x.year===2022&&x.cycleLimitExclusive==='20221108000000'));
});
test('source parser accepts only valid CDX original same-domain pre-election HTML rows and prefers issue pages',()=>{
 const rows=[header,
 ['20221001120000','https://susanphaforsenate.com/','text/html','200',D,'3056'],
 ['20221002120000','https://susanphaforsenate.com/issues/','text/html','200',D,'6551'],
 ['20221001120000','https://susanphaforsenate.com/images/logo.png','text/html','200',D,'100'],
 ['20221001120000','https://someotherparty.com/issues/','text/html','200',D,'200'],
 ['20221108150000','https://susanphaforsenate.com/issues-now','text/html','200',D,'200'],
 ['20221001120000','https://susanphaforsenate.com/media','text/css','200',D,'200'],
 ];
 const r=parseOriginalThreeSenatorCdxResponse(rows,'susanphaforsenate.com','20221108000000');
 assert.equal(r.allQualifyingOriginalCDXRows,2);
 assert.deepEqual(r.selectedRows.map(x=>new URL(x.original).pathname),['/issues/','/']);
 assert.equal(r.sourceCDXCapReached,false);
});
test('CDX malformed or changed original column schema fails; cap indicates sampling, not site nonexistence',()=>{
 assert.throws(()=>parseOriginalThreeSenatorCdxResponse([['original','timestamp']], 'mattklein.org','20221108000000'),/schema/);
 assert.throws(()=>parseOriginalThreeSenatorCdxResponse([header,['20220301000000']], 'mattklein.org','20221108000000'),/malformed/);
 const many=[header,...Array(200).fill(null).map((_,i)=>[
  '20220101120000','https://mattklein.org/priority'+i,'text/html','200',D,'2000'])];
 const s=parseOriginalThreeSenatorCdxResponse(many,'mattklein.org','20221108000000');
 assert.equal(s.sourceCDXCapReached,true);
 assert.equal(s.allQualifyingOriginalCDXRows,200);
 assert.equal(s.selectedRows.length,4);
});
test('2022 archive date is a public archive capture bound, NEVER proof of candidate authored date',()=>{
 assert.equal(sourceYear2022CitationLimit({timestamp:'20221107115900'},'20221108000000'),true);
 assert.equal(sourceYear2022CitationLimit({timestamp:'20221108000000'},'20221108000000'),false);
 assert.equal(sourceYear2022CitationLimit({timestamp:'20261011020000'},'20221108000000'),false);
 assert.equal(sourceYear2022CitationLimit({timestamp:'2022-11-07'},'20221108000000'),false);
});


test('permanent source receipt pins original CDX SHA and evidence absent without manufacturing policy',async()=>{
 const {readFileSync}=await import('node:fs');
 const c=JSON.parse(readFileSync('docs/evaluation/source-proof/senate-three-unobserved-2022-original-firstparty-archive-source-checkpoint.json','utf8'));
 assert.equal(c.issue,864);
 assert.equal(c.originalSourceOutcome,'success');
 assert.equal(c.originalCdxFullBodiesHashed,3);
 assert.equal(c.validOriginalSchemaCdxIndexResponses,2);
 assert.deepEqual(c.originalCDXResponses.map((x:any)=>x.senator),UNOBSERVED_SENATE_SITE_2022_LEADS.map(x=>x.officialName));
 assert.deepEqual(c.originalCDXResponses.map((x:any)=>x.entireOriginalCDXBytes),[3,184,192]);
 assert.ok(c.originalCDXResponses.every((x:any)=>x.sourceHTTPStatus===200&&/^[a-f0-9]{64}$/.test(x.entireOriginalCDXSHA256)));
 assert.equal(c.originalCDXResponses[0].classification,'HOLD_invalid_original_archive_index_schema');
 assert.equal(c.originalCDXResponses[0].originalQualifiedPreElectionRows,null);
 assert.equal(c.originalCDXResponses[1].originalQualifiedPreElectionRows,0);
 assert.equal(c.originalCDXResponses[2].originalQualifiedPreElectionRows,0);
 assert.equal(c.independentlyVerifiedOriginalCandidateHTMLBodies,0);
 assert.equal(c.newVerbatimHistoricallyProvenIssueExcerpts,0);
 assert.equal(c.historical2022OriginalCandidateSitePublicByNewProofs,0);
 assert.equal(c.priorAuthenticOriginalWebsiteExcerptLeadPeople,79);
 assert.equal(c.remainingPriorUnobservedPeople,16);
 assert.equal(c.emptyArchiveIndexNeverEvidenceNoCampaignPosition,true);
 assert.equal(c.modernSiteCopyNeverBackdatedTo2022,true);
 assert.equal(c.sourceToDBHistoricalReconciliationDone,false);
 assert.equal(c.issue864MustRemainOpen,true);
});
