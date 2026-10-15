import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOURCE_LEDGER_FILES} from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
import {buildRecoveryPlan} from '../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
import {websiteExcerptPlan,observedBeforeVote} from '../src/evidence/senate-864-historical-site-excerpt-asof.mjs';
import {candidateSiteDrafts,websiteEvidenceDraft,WEBSITE_ASOF_QUERY} from '../src/evidence/senate-864-website-signal-neon.mjs';
const manifest=JSON.parse(readFileSync('data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json'));
const docs=new Map(SOURCE_LEDGER_FILES.map(f=>[f,JSON.parse(readFileSync(f))]));
const plan=websiteExcerptPlan(manifest,docs,buildRecoveryPlan().witnesses);
const uuid=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const roster=manifest.people.map((p,i)=>({
 name:p.officialName,legislatorId:uuid(i+1),
 membershipId:uuid(i+301),sessionSlug:'2021-2022'
}));
test('research-only historical source excerpts are 1,197 explicit rows, of which only dated proven rows are selected',()=>{
 const rows=candidateSiteDrafts(manifest,roster,plan);
 assert.equal(rows.length,plan.ready.length);
 assert.equal(rows.length,616);
 assert.equal(new Set(rows.map(x=>x.key)).size,rows.length);
 for(const row of rows){
  const {source,drafts}=websiteEvidenceDraft(row);
  assert.equal(source.sourceKind,'wayback_campaign_site');
  assert.equal(source.contentSha256,row.sourceSha);
  assert.equal(drafts.length,1);
  assert.equal(drafts[0].excerpt,row.literal);
  assert.equal(drafts[0].publishedAt,row.observedAt);
  assert.equal(drafts[0].metadata.observationDateNotFirstAuthorship,true);
  assert.equal(drafts[0].metadata.asOfEligible,true);
  assert.equal(drafts[0].metadata.contextOnly,true);
  assert.equal(drafts[0].metadata.mechanicallyActionable,false);
  assert.equal(drafts[0].metadata.modelWeight,0);
  assert.equal(drafts[0].kind,'context');
  assert.equal(drafts[0].stance,'neutral');
  assert.ok(observedBeforeVote(row.observedAt,'2026-12-31T23:59:59.000Z'));
 }
 assert.match(WEBSITE_ASOF_QUERY,/ei\.published_at < \$2::timestamptz/);
 assert.match(WEBSITE_ASOF_QUERY,/website_m\.legislator_id=vote_m\.legislator_id/);
});
test('archived pages link later service sessions by legislator; not a prediction of vote',()=>{
 const multi=[...roster,{...roster[1],membershipId:uuid(800),sessionSlug:'2025-2026'}];
 const rows=candidateSiteDrafts(manifest,multi,plan);
 const after=rows.filter(x=>x.ordinal===2&&x.observedAt.startsWith('2025-'));
 if(after.length)assert.ok(after.every(x=>x.membershipId===uuid(800)));
 assert.throws(()=>candidateSiteDrafts(manifest,[...roster,{...roster[0],legislatorId:uuid(900),membershipId:uuid(901)}],plan));
});
