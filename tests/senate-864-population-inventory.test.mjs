import test from 'node:test';
import assert from 'node:assert/strict';
import {DOC_SQL,supplemental,summarize} from '../scripts/inventory-senate-864-population.mjs';
test('supplementary registry has 28 exact official original identities scoped to 2022–25',()=>{
 const docs=supplemental();assert.equal(docs.length,28);assert.equal(new Set(docs.map(d=>d.source_url+'|'+d.content_sha256)).size,28);
 assert.ok(docs.every(d=>/^202[2-5]-\d\d-\d\d$/.test(d.date)&&/^https:\/\/www\.lrl\.mn\.gov\/archive\/minutes\/senate\//.test(d.source_url)&&/^[a-f0-9]{64}$/.test(d.content_sha256)));
});
test('population metrics preserve distinct source, question, choice and production denominators',()=>{
 const rows=[{date:'2023-02-07',committee:'Elections',format:'html',readable:true,status:'named_candidate_original',detectorCandidates:3,detectorChoiceOccurrences:42}];
 const question={date:'2023-02-07',committee:'Elections',choices:14,production:{status:'different_source_identity',alternateSourceParityVerified:true}};
 const state={events:[{id:'a',occurred_on:'2023-02-07'}],choices:[{vote_event_id:'a'},{vote_event_id:'a'}]};
 const r=summarize(rows,[question],state),year=r.byYear.find(r=>r.year===2023);
 assert.equal(year.originals,1);assert.equal(year.detectorCandidateOccurrences,3);assert.equal(year.strictDistinctQuestions,1);assert.equal(year.correctlyRepresentedChoices,14);assert.equal(year.alternateSourceVerified,1);assert.equal(year.questionOrIdentityHolds,0);
 assert.deepEqual(r.storedByYear.find(r=>r.year===2023),{year:2023,storedEvents:1,storedExplicitChoices:2});
 question.production.alternateSourceParityVerified=false;assert.equal(summarize(rows,[question],state).byYear.find(r=>r.year===2023).questionOrIdentityHolds,1);
});
test('population document SQL compiles against disposable Postgres',async t=>{
 if(!process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL)return t.skip('CI supplies disposable database');
 const {Pool}=await import('pg'),pool=new Pool({connectionString:process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,max:1});
 try{await pool.query('EXPLAIN '+DOC_SQL);}finally{await pool.end();}
});
