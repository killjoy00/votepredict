import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractExplicitGroupedRolls,extractReviewedCheckboxQuestions} from '../src/evidence/senate-864-reviewed-rolls.mjs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {freshOriginals,runProduction,correctionPlan} from '../scripts/deploy-senate-864-population-row-rolls.mjs';
const f=JSON.parse(readFileSync('tests/fixtures/senate-864-reviewed-rolls.json')),[tax,labor]=f.sourceDocuments;
const html=()=>labor.text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const pdf=async({url})=>({contentSha256:url===tax.url?tax.sha256:labor.corroboratingPdfSha256});
const originals=()=>freshOriginals(async()=>html(),'reviewed',pdf);
const roster=f.roster.map((m,i)=>({...m,membership_id:'m'+i}));
const proven=(text,d)=>extractRowRollQuestions(text,d).filter(q=>q.confidence==='source_proven_question');
test('reviewed cell images and raw raster hashes match the already published page audit; grouped parsing requires explicit reviewed opt-in',()=>{
 const audit=JSON.parse(readFileSync('docs/evaluation/source-proof/senate-864-55-ocr-rendered-audit-20261023.json'));
 assert.equal(f.review.renderCommit,audit.sourceReview.commit);
 const source=audit.sources.find(s=>s.sourceId===tax.sourceId);assert.equal(source.originalSha256,tax.sha256);assert.equal(source.extractedTextSha256,tax.textSha256);
 for(const t of tax.reviewedCheckboxEvidence.tables){const p=source.pages.find(p=>p.page===t.page);assert.equal(t.raw300dpiPageSha256,p.raw300dpiPageSha256);assert.equal(t.reviewImageSha256,p.reviewImageSha256);assert.equal(p.legible,true);}
 const d={...labor,explicitGroupedRollEvidence:false};assert.ok(!extractRowRollQuestions(d.text,d).some(q=>q.format==='explicit_labeled_roll_after_bound_motion'));
});
test('actual ten reviewed handwritten grids and five canonical grouped rolls prove 15 distinct questions and 146 binary choices',()=>{
 const a=proven(tax.text,tax),b=proven(labor.text,labor);
 assert.equal(a.length,10);assert.equal(b.length,5);
 assert.equal(a.reduce((n,q)=>n+q.choices.length,0),97);assert.equal(b.reduce((n,q)=>n+q.choices.length,0),49);
 assert.deepEqual(a.map(q=>[q.amendmentRef,q.yea,q.nay,q.passed]),[['A36',5,4,true],['A35',4,6,false],['A37',5,4,true],['A28',4,6,false],['A12',4,5,false],['A24',2,8,false],['A23',10,0,true],['A4',5,5,false],['A26',4,6,false],[null,8,2,true]]);
 assert.deepEqual(b.map(q=>[q.amendmentRef,q.yea,q.nay,q.passed]),[['A10',6,3,true],['A9',6,4,true],['A5',4,6,false],['A12',6,4,true],['A17',4,6,false]]);
 assert.equal(new Set([...a,...b].map(q=>q.questionKey)).size,15);
 for(const d of [tax,labor])for(const q of proven(d.text,d))assert.equal(resolvePrintedHistoricalChoices(q,d.text,roster,d).length,q.choices.length);
 assert.ok(!a.some(q=>q.amendmentRef==='A31')); // withdrawn blank sheet
 assert.equal(a.at(-1).voteKind,'motion');assert.match(a.at(-1).motionText,/recommended to pass/);
});
test('changed marks require the explicit final-choice annotation; Pass and Absent supply no inferred binary choice',()=>{
 const qs=extractReviewedCheckboxQuestions(tax.text,tax),a35=qs.find(q=>q.amendmentRef==='A35'),a26=qs.find(q=>q.amendmentRef==='A26'),a12=qs.find(q=>q.amendmentRef==='A12');
 assert.equal(a35.choices.find(v=>v.name==='Klein').choice,'yea');assert.equal(a26.choices.find(v=>v.name==='Dziedzic').choice,'nay');
 assert.equal(a12.choices.some(v=>v.name==='Dziedzic'),false);assert.ok(a12.nonbinaryLabelConflict);assert.equal(a12.excludedOtherLabels,1);
 for(const page of [4,12]){const d=structuredClone(tax);delete d.reviewedCheckboxEvidence.tables.find(t=>t.page===page).rows.find(r=>r.correction).correction;assert.ok(extractReviewedCheckboxQuestions(d.text,d).find(q=>q.reviewedPage===page).holds.includes('unresolved_changed_vote'));}
});
test('reviewed cell provenance, exact narrative, page identity, selected question, outcome, parent and counts fail closed',()=>{
 for(const change of [d=>d.sha256='0'.repeat(64),d=>d.text+=' drift',d=>d.date='2023-04-28']){
  const d=structuredClone(tax);change(d);assert.throws(()=>extractReviewedCheckboxQuestions(d.text,d));
 }
 const changes=[t=>t.reviewConfirmed=false,t=>t.header.reverse(),t=>t.rows.pop(),t=>t.literalQuestion='A99',t=>t.narrativePassage+=' invented',t=>t.printedOutcome='Did Not Prevail',t=>t.yea=4,t=>t.parentAmendmentRef='A99',t=>t.rows[0].marks=['?'],t=>t.rows[1].name=t.rows[0].name,t=>t.raw300dpiPageSha256='wrong'];
 for(const change of changes){const d=structuredClone(tax);change(d.reviewedCheckboxEvidence.tables[0]);assert.equal(extractReviewedCheckboxQuestions(d.text,d)[0].confidence,'held_question');}
 const d=structuredClone(tax);delete d.reviewedCheckboxEvidence;assert.deepEqual(extractReviewedCheckboxQuestions(d.text,d),[]);
});
test('grouped rolls bind the originating amendment and explicitly accepted oral changes; unrelated or ambiguous context holds',()=>{
 const qs=extractExplicitGroupedRolls(labor.text,labor);for(const ref of ['A5','A12'])assert.match(qs.find(q=>q.amendmentRef===ref).motionText,/accepted.*friendly/);
 const changes=[s=>s.replace('accepted the Wesenberg oral amendment as friendly.','rejected the Wesenberg oral amendment.'),s=>s.replace('oral amendment is adopted along a voice vote to the A-5.','oral amendment is adopted along a voice vote to the A-99.'),s=>s.replace('6 yes votes and 3 no votes','5 yes votes and 3 no votes'),s=>s.replace('Hauschilld','Unknown Name'),s=>s.replace('Senator Gruenhagen offered the A-5 amendment','Senator Gruenhagen offered the A-5 amendment to SF9999.'),s=>s.replace('Senator Gruenhagen offered the A-5 amendment','Senator Gruenhagen offered the A-5 amendment Senator Marty moved to adjourn.')];
 for(const change of changes){const text=change(labor.text);assert.notEqual(text,labor.text);const actual=extractExplicitGroupedRolls(text,labor);assert.ok(actual.some(q=>q.confidence==='held_question')||(()=>{try{for(const q of actual)resolvePrintedHistoricalChoices(q,text,roster,labor);return false;}catch{return true;}})());}
 const noHeading=labor.text.replace(/^\s*S\.F\. 5266:.*$/gm,'');assert.ok(extractExplicitGroupedRolls(noHeading,labor).every(q=>q.holds.length));
});
test('misspelled grouped surname needs one active exact stored alias plus its unique full printed header name',()=>{
 const q=proven(labor.text,labor).find(q=>q.amendmentRef==='A9'),v=resolvePrintedHistoricalChoices(q,labor.text,roster,labor).find(v=>v.literalPrintedAlias);
 assert.equal(v.literalPrintedAlias,'Hauschilld');assert.equal(v.name,'Grant Hauschild');
 assert.throws(()=>resolvePrintedHistoricalChoices(q,labor.text,roster.map(m=>({...m,aliases:[]})),labor));
 assert.throws(()=>resolvePrintedHistoricalChoices(q,labor.text.replace('Grant Hauschild','Bob Hauschild'),roster,labor));
 assert.throws(()=>resolvePrintedHistoricalChoices(q,labor.text,[...roster,{...roster[0],membership_id:'other',aliases:['Hauschilld']}],labor));
 assert.throws(()=>resolvePrintedHistoricalChoices(q,labor.text,roster.map(m=>m.name==='Grant Hauschild'?{...m,ends_on:'2024-04-08'}:m),labor));
});
test('question keys use literal parliamentary question, not choice order or tally; complete evidence SHA still records changed observation',()=>{
 const before=extractReviewedCheckboxQuestions(tax.text,tax)[0],d=structuredClone(tax);d.reviewedCheckboxEvidence.tables[0].rows.reverse();const after=extractReviewedCheckboxQuestions(d.text,d)[0];
 assert.equal(before.questionKey,after.questionKey);assert.notEqual(before.fullQuestionPassageSha256,after.fullQuestionPassageSha256);
});
test('independent original byte authentication and reviewed artifact pin produce exact scope; any fresh source drift holds',async()=>{
 const o=await originals();assert.equal(o.docs.length,2);assert.equal(o.pins.expectedChoices,146);
 assert.equal(o.pins.reviewArtifactSha256,sha(readFileSync('tests/fixtures/senate-864-reviewed-rolls.json')));
 await assert.rejects(freshOriginals(async()=>html(),'reviewed',async()=>({contentSha256:'wrong'})));
 await assert.rejects(freshOriginals(async()=>html()+' changed','reviewed',pdf));
 assert.equal(f.heldOriginals.length,1);assert.match(JSON.stringify(f.heldOriginals),/1949/);
});
test('disposable PostgreSQL: add only fifteen questions/146 choices, preserve an unrelated row, exact readback and zero-write replay',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable PostgreSQL');
 const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));
 const {Pool}=await import('pg'),{randomUUID}=await import('node:crypto'),{SF1_INSERT_EVENT,SF1_INSERT_CHOICE}=await import('../src/evidence/senate-864-sf1-repair.ts');
 const admin=new Pool({connectionString:url,max:1}),schema='reviewed_'+randomUUID().replaceAll('-','');let pool;
 try{
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of ['jurisdictions','chambers','legislative_sessions','legislators','memberships','membership_source_aliases','bills','source_documents','vote_events','member_votes','votepredict_schema_migrations'])await admin.query('CREATE TABLE '+schema+'.'+table+' (LIKE public.'+table+' INCLUDING ALL)');
  await admin.query('INSERT INTO '+schema+'.votepredict_schema_migrations SELECT * FROM public.votepredict_schema_migrations');
  pool=new Pool({connectionString:url,max:1,options:'-c search_path='+schema+',public'});const one=async(sql,args=[])=>(await pool.query(sql,args)).rows[0];
  const j=(await one("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') RETURNING id")).id;
  const c=(await one("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') RETURNING id",[j])).id;
  const s=(await one("INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,'2023-2024','Fixture') RETURNING id",[j])).id;
  const members=[];
  for(const[i,m]of f.roster.entries()){
   const l=(await one('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id',[j,'reviewed-fixture-'+i,m.name])).id;
   const mid=(await one("INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,$4,'DFL','Senator',$5,$6) RETURNING id",[s,c,l,String(i+1),m.starts_on,m.ends_on])).id;members.push(mid);
   for(const alias of new Set(m.aliases||[]))await one("INSERT INTO membership_source_aliases(membership_id,source_system,source_name,normalized_name) VALUES($1,'explicit-historical-fixture',$2,lower($2))",[mid,alias]);
  }
  const ids=[];
  for(const d of f.sourceDocuments){
   const bill=(await one("INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,$3,'Fixture') RETURNING id",[s,c,d.committee==='Taxes'?'SF1811':'SF5266'])).id;
   const doc=(await one("INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata) VALUES($1,$2,$3,'senate_committee_minutes_pdf',$4,$5,200,$6::jsonb) RETURNING id",[j,s,c,d.url,d.sha256,JSON.stringify({meetingDate:d.date,...(d.allowNullStoredCommittee?{}:{committeeName:d.committee})})])).id;ids.push({doc,bill});
  }
  const sentinel=(await one(SF1_INSERT_EVENT,[s,c,ids[0].bill,ids[0].doc,'fixture:unrelated','motion','Unrelated earlier question',null,'2023-02-01',1,0,true,JSON.stringify({committeeVote:true,committeeName:'Unrelated',preserveSentinel:true})])).id;
  await one(SF1_INSERT_CHOICE,[sentinel,members[0],'Fixture printed member','fixture printed member','yea',null,JSON.stringify({preserveSentinel:true})]);
  const o=await originals(),target={database:parsed.pathname.slice(1),role:decodeURIComponent(parsed.username)},first=await runProduction(pool,target,o);
  assert.deepEqual([first.insertedEvents,first.insertedChoices,first.verifiedExact,first.verifiedChoices],[15,146,15,146]);assert.equal(first.existingEventIdsAndChoicesPreserved,true);
  assert.deepEqual([first.correctedClassifications,first.preservedExistingTargetEventIds],[0,0]);
  const metadata=(await pool.query("SELECT metadata,is_passage FROM vote_events WHERE external_key LIKE 'senate-committee-source-v1:%'")).rows;
  assert.equal(metadata.length,15);assert.ok(metadata.every(e=>e.is_passage===false&&e.metadata.modelWeight===0&&e.metadata.sameDayEligible===false&&e.metadata.finalPassageStanceInferred===false));
  assert.equal((await one("SELECT count(*)::int AS n FROM source_documents WHERE metadata->>'committeeName' IS NULL")).n,1);
  const replay=await runProduction(pool,target,o);assert.deepEqual([replay.insertedEvents,replay.insertedChoices],[0,0]);assert.equal(replay.zeroWriteReplay,true);
  assert.equal((await one('SELECT count(*)::int AS n FROM vote_events WHERE is_passage=true')).n,0);
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});

