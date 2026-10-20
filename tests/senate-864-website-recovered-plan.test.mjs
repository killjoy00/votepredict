import test from 'node:test';import assert from 'node:assert/strict';
import {expansionInputs} from '../src/evidence/senate-864-website-expansion.mjs';
import {bindRecoveredPlan,recoverySha} from '../src/evidence/senate-864-website-recovered-plan.mjs';
import {candidateSiteDrafts,websiteEvidenceDraft} from '../src/evidence/senate-864-website-signal-neon.mjs';
const commit='a'.repeat(40),old=expansionInputs();
function syntheticReceipt(){
 const source={originalUrl:'https://synthetic.example/issues',originalHtmlSha256:'a'.repeat(64),originalArchiveCapturedAtUtc:'2020-01-01T00:00:00.000Z',originalArchiveCdxSha1Base32:'A'.repeat(32)};
 const verified=old.current.holds.filter(r=>r.reason!=='outside_served_senate_cohort').map(r=>{
  const x={id:r.id,ordinal:r.ordinal,issueTag:null,literal:'Synthetic contained literal',sourceUrl:source.originalUrl,sourceSha:source.originalHtmlSha256,archiveCapturedAt:source.originalArchiveCapturedAtUtc,originalCdxSha1:source.originalArchiveCdxSha1Base32};
  x.ingestionIdentityKey=recoverySha('senate-864-website-literal-asof-v1|'+x.id+'|'+x.literal+'|'+[x.sourceUrl,x.sourceSha,x.archiveCapturedAt].join('|'));return x;
 });
 return {schema:'senate864-website-metadata-recovery-v1',reviewedCommit:commit,existingStoredExcerpts:668,newOriginalVerifiedExcerpts:526,remainingSourceHolds:0,unknownPeople:0,knownScopeExclusions:3,verified,held:[],sourceReceipts:[source]};
}
test('exact bounded receipt preserves every old record and all non-serving flags; distinguish copies from literals',()=>{
 const p=bindRecoveredPlan(syntheticReceipt(),commit);assert.equal(p.current.ready.length,1194);assert.equal(p.current.holds.length,3);
 assert.deepEqual(p.current.ready.slice(0,668),old.current.ready);assert.ok(p.accounting.uniquePersonLiteralPairs<1194);
 const uuid=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
 const roster=p.manifest.people.map((x,i)=>({name:x.officialName,legislatorId:uuid(i+1),membershipId:uuid(i+101),sessionSlug:'2021-2022'}));
 for(const r of candidateSiteDrafts(p.manifest,roster,p.current)){
  const m=websiteEvidenceDraft(r).drafts[0].metadata;assert.equal(m.mechanicallyActionable,false);assert.equal(m.modelWeight,0);assert.equal(m.sameDayEligible,false);
 }
});
test('wrong commit, excluded identities, missing source proof, modified keys and duplicate rows fail closed',()=>{
 assert.throws(()=>bindRecoveredPlan(syntheticReceipt(),'b'.repeat(40)));
 for(const mutate of [r=>r.verified[0].ordinal=96,r=>r.sourceReceipts=[],r=>r.verified[0].literal+=' changed',r=>r.verified[0]=r.verified[1]]){
  const r=syntheticReceipt();mutate(r);assert.throws(()=>bindRecoveredPlan(r,commit));
 }
});
test('read-only audit rolls back even when stored schema identity is rejected',async()=>{
 const {recoveredReadOnly}=await import('../scripts/ingest-senate-864-recovered-websites.mjs');const calls=[];
 const client={query:async(sql)=>{calls.push(sql);return {rows:[{db:'wrong',role:'wrong',ro:'off',isolation:'read committed'}]}}};
 await assert.rejects(()=>recoveredReadOnly(client,{database:'expected',role:'expected'},null));
 assert.match(calls[0],/REPEATABLE READ READ ONLY/);assert.equal(calls.at(-1),'ROLLBACK');
});
