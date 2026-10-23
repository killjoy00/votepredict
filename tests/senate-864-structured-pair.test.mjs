import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractPrintedCheckboxTables} from '../src/evidence/senate-864-printed-checkbox-tables.mjs';
import {extractRowRollQuestions,resolvePrintedHistoricalChoices,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {freshOriginals,correctionPlan,runProduction} from '../scripts/deploy-senate-864-population-row-rolls.mjs';
const f=JSON.parse(readFileSync('tests/fixtures/senate-864-structured-pair.json')),energy=f.sourceDocuments.find(d=>d.committee.startsWith('Energy'));
const originals=()=>freshOriginals(async url=>f.sourceDocuments.find(d=>d.clerkUrl===url).originalHtml,'structured',async({url})=>({contentSha256:f.sourceDocuments.find(d=>d.url===url).sha256}));
test('actual original HTML cells agree with every independently rendered PDF choice cell; blank is not an absence',()=>{
 const qs=extractPrintedCheckboxTables(energy.originalHtml,energy);assert.equal(qs.length,1);const q=qs[0];assert.equal(q.confidence,'source_proven_question');assert.deepEqual([q.yea,q.nay,q.passed,q.voteKind],[4,3,true,'motion']);assert.deepEqual(q.blankRows,[{printedCellName:'Andrew Mathews',choice:null}]);
 const g=f.rasterCheckboxPage.checkboxGrids;assert.equal(g.length,1);
 assert.deepEqual(g[0].rows[0].cells.map(c=>c.text),['SENATOR','YES','NO']);
 const cells=g[0].rows.slice(1,-1).map(r=>({name:r.cells[0].text.replace(/,.*$/,'').trim(),yes:r.cells[1].classification,no:r.cells[2].classification}));
 assert.ok(cells.every(c=>['x','blank'].includes(c.yes)&&['x','blank'].includes(c.no)));
 assert.deepEqual(cells.filter(c=>c.yes==='x'||c.no==='x').map(c=>[c.name,c.yes==='x'?'yea':'nay']),q.choices.map(c=>[c.printedCellName,c.choice]));
 assert.equal(cells.filter(c=>c.yes==='blank'&&c.no==='blank').length,1);
 const roster=f.roster.map((m,i)=>({...m,membership_id:'m'+i}));assert.equal(resolvePrintedHistoricalChoices(q,energy.text,roster,energy).length,7);
});
test('selected question, full grid, known marks, agreeing labeled tally and direct recommendation are all required',()=>{
 const html=energy.originalHtml,table=extractPrintedCheckboxTables(html,energy)[0].sourceTableHtml;
 const changes=[s=>s.replace('____X_____ Passage','_________ Passage'),s=>s.replace('4 Yes votes','3 Yes votes'),s=>s.replace('be recommended to pass.','be laid over.'),s=>s.replace('S.F. 3661, be recommended','S.F. 9999, be recommended'),s=>s.replace('Did Not Prevail ____________','Did Not Prevail _____yes_______'),s=>s.replace('<strong>YES</strong>','<strong>NO</strong>'),s=>s.replace(table,table.replace(/>\s*X\s*</,'> ? <')),s=>s.replace(table,table.replace('width:71px;height:22px;','width:71px;height:22px;" colspan="2')),s=>s.replace(table,table.replace(/<tr>[\s\S]*?Andrew Mathews[\s\S]*?<\/tr>/,'<tr></tr>'))];
 for(const mutate of changes){const altered=mutate(html);assert.notEqual(altered,html);assert.ok(!extractPrintedCheckboxTables(altered,energy).some(q=>q.confidence==='source_proven_question'));}
});
test('two exact independently authenticated sources prove two questions and eleven choices; all source drift holds',async()=>{
 const o=await originals();assert.equal(o.docs.length,2);assert.deepEqual(o.docs.map(d=>extractRowRollQuestions(d.text,d).filter(q=>q.confidence==='source_proven_question').length),[1,1]);
 assert.equal(o.docs.flatMap(d=>extractRowRollQuestions(d.text,d)).reduce((n,q)=>n+q.choices.length,0),11);
 await assert.rejects(freshOriginals(async()=>energy.originalHtml+' changed','structured',async()=>({contentSha256:'wrong'})));
 await assert.rejects(freshOriginals(async()=>energy.originalHtml.replace('4 Yes votes','3 Yes votes'),'structured',async({url})=>({contentSha256:f.sourceDocuments.find(d=>d.url===url).sha256})));
});
test('disposable PostgreSQL: add only two questions/eleven choices, preserve an unrelated row, exact readback and zero-write replay',async t=>{
 const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;if(!url)return t.skip('CI supplies disposable PostgreSQL');
 const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));
 const {Pool}=await import('pg'),{randomUUID}=await import('node:crypto'),{SF1_INSERT_EVENT,SF1_INSERT_CHOICE}=await import('../src/evidence/senate-864-sf1-repair.ts');
 const admin=new Pool({connectionString:url,max:1}),schema='structured_'+randomUUID().replaceAll('-','');let pool;
 try{
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of ['jurisdictions','chambers','legislative_sessions','legislators','memberships','membership_source_aliases','bills','source_documents','vote_events','member_votes','votepredict_schema_migrations'])await admin.query('CREATE TABLE '+schema+'.'+table+' (LIKE public.'+table+' INCLUDING ALL)');
  await admin.query('INSERT INTO '+schema+'.votepredict_schema_migrations SELECT * FROM public.votepredict_schema_migrations');
  pool=new Pool({connectionString:url,max:1,options:'-c search_path='+schema+',public'});const one=async(sql,args=[])=>(await pool.query(sql,args)).rows[0];
  const j=(await one("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') RETURNING id")).id;
  const c=(await one("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') RETURNING id",[j])).id;
  const s=(await one("INSERT INTO legislative_sessions(jurisdiction_id,slug,name) VALUES($1,'2021-2022','Fixture') RETURNING id",[j])).id;
  const members=[];
  for(const[i,m]of f.roster.entries()){
   const l=(await one('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id',[j,'structured-fixture-'+i,m.name])).id;
   const mid=(await one("INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,$4,'DFL','Senator',$5,$6) RETURNING id",[s,c,l,String(i+1),m.starts_on,m.ends_on])).id;members.push(mid);
  }
  const ids=[];
  for(const d of f.sourceDocuments){
   const bill=(await one("INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,$3,'Fixture') RETURNING id",[s,c,d.committee.startsWith('Energy')?'SF3661':'SF3882'])).id;
   const doc=(await one("INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata) VALUES($1,$2,$3,'senate_committee_minutes_pdf',$4,$5,200,$6::jsonb) RETURNING id",[j,s,c,d.url,d.sha256,JSON.stringify({meetingDate:d.date,committeeName:d.committee})])).id;ids.push({doc,bill});
  }
  const sentinel=(await one(SF1_INSERT_EVENT,[s,c,ids[0].bill,ids[0].doc,'fixture:unrelated','motion','Unrelated earlier question',null,'2022-02-01',1,0,true,JSON.stringify({committeeVote:true,committeeName:'Unrelated',preserveSentinel:true})])).id;
  await one(SF1_INSERT_CHOICE,[sentinel,members[0],'Fixture printed member','fixture printed member','yea',null,JSON.stringify({preserveSentinel:true})]);
  const o=await originals(),target={database:parsed.pathname.slice(1),role:decodeURIComponent(parsed.username)},first=await runProduction(pool,target,o);
  assert.deepEqual([first.insertedEvents,first.insertedChoices,first.verifiedExact,first.verifiedChoices],[2,11,2,11]);assert.equal(first.existingEventIdsAndChoicesPreserved,true);
  const replay=await runProduction(pool,target,o);assert.deepEqual([replay.insertedEvents,replay.insertedChoices],[0,0]);assert.equal(replay.zeroWriteReplay,true);
  assert.equal((await one('SELECT count(*)::int AS n FROM vote_events WHERE is_passage=true')).n,0);
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});
