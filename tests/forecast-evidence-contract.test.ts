import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash,randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { Pool } from 'pg';
import { evidenceImpactPolicy } from '../src/evidence/policy';
import type { EvidenceDraft } from '../src/evidence/types';
import type { VerifiedImpactProof } from '../src/evidence/verified-impact-proof';
import { supersessionAsOfSql } from '../src/evidence/asof-supersession';
import { retainedTargetTextAsOf,retainRuntimeBillText } from '../src/forecasting/runtime-bill-text';
import { classifyForecastEvidence,readForecastEvidence,type AccessibleEvidence } from '../src/evidence/forecast-evidence-access';
import { captureHealth,recordCaptureAttempt } from '../src/operations/forecast-capture-observability';
import { assertForecastEvidenceRemediationRun } from '../src/operations/forecast-evidence-remediation-gate';
import { verifySealedShadowRetry } from '../src/forecasting/sealed-shadow-retry';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const draft:EvidenceDraft={sourceUrl:'https://example.test/statement',excerpt:'I support SF1.',kind:'direct_statement',stance:'supports',
  claim:'Fixture statement',sourceQuality:'member_primary',relevance:'direct',freshness:'current',confidence:0.99,
  targetMembershipId:'fixture-member',targetBillId:'fixture-bill',metadata:{sourceVerified:true}};
const proof:VerifiedImpactProof={version:'content-bound-impact-v1',sourceUrl:draft.sourceUrl,sourceContentSha256:sha('source'),excerptSha256:sha(draft.excerpt!),
  membershipId:'fixture-member',billId:'fixture-bill',availableAt:'2023-01-01T00:00:00Z',observedAt:'2023-01-01T00:00:00Z',basis:'authenticated_archive',attributionVerified:true};

test('production remediation refuses fork, manual, retry, changed head and wrong workflow',()=>{
  const env={NODE_ENV:'test' as const,GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',
    GITHUB_WORKFLOW_REF:'killjoy00/votepredict/.github/workflows/forecast-evidence-remediation.yml@refs/heads/main',GITHUB_SHA:'a'.repeat(40),VOTEPREDICT_REMEDIATION_CI:'true'};
  const event={repository:{full_name:env.GITHUB_REPOSITORY,default_branch:'main'},after:env.GITHUB_SHA,head_commit:{id:env.GITHUB_SHA,message:'FORECAST_EVIDENCE_REMEDIATION'}};
  assert.doesNotThrow(()=>assertForecastEvidenceRemediationRun(env,event));
  for(const change of [{GITHUB_EVENT_NAME:'workflow_dispatch'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_REF:'refs/heads/topic'},
    {GITHUB_REPOSITORY:'other/repo'},{GITHUB_WORKFLOW_REF:'other'},{VOTEPREDICT_REMEDIATION_CI:'false'},{GITHUB_SHA:'b'.repeat(40)}])
    assert.throws(()=>assertForecastEvidenceRemediationRun({...env,...change},event));
  assert.throws(()=>assertForecastEvidenceRemediationRun(env,{...event,forced:true}));
});

test('same-content shadow retries preserve the first sealed record and reject changed vectors',async()=>{
  const original={kind:'quick_evidence_shadow',version:'v1',capturedAt:'2023-01-01',features:{a:1,b:2}};
  const mock={query:async()=>({rows:[{context:[{kind:'other'},original]}]})};
  await verifySealedShadowRetry(mock as never,'r','m',{...original,features:{b:2,a:1}});
  await assert.rejects(verifySealedShadowRetry(mock as never,'r','m',{...original,capturedAt:'2024-01-01'}),/refusing retry rewrite/);
});

test('Deep requires positive literal/person/bill/time proof, including strict same-time exclusion',()=>{
  const cutoff='2023-01-02T00:00:00Z';
  assert.equal(evidenceImpactPolicy(draft).mechanicallyActionable,false);
  assert.equal(evidenceImpactPolicy(draft,proof,cutoff).mechanicallyActionable,true);
  for(const patch of [{sourceUrl:'https://example.test/other'},{billId:'other'},{membershipId:'other'},
    {excerptSha256:sha('different')},{observedAt:cutoff},{availableAt:cutoff},{attributionVerified:false}])
    assert.equal(evidenceImpactPolicy(draft,{...proof,...patch} as VerifiedImpactProof,cutoff).mechanicallyActionable,false);
  assert.equal(evidenceImpactPolicy({...draft,metadata:{}},proof,cutoff).mechanicallyActionable,false);
  assert.equal(evidenceImpactPolicy({...draft,metadata:{sourceVerified:true,mechanicallyActionable:false}},proof,cutoff).mechanicallyActionable,false);
});

