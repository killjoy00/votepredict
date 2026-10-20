import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fixture,sha,validateOriginalQuestions,compareCommittee,financeMatches,compareFinance,financeFieldAccounting,compareMedia,assertSafeThreeReceipt,MEDIA_FRAGMENTS} from '../src/evidence/senate-864-three-bounded-evidence.mjs';
import {QUERIES,boundedSnapshot} from '../scripts/audit-senate-864-three-bounded-evidence.mjs';
const doc=()=>({...fixture().documents[1],sourceText:fixture().documents[1].motions.map(m=>m.literal).join(' ')});
test('fixed reviewed sources have 19 distinct questions / 211 printed names, no voice inference',()=>{
 const ds=fixture().documents;assert.equal(ds.length,4);assert.equal(ds.flatMap(d=>d.motions).length,19);assert.equal(ds.flatMap(d=>d.motions.flatMap(m=>m.choices)).length,211);
 for(const d of ds){for(const m of d.motions)for(const v of m.choices)assert.equal(d.people.filter(p=>p.toLowerCase().endsWith(v.token.toLowerCase())).length,1,'Every printed choice must have exactly one full name in the reviewed header');const t=d.motions.map(m=>m.literal).join(' ');assert.equal(validateOriginalQuestions({...d,extractedTextSha256:sha(t)},t),true);assert.throws(()=>validateOriginalQuestions(d,t));}
 const edu=ds[2].motions;assert.equal(edu.filter(m=>m.yea===13&&m.nay===0).length,3);assert.equal(edu.filter(m=>m.question.includes('A22')).length,0);assert.equal(edu.at(-1).question,'SF2255 recommendation to Taxes');
 assert.equal(ds[0].motions[1].question.includes('oral'),true);assert.equal(ds[3].motions[2].passed,false);
});
test('identical named slates and ordinal keys do not identify stored questions',()=>{
 const d=doc(),docs=[{id:'d',source_url:d.sourceUrl,content_sha256:d.originalRawPdfSha256}];
 const e={id:'e',source_document_id:'d',yea_count:5,nay_count:4,motion_text:'5/4 (Ayes: Hoffman, Rasmusson, Abeler, Gruenhagen, Utke; Nays: Fateh, Maye Quade, Mohamed, Wiklund)',external_key:'positional:0'};
 const result=compareCommittee(d,docs,[e],[],[]);assert.equal(result.sourceQuestions.some(q=>q.unambiguousStoredQuestion),false);
 e.motion_text=d.motions.map(m=>m.literal).join(' ');
 assert.equal(compareCommittee(d,docs,[e],[],[]).sourceQuestions.some(q=>q.unambiguousStoredQuestion),false);
 e.motion_text=d.motions[1].literal;
 const r=compareCommittee(d,docs,[e],[],[]);assert.equal(r.sourceQuestions[1].unambiguousStoredQuestion,true);assert.equal(r.sourceQuestions[0].unambiguousStoredQuestion,false);
});
test('finance containment requires all exact row comparators and proper family',()=>{
 const source=[{schedule:'PCF',date:'2024-10-01',party:'Example Fund',registration:'30000',cents:10000,unpaid:0,inKind:0,total:10000}];
 const r={subtype:'candidate_contribution_record',transactionDate:'2024-10-01',contributor:'Example Fund',contributorRegistrationNumber:'30000',receiptType:'Contribution',amount:100};
 assert.equal(financeMatches(source,r).length,1);
 for(const patch of [{amount:99},{transactionDate:'2024-10-02'},{contributor:'Example'},{contributorRegistrationNumber:'30001'},{subtype:'candidate_expenditure_record',vendorName:'Example Fund'}])assert.equal(financeMatches(source,{...r,...patch}).length,0);
 const copies=[{metadata:{...r,rowKey:'a'.repeat(64),asOfEligible:true}},{metadata:{...r,rowKey:'a'.repeat(64),asOfEligible:true}}];
 const counts=compareFinance(source,copies,[])[0];assert.equal(counts.storedEvidenceCopies,2);assert.equal(counts.canonicalTransactions,1);assert.equal(counts.exactPrintedRowMatches,1);assert.equal(counts.legacyEligibleCopies,2);
 assert.equal(r.availableOn,undefined);
});
test('at most 25 words from the bounded publisher article are retained; private rows are rejected',()=>{
 assert.ok(MEDIA_FRAGMENTS.join(' ').split(/\s+/).length<=25);
 for(const key of ['password','rowKey','contributor','vendorName','excerpt','membership_id','source_member_name'])assert.throws(()=>assertSafeThreeReceipt({[key]:'private'}));
 assert.throws(()=>assertSafeThreeReceipt({value:'postgresql://private'}));assert.doesNotThrow(()=>assertSafeThreeReceipt({namedChoices:211,noDatabaseWrites:true}));
});
test('every static source/data query is SELECT-only and bounded',()=>{
 assert.equal(QUERIES.length,10);
 for(const sql of QUERIES){assert.match(sql,/^SELECT /);assert.match(sql,/LIMIT \d+/);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|TRUNCATE|MERGE|GRANT)\b/i);}
});
test('RR READ ONLY identity failure and truncated reads still explicitly roll back',async()=>{
 for(const mode of ['bad-identity','truncated']){
  const calls=[];const client={query:async(sql)=>{calls.push(sql);if(sql.startsWith('SELECT current_database'))return {rows:[{db:'target',role:'role',ro:mode==='bad-identity'?'off':'on',isolation:'repeatable read'}]};if(sql.includes('FROM votepredict_schema_migrations'))return {rows:readdirSync('migrations').filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort().map(filename=>({filename,checksum:sha(readFileSync('migrations/'+filename))}))};if(sql===QUERIES[0])return {rows:Array.from({length:21},()=>({}))};return {rows:[]};}};
  await assert.rejects(()=>boundedSnapshot(client,{documents:[]},{database:'target',role:'role'}));
  assert.equal(calls[0],'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.some(s=>/^(?:INSERT|UPDATE|DELETE)/.test(s)),false);
 }
});
test('all ten actual SELECTs execute against the migrated schema and roll back',{skip:!process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL},async()=>{
 const {Pool}=await import('pg');const pool=new Pool({connectionString:process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL,max:1});
 try{const client=await pool.connect();try{
  const target=(await client.query('SELECT current_database() AS database,current_user AS role')).rows[0];
  const proof={documents:fixture().documents.map(d=>({...d,sourceText:''})),media:{pins:[{sha256:'a'.repeat(64),utc:'2022-10-05T01:59:37Z'}],verifiedVersions:2},finance:{report:{id:'16891:24:pcc:YE:0:0',sha:'e5d5d82d46ec7ac2c573c0cc4158541e06d2846e16573d748c0d052f7648b0a3',bytes:20822},rows:[]}};
  const result=await boundedSnapshot(client,proof,target);assert.equal(result.committee.length,4);assert.equal(result.media.fragments.length,3);assert.equal(result.finance.families.length,2);
  assert.equal((await client.query("SELECT current_setting('transaction_read_only') AS ro")).rows[0].ro,'off');
 }finally{client.release()}}finally{await pool.end()}
});

test('media copies need a single stable person, exact observation clock and non-serving flags',()=>{
 const pin={sha256:'b'.repeat(64),utc:'2022-10-05T01:59:37Z',sourceUrl:'https://publisher.invalid/article/'},source={pins:[pin],verifiedVersions:2};
 const roster=[{name:'Jeremy R. Miller',legislator_id:'stable-person'}],row={excerpt:MEDIA_FRAGMENTS[0],source_sha:pin.sha256,kind:'direct_statement',person_id:'stable-person',starts_on:'2021-01-01',ends_on:'2022-12-31',source_url:pin.sourceUrl,metadata:{archiveCapturedAt:pin.utc,modelWeight:0,mechanicallyActionable:false,sameDayEligible:false}};
 assert.equal(compareMedia(source,[row],roster)[0].verifiedStoredDirectStatementCopies,1);
 for(const patch of [{person_id:'other-person'},{kind:'context'},{metadata:{...row.metadata,archiveCapturedAt:'2021-11-08T00:00:00Z'}},{metadata:{...row.metadata,modelWeight:1}}])assert.equal(compareMedia(source,[{...row,...patch}],roster)[0].verifiedStoredDirectStatementCopies,0);
 assert.equal(compareMedia(source,[row],[...roster,{...roster[0],legislator_id:'ambiguous-person'}])[0].verifiedStoredDirectStatementCopies,0);
});

test('one printed finance row cannot certify two distinct canonical transactions',()=>{
 const source=[{schedule:'PCF',date:'2024-10-01',party:'Example Fund',registration:'30000',cents:10000,unpaid:0,inKind:0,total:10000}],m={subtype:'candidate_contribution_record',transactionDate:'2024-10-01',contributor:'Example Fund',contributorRegistrationNumber:'30000',receiptType:'Contribution',amount:100};
 const rows=['a','b'].map(k=>({metadata:{...m,rowKey:k.repeat(64)}}));
 const r=compareFinance(source,rows,[])[0];assert.equal(r.exactPrintedRowMatches,0);assert.equal(r.ambiguousPrintedRowMatches,2);assert.equal(r.uniquePrintedRowsMatched,0);
 const e={schedule:'CE',date:'2024-10-01',party:'Example Vendor',cents:10000,unpaid:0,inKind:0,total:10000,purpose:'Advertising: a printed ad'};
 const row={subtype:'candidate_expenditure_record',transactionDate:e.date,vendorName:e.party,amount:100,unpaidAmount:0,totalAmount:100,purpose:e.purpose,expenditureType:'General expenditure'};
 assert.equal(financeMatches([e],row).length,1);assert.equal(financeMatches([e],{...row,purpose:'another ad'}).length,0);assert.equal(financeMatches([e],{...row,expenditureType:'Noncampaign disbursement'}).length,0);
});

test('committee membership resolution is restricted to the hearing session',()=>{
 const d=doc(),m=d.motions[0],docs=[{id:'d',source_url:d.sourceUrl,content_sha256:d.originalRawPdfSha256}],event={id:'e',source_document_id:'d',motion_text:m.literal,yea_count:m.yea,nay_count:m.nay,passed:true,vote_kind:'amendment',is_passage:false};
 const people=d.people.map((name,i)=>({membership_id:'current-'+i,session_slug:'2025-2026',name,starts_on:'2021-01-01',ends_on:'2026-12-31'}));
 const older=people.map(p=>({...p,membership_id:p.membership_id.replace('current','old'),session_slug:'2023-2024'}));
 const choices=m.choices.map(v=>({vote_event_id:'e',choice:v.choice,membership_id:people.find(p=>p.name.endsWith(v.token)).membership_id}));
 const result=compareCommittee(d,docs,[event],choices,[...people,...older]);assert.equal(result.sourceQuestions[0].unresolvedFullIdentities,0);assert.equal(result.sourceQuestions[0].storedChoiceMatches,9);
});
test('finance diagnostics distinguish missing metadata, case-only types and real purpose differences',()=>{
 const s={schedule:'CE',date:'2024-10-01',party:'Example Vendor',cents:10000,unpaid:0,inKind:0,total:10000,purpose:'Advertising: a printed ad'},r={subtype:'candidate_expenditure_record',transactionDate:s.date,vendorName:s.party,amount:100,unpaidAmount:0,totalAmount:100,purpose:s.purpose,expenditureType:'GENERAL EXPENDITURE'};
 assert.equal(financeMatches([s],r).length,1);assert.equal(financeFieldAccounting([s],[r]).caseOrSpacingOnlyTypeDifference,1);
 const missing={...r};delete missing.unpaidAmount;delete missing.totalAmount;assert.equal(financeMatches([s],missing).length,0);
 const counts=financeFieldAccounting([s],[missing]);assert.equal(counts.missingUnpaid,1);assert.equal(counts.missingTotal,1);assert.equal(counts.fullPurpose,1);assert.equal(counts.unpaidAndTotal,0);
});

test('source question anchors additionally use compatible bill/tally, never ordinal labels',()=>{
 const d={...fixture().documents[3],sourceText:''},docs=[{id:'d',source_url:d.sourceUrl,content_sha256:d.originalRawPdfSha256}],e={id:'e',source_document_id:'d',bill_identifier:'SF2669',yea_count:5,nay_count:4,motion_text:d.motions.slice(0,2).map(m=>m.literal).join(' ')};
 let r=compareCommittee(d,docs,[e],[],[]);assert.equal(r.sourceQuestions[0].unambiguousStoredQuestion,false);assert.equal(r.sourceQuestions[1].unambiguousStoredQuestion,true);
 r=compareCommittee(d,docs,[{...e,bill_identifier:null}],[],[]);assert.equal(r.sourceQuestions.some(q=>q.unambiguousStoredQuestion),false);
 r=compareCommittee(d,docs,[{...e,bill_identifier:'SF9999'}],[],[]);assert.equal(r.sourceQuestions.some(q=>q.unambiguousStoredQuestion),false);
});
test('a missing computed total may be derived from paid and explicitly stored unpaid, never assumed zero',()=>{
 const s={schedule:'CE',date:'2024-10-01',party:'Example Vendor',cents:10000,unpaid:500,inKind:0,total:10500,purpose:'Advertising'},r={subtype:'candidate_expenditure_record',transactionDate:s.date,vendorName:s.party,amount:100,unpaidAmount:5,purpose:s.purpose,expenditureType:'General expenditure'};
 assert.equal(financeMatches([s],r).length,1);assert.equal(financeMatches([s],{...r,totalAmount:100}).length,0);
});
