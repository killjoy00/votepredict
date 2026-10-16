import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {Pool} from 'pg';
import {runSenateRawIdentityBillBackfill} from '../src/operations/senate-identity-bill-backfill.js';
import {senateLinkReadback} from '../src/operations/senate-identity-bill-report.js';

const connection=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local=!!connection && ['localhost','127.0.0.1'].includes(new URL(connection).hostname);

test('Postgres: additive Senate raw crosswalk SQL writes only raw link columns and edge tables',
  {skip:!local,timeout:80_000},async()=>{
  const pool=new Pool({connectionString:connection!,max:3});
  const token=randomUUID().replaceAll('-','');
  const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
  const surname='Maye Quade Example'+token.slice(0,12);
  const senatorName='Erin '+surname;
  const printedName='Sen. '+surname;
  const client=await pool.connect();
  let statementId:string,billId:string,memberId:string,witnessId:string,docId:string,questionnaireId:string;
  try{
    const jurisdiction=(await client.query<{id:string}>(
      "INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') "+
      "ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id")).rows[0].id;
    const senate=(await client.query<{id:string}>(
      "INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Minnesota Senate','upper') "+
      "ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      [jurisdiction])).rows[0].id;
    const sessions:Record<string,string>={};
    for(const slug of ['2021-2022','2023-2024','2025-2026']){
      sessions[slug]=(await client.query<{id:string}>(
        "INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) "+
        "VALUES($1,$2,$3,$4::date,$5::date) ON CONFLICT(jurisdiction_id,slug) DO UPDATE "+
        "SET name=EXCLUDED.name RETURNING id",
        [jurisdiction,slug,slug,slug.slice(0,4)+'-01-01',slug.slice(5)+'-12-31'])).rows[0].id;
      for(let n=1;n<=43;n++){
        const name=slug==='2025-2026'&&n===1?senatorName:('Example '+slug+' Senator '+n);
        const legislator=(await client.query<{id:string}>(
          'INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,$4) RETURNING id',
          [jurisdiction,'test-senate-link:'+token+':'+slug+':'+n,name,name.toLowerCase()])).rows[0].id;
        const member=(await client.query<{id:string}>(
          "INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title) "+
          "VALUES($1,$2,$3,$4,'DFL','Senator') RETURNING id",
          [sessions[slug],senate,legislator,String(n)])).rows[0].id;
        if(slug==='2025-2026'&&n===1)memberId=member;
      }
    }
    billId=(await client.query<{id:string}>(
      "INSERT INTO bills(session_id,originating_chamber_id,identifier,title) "+
      "VALUES($1,$2,'SF1434','Raw linking fixture') "+
      "ON CONFLICT(session_id,identifier) DO UPDATE SET title=EXCLUDED.title RETURNING id",
      [sessions['2025-2026'],senate])).rows[0].id;
    statementId=(await client.query<{id:string}>(
      "INSERT INTO senate_raw_statements(source_id,source_type,source_url,fetched_at,published_on,"+
      "title,named_senators,bill_identifiers,raw_text) "+
      "VALUES('test','official',$1,now(),'2025-05-01','Sen. Maye Quade press statement',"+
      "ARRAY[$2::text],ARRAY['S.F. No. 1434'],'Senate raw source content') RETURNING id",
      ['https://www.senate.mn/test/raw-link/'+token,printedName])).rows[0].id;
    witnessId=(await client.query<{id:string}>(
      "INSERT INTO senate_committee_testimony_raw(session_id,hearing_id,record_key,source_type,source_url,"+
      "fetched_at,hearing_date,source_content_type,raw_content,committee,bill_identifier,witness_name,organization) "+
      "VALUES($1,10,$2,'witness',$3,now(),'2025-05-01','text/plain','Sen. Maye Quade',"+
      "'Health','SF1434',$4,'Minnesota Senate') RETURNING id",
      [sessions['2025-2026'],token,'https://www.senate.mn/test/testimony/'+token,printedName])).rows[0].id;
    docId=(await client.query<{id:string}>(
      "INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,metadata) "+
      "VALUES($1,$2,$3,'senate_committee_minutes_html',$4,$5,jsonb_build_object('rawPrepassageVotes',$6::jsonb)) RETURNING id",
      [jurisdiction,sessions['2025-2026'],senate,'https://www.senate.mn/test/minutes/'+token,sha(token),
        JSON.stringify({sessionSlug:'2025-2026',sourceDate:'2025-05-01',fetchedAt:new Date().toISOString(),
          sourceType:'mn_senate_committee_minutes_html',
          text:'S.F. No. 1434 was laid over for possible inclusion.\nSF1434 incorporated into HF2563.',
          records:[{ordinal:1,mover:printedName,billIdentifier:'SF1434',
            memberVotes:[{name:'Sen. '+senatorName,choice:'yea'}]}]})])).rows[0].id;
    questionnaireId=(await client.query<{id:string}>(
      "INSERT INTO mn_senate_questionnaire_captures(source_id,publisher,source_kind,source_url,"+
      "questionnaire_title,election_cycle,candidate_name,district,fetched_at,content_type,content_sha256,raw_content) "+
      "VALUES('test','publisher','publisher_response',$1,'Senate questions',2026,$3,'1',"+
      "now(),'text/plain',$2,'Q: Test? A: Answer.') RETURNING id",
      ['https://example.org/test/questionnaire/'+token,sha('questionnaire'+token),senatorName])).rows[0].id;
  }finally{client.release();}
  try{
    const before=(await pool.query<{raw_text:string}>(
      'SELECT raw_text FROM senate_raw_statements WHERE id=$1',[statementId!])).rows[0].raw_text;
    const output=await runSenateRawIdentityBillBackfill(pool);
    assert.ok(output.statements.scanned>=1);
    assert.ok(output.rawVotes.members>=2);
    assert.ok(output.questionnaires.scanned>=1);
    const stmt=(await pool.query<{membership_id:string;bill_id:string;membership_match_method:string;bill_match_method:string;raw_text:string}>(
      'SELECT membership_id,bill_id,membership_match_method,bill_match_method,raw_text FROM senate_raw_statements WHERE id=$1',
      [statementId!])).rows[0];
    assert.equal(stmt.membership_id,memberId!);
    assert.equal(stmt.bill_id,billId!);
    assert.equal(stmt.membership_match_method,'surname_unique_in_session');
    assert.equal(stmt.bill_match_method,'normalized');
    assert.equal(stmt.raw_text,before);
    const witness=(await pool.query<{membership_id:string;bill_id:string}>(
      'SELECT membership_id,bill_id FROM senate_committee_testimony_raw WHERE id=$1',
      [witnessId!])).rows[0];
    assert.equal(witness.membership_id,memberId!);
    assert.equal(witness.bill_id,billId!);
    const q=(await pool.query<{membership_id:string}>(
      'SELECT membership_id FROM mn_senate_questionnaire_captures WHERE id=$1',[questionnaireId!])).rows[0];
    assert.equal(q.membership_id,memberId!);
    const raw=(await pool.query<{person:number;bill:number;inclusions:number}>(
      "SELECT (SELECT count(*)::int FROM senate_raw_vote_member_mentions WHERE source_document_id=$1) AS person,"+
      "(SELECT count(*)::int FROM senate_raw_vote_bill_mentions WHERE source_document_id=$1) AS bill,"+
      "(SELECT count(*)::int FROM bill_inclusion_mentions WHERE source_document_id=$1) AS inclusions",
      [docId!])).rows[0];
    assert.equal(raw.person,2);assert.equal(raw.bill,1);assert.equal(raw.inclusions,2);
    const report=await senateLinkReadback(pool);
    assert.ok(report.byTableAndSession.some(x=>x.table==='mn_senate_questionnaire_captures'));
    // Re-running is idempotent: the number of unique raw printed edges is stable.
    await runSenateRawIdentityBillBackfill(pool);
    const again=(await pool.query<{persons:number;inclusions:number}>(
      "SELECT (SELECT count(*)::int FROM senate_raw_vote_member_mentions WHERE source_document_id=$1) AS persons,"+
      "(SELECT count(*)::int FROM bill_inclusion_mentions WHERE source_document_id=$1) AS inclusions",
      [docId!])).rows[0];
    assert.equal(again.persons,2);assert.equal(again.inclusions,2);
  }finally{await pool.end();}
});