test('legacy finance flags stay excluded and website words require provenance without stance labels',()=>{
  const row:AccessibleEvidence={id:'copy1',sourceHash:sha('source'),sourceUrl:'https://example.test',sourceKind:'finance',
    sourceMembershipId:'old',targetMembershipId:'new',legislatorId:'same-person',billId:null,excerpt:'I support clean water.',publishedAt:'2022-01-01T00:00:00Z',
    fetchedAt:'2026-01-01T00:00:00Z',metadata:{subtype:'candidate_contribution_record',asOfEligible:true,rowKey:'a'.repeat(64),year:2022,filerRegistrationNumber:'12345'},sourceMetadata:{}};
  const f=classifyForecastEvidence(row,'2023-01-01T00:00:00Z');
  assert.equal(f.allowedUse,'context');assert.equal(f.servingAllowed,false);assert.match(f.exclusionReason!,/PUBLICATION_UNPROVED/);
  row.extractionVersion='senate-864-literal-website-observed-asof-v1';
  row.metadata={experimentalWebsiteTextForHistoricalEvaluation:true,asOfEligible:true,mechanicallyActionable:false,
    availabilityProof:'original_site_html_cdx_index_in_existing_research',archiveCapturedAt:row.publishedAt};
  row.sourceMetadata={availabilityProof:'archived_original_html_plus_cdx_research_ledger',archiveCapturedAt:row.publishedAt,originalCdxSha1Base32:'A'.repeat(32)};
  assert.equal(classifyForecastEvidence(row,'2023-01-01T00:00:00Z').allowedUse,'website_text_research');
  assert.equal(classifyForecastEvidence(row,row.publishedAt!).allowedUse,'context');
  assert.equal(classifyForecastEvidence({...row,sourceMetadata:{}},'2023-01-01T00:00:00Z').allowedUse,'context');
});

test('bounded access reports unknown empty coverage and prefers proved copies without multiplying a transaction',async()=>{
  const empty=await readForecastEvidence({query:async()=>({rows:[]})} as never,{membershipId:'m',billId:'b',cutoff:'2023-01-01',family:'website_text'});
  assert.equal(empty.missingMeans,'unknown');assert.deepEqual(empty.observations,[]);
  const base:AccessibleEvidence={id:'a',sourceHash:sha('body'),sourceUrl:'https://example.test/report',sourceKind:'finance',sourceMembershipId:'m',targetMembershipId:'m',legislatorId:'person',billId:null,
    excerpt:null,publishedAt:'2022-02-03T00:00:00Z',fetchedAt:'2026-01-01',sourceMetadata:{},
    metadata:{subtype:'candidate_contribution_record',rowKey:'a'.repeat(64),filerRegistrationNumber:'12345',year:2022,asOfEligible:true}};
  const verified={...base,id:'z',metadata:{...base.metadata,transactionDateIsAvailability:false,transactionDate:'2022-01-01',
    historicalFinanceIndependentVerification:'authenticated_source_bytes_exact_row',historicalFinanceProofType:'official_report_exact_version',
    historicalFinanceProofDigest:sha('proof'),historicalFinanceVerifiedPublicByOn:'2022-02-03',historicalFinanceExactReportVersionId:'version-1',historicalFinanceStatutoryFloorOn:'2022-02-02'}};
  const result=await readForecastEvidence({query:async()=>({rows:[base,verified]})} as never,{membershipId:'m',billId:'b',cutoff:'2023-01-01',family:'finance',year:2022});
  assert.equal(result.observations.length,1);assert.equal(result.observations[0].id,'z');
  assert.equal(result.observations[0].use.allowedUse,'historical_finance_research');
  assert.equal(result.observations[0].use.servingAllowed,false);
  assert.deepEqual(new Set(result.observations[0].sourceObservationIds),new Set(['a','z']));
  await assert.rejects(readForecastEvidence({query:async()=>({rows:[]})} as never,{membershipId:'m',billId:'b',cutoff:'2023-01-01',family:'finance'}),/bounded year/);
});

/** Also used by the bounded offline rehearsal; it creates synthetic records only. */
export async function exerciseForecastEvidenceContract(db:Pool) {
  const tag='readiness-'+randomUUID(),one=async(q:string,p:unknown[]=[]) => (await db.query(q,p)).rows[0];
  const j=(await one(`INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`)).id;
  const c=(await one(`INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[j])).id;
  const s=(await one(`INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,'2023-2024','Fixture') ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,[j])).id;
  const l=(await one(`INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,'Readiness Fixture','readiness fixture') RETURNING id`,[j,tag])).id;
  const m=(await one(`INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title) VALUES($1,$2,$3,'999','Fixture','Senator') RETURNING id`,[s,c,l])).id;
  const b=(await one(`INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,$3,'Fixture bill') RETURNING id`,[s,c,tag])).id;
  const source=async(path:string,date:string)=>(await one(`INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,fetched_at) VALUES($1,$2,$3,'senate_committee_minutes',$4,$5,$6) RETURNING id`,[j,s,c,'https://example.test/'+tag+path,sha(path),date])).id;
  const oldSource=await source('/old','2023-01-01'),newSource=await source('/new','2023-12-01');
  const e=(await one(`INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,occurred_on,yea_count,nay_count) VALUES($1,$2,$3,$4,$5,'amendment','Fixture question','2023-01-01',1,0) RETURNING id`,[s,c,b,oldSource,tag])).id;
  const choice=(await one(`INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,normalized_member_name,choice) VALUES($1,$2,'Readiness Fixture',$3,'yea') RETURNING id`,[e,m,tag])).id;
  const projected=(await db.query(`SELECT evidence_type FROM senate_evidence_v WHERE source_table='member_votes' AND source_row=$1`,[choice])).rows;
  assert.deepEqual(projected.map(x=>x.evidence_type),['committee_vote']);
  assert.equal((await db.query(`SELECT choice_id FROM normalized_senate_votes_asof_v1('2023-01-01',$1,$2,'committee')`,[m,b])).rows.length,0);
  assert.equal((await db.query(`SELECT choice_id FROM normalized_senate_votes_asof_v1('2023-01-02',$1,$2,'committee')`,[m,b])).rows.length,1);
  assert.equal((await db.query(`SELECT choice_id FROM normalized_senate_votes_asof_v1('2023-01-02',$1,$2,'floor')`,[m,b])).rows.length,0);
  const item=async(src:string,date:string)=>(await one(`INSERT INTO evidence_items(source_document_id,membership_id,bill_id,evidence_kind,stance,claim,source_quality,relevance,freshness,extraction_method,published_at,created_at)
    VALUES($1,$2,$3,'fact','neutral','Fixture','official','direct','recent','fixture',$4,$4) RETURNING id`,[src,m,b,date])).id;
  const old=await item(oldSource,'2023-01-01'),newer=await item(newSource,'2023-12-01');
  const billContext=(await one(`INSERT INTO evidence_items(source_document_id,bill_id,evidence_kind,stance,claim,excerpt,source_quality,relevance,freshness,extraction_method)
    VALUES($1,$2,'context','neutral','Bill-level fixture','Bill context without member attribution','official','direct','recent','fixture') RETURNING id`,[oldSource,b])).id;
  const context=await readForecastEvidence(db,{membershipId:m,billId:b,cutoff:'2024-01-01',family:'bill_context'});
  assert.ok(context.observations.some(x=>x.id===billContext&&x.sourceMembershipId===null));
  await db.query(`INSERT INTO evidence_relationships(from_evidence_id,to_evidence_id,relation_kind) VALUES($1,$2,'supersedes')`,[newer,old]);
  const visible=async(cut:string)=>(await db.query(`SELECT ei.id FROM evidence_items ei WHERE ei.id=$1 AND ${supersessionAsOfSql('$2')}`,[old,cut])).rows.length;
  assert.equal(await visible('2023-02-01'),1);assert.equal(await visible('2023-12-02'),0);
  const bv=(await one(`INSERT INTO bill_versions(bill_id,version_key,published_at,raw_text) VALUES($1,'latest','2020-01-01','Legacy mutable body') RETURNING id`,[b])).id;
  const now=Date.now(),text='Immutable observed bill body. '.repeat(10),client={query:db.query.bind(db)};
  const first=await retainRuntimeBillText(client as never,{billId:b,billVersionId:bv,versionKey:'v0',sourceUrl:'https://example.test/'+tag,claimedPublishedAt:'2020-01-01',observedAt:new Date(now).toISOString(),text,title:'Observed title'});
  const cutoff=new Date(now+1000).toISOString();
  assert.equal((await retainedTargetTextAsOf(db,b,cutoff))?.text,text);
  await db.query(`UPDATE bill_versions SET raw_text='Future mutable body',published_at='2099-01-01' WHERE id=$1`,[bv]);
  await retainRuntimeBillText(client as never,{billId:b,billVersionId:bv,versionKey:'v1',sourceUrl:'https://example.test/'+tag,claimedPublishedAt:'2020-01-01',observedAt:new Date(now+2000).toISOString(),text:'New later body. '.repeat(10),title:'Later title'});
  assert.equal((await retainedTargetTextAsOf(db,b,cutoff))?.textSha256,first.textSha256);
  assert.equal(await retainedTargetTextAsOf(db,b,'2019-01-01T00:00:00Z'),undefined);
  await assert.rejects(db.query(`UPDATE evidence_content_blobs SET body=body WHERE sha256=$1`,[first.textSha256]),/append-only/);
  await assert.rejects(db.query(`DELETE FROM forecast_bill_text_observations WHERE bill_id=$1`,[b]),/append-only/);
  const forecast=(await one(`INSERT INTO forecasts(owner_user_id,target_type,target_kind,bill_id,target_chamber_id,session_id) VALUES('fixture','bill','senate_floor_passage',$1,$2,$3) RETURNING id`,[b,c,s])).id;
  const revision=(await one(`INSERT INTO forecast_revisions(forecast_id,revision_number,research_mode,generated_at) VALUES($1,1,'quick',now()) RETURNING id`,[forecast])).id;
  const manifest=JSON.stringify({fixture:true,asOf:cutoff,targetTextHash:first.textSha256,missingMeans:'unknown'});
  await db.query(`INSERT INTO forecast_input_manifests(revision_id,schema_version,manifest_json,manifest_sha256) VALUES($1,'forecast-input-manifest-v1',$2,$3)`,[revision,manifest,sha(manifest)]);
  await assert.rejects(db.query(`UPDATE forecast_input_manifests SET manifest_json=manifest_json WHERE revision_id=$1`,[revision]),/append-only/);
  await recordCaptureAttempt(db,revision,'quick_evidence','started');
  await recordCaptureAttempt(db,revision,'quick_evidence','failed');
  assert.ok((await captureHealth(db)).failed>=1);
  await recordCaptureAttempt(db,revision,'quick_evidence','completed');
  const statuses=(await db.query(`SELECT status FROM forecast_capture_attempts WHERE revision_id=$1 ORDER BY sequence`,[revision])).rows;
  assert.deepEqual(statuses.map(x=>x.status),['started','failed','completed']);
  assert.equal((await one(`SELECT manifest_sha256 FROM forecast_input_manifests WHERE revision_id=$1`,[revision])).manifest_sha256,sha(manifest));
  return {committeeVenue:true,historicalTextInvariant:true,futureSupersessionSafe:true,appendOnly:true,captureFailureAndRetry:true,syntheticOnly:true};
}

const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local=!!url&&['localhost','127.0.0.1'].includes(new URL(url).hostname);
test('Postgres: venue, time-safe text, supersession, sealed inputs and observable retries',{skip:!local,timeout:60000},async()=>{
  const schema='contract_'+randomUUID().replaceAll('-','');
  const admin=new Pool({connectionString:url,max:1});
  const db=new Pool({connectionString:url,max:2,options:'-c search_path='+schema+',public'});
  try{
    await admin.query('CREATE SCHEMA '+schema);
    for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())
      await db.query(readFileSync('migrations/'+file,'utf8').replaceAll('public.',schema+'.'));
    await exerciseForecastEvidenceContract(db);
  }finally{await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
