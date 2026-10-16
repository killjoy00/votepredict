import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {
  parseSenateBillAuthorXml,parseSenateJournalAuthorChanges,
} from '../src/operations/senate-bill-author-parser.js';
import {
  persistOfficialAuthorCapture,type AuthorBill,type AuthorCapture,
} from '../src/operations/senate-bill-authors.js';
import {resolveSenator,type SenateMember} from '../src/operations/senate-identity-bill-resolvers.js';

const specimen=[
  '<BILL><FILE_TYPE>SF</FILE_TYPE><FILE_NUMBER>7991</FILE_NUMBER>',
  '<AUTHORS><SENATE>',
  '<AUTHOR><MEMBER_NAME>Erin Rawtest</MEMBER_NAME></AUTHOR>',
  '<AUTHOR><MEMBER_NAME>Maye Quade</MEMBER_NAME></AUTHOR>',
  '</SENATE></AUTHORS>',
  '<ACTIONS><SENATE>',
  '<ACTION><ACTION_DATE>2025-03-04 00:00:00</ACTION_DATE>',
  '<ACTION_TEXT>Author added</ACTION_TEXT><ACTION_DESCRIPTION>Maye Quade</ACTION_DESCRIPTION></ACTION>',
  '<ACTION><ACTION_DATE>2025-04-01 00:00:00</ACTION_DATE>',
  '<ACTION_TEXT>Author stricken</ACTION_TEXT><ACTION_DESCRIPTION>Smith</ACTION_DESCRIPTION></ACTION>',
  '</SENATE></ACTIONS></BILL>',
].join('');
test('trimmed Revisor XML: chief, coauthor order, dated changes and absent dates',()=>{
  assert.deepEqual(parseSenateBillAuthorXml(specimen,'SF7991'),[
    {nameRaw:'Erin Rawtest',role:'chief',authorOrder:1,addedOn:null,removedOn:null},
    {nameRaw:'Maye Quade',role:'coauthor',authorOrder:2,addedOn:'2025-03-04',removedOn:null},
    {nameRaw:'Smith',role:'other',authorOrder:null,addedOn:null,removedOn:'2025-04-01'},
  ]);
  const missing='<BILL><AUTHORS><SENATE><AUTHOR><MEMBER_NAME>First</MEMBER_NAME></AUTHOR></SENATE></AUTHORS></BILL>';
  assert.deepEqual(parseSenateBillAuthorXml(missing,'SF3'),[
    {nameRaw:'First',role:'chief',authorOrder:1,addedOn:null,removedOn:null},
  ]);
  const explicit='<BILL><AUTHORS><HOUSE><AUTHOR><AUTHOR_ROLE>coauthor</AUTHOR_ROLE><AUTHOR_NAME>A</AUTHOR_NAME></AUTHOR></HOUSE></AUTHORS></BILL>';
  assert.equal(parseSenateBillAuthorXml(explicit,'HF8')[0].role,'coauthor');
});
test('stored Senate journal: only prevailing named author motions become rows',()=>{
  const journal=[
    'Senator Lang moved that the names of Senators Bahr and Hoffman be added as co-authors to S.F. No. 821. The motion prevailed.',
    'Senator Boldon moved that the name of Senator Oumou Verbeten be added as a co-author to S.F. No. 983. The motion prevailed.',
    'Senator Bahr moved that his name be stricken as a co-author to S.F. No. 1464. The motion prevailed.',
    'Senator Test moved that the name of Senator Someone be added as a co-author to S.F. No. 10. The motion did not prevail.',
    'Senator Robin Smith was added as a co-author to S.F. No. 120.',
    'Senator John Doe was stricken as chief author from S.F. No. 121.',
  ].join('\n');
  assert.deepEqual(parseSenateJournalAuthorChanges(journal),[
    {billIdentifier:'SF821',nameRaw:'Bahr',operation:'add',role:'coauthor'},
    {billIdentifier:'SF821',nameRaw:'Hoffman',operation:'add',role:'coauthor'},
    {billIdentifier:'SF983',nameRaw:'Oumou Verbeten',operation:'add',role:'coauthor'},
    {billIdentifier:'SF1464',nameRaw:'Bahr',operation:'strike',role:'coauthor'},
    {billIdentifier:'SF120',nameRaw:'Robin Smith',operation:'add',role:'coauthor'},
    {billIdentifier:'SF121',nameRaw:'John Doe',operation:'strike',role:'chief'},
  ]);
});
test('shared resolver leaves ambiguous names unresolved',()=>{
  const roster:SenateMember[]=[
    {id:'one',sessionSlug:'2025-2026',name:'Erin Rawtest',district:'9'},
    {id:'two',sessionSlug:'2025-2026',name:'Jane Smith',district:'1'},
    {id:'three',sessionSlug:'2025-2026',name:'John Smith',district:'2'},
  ];
  assert.equal(resolveSenator({printedName:'Erin Rawtest',sessionSlug:'2025-2026'},roster).membershipId,'one');
  assert.equal(resolveSenator({printedName:'Smith',sessionSlug:'2025-2026'},roster).membershipId,null);
});
test('0024 additive and guarded production uses independent-main, protected environment, no schedule',()=>{
  const migration=readFileSync('migrations/0024_senate_bill_authors.sql','utf8');
  const runner=readFileSync('scripts/deploy-senate-bill-authors-neon.ts','utf8');
  const workflow=readFileSync('.github/workflows/senate-bill-authors-production.yml','utf8');
  assert.match(migration,/senate_bill_author_snapshots/);
  assert.match(migration,/senate_bill_author_scans/);
  assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE|DELETE)\b/i);
  assert.match(runner,/filenames.length!==24/);
  assert.match(runner,/SENATE_BILL_AUTHORS_PRODUCTION/);
  assert.match(workflow,/environment: evidence-readonly-sandbox/);
  assert.match(workflow,/needs.independent-main.result == 'success'/);
  assert.doesNotMatch(workflow,/schedule:|cron:/);
});

const url=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local=!!url&&['localhost','127.0.0.1'].includes(new URL(url).hostname);
test('disposable Postgres: snapshots, linked senator and House-only names replay twice',
  {skip:!local,timeout:60_000},async()=>{
  const pool=new Pool({connectionString:url!,max:2});
  const client=await pool.connect();
  let bill:AuthorBill,house:AuthorBill,memberId:string;
  const fixture=['SF7991','HF7992'];
  const clean=async()=>{
    const old=await client.query<{id:string}>(
      "SELECT b.id FROM bills b JOIN legislative_sessions s ON s.id=b.session_id "+
      "WHERE s.slug='2025-2026' AND b.identifier=ANY($1::text[])",[fixture]);
    for(const {id} of old.rows){
      await client.query('DELETE FROM senate_bill_author_scans WHERE bill_id=$1',[id]);
      await client.query('DELETE FROM senate_bill_authors WHERE bill_id=$1',[id]);
      await client.query('DELETE FROM senate_bill_author_snapshots WHERE bill_id=$1',[id]);
      await client.query('DELETE FROM bill_companions WHERE senate_bill_id=$1 OR house_bill_id=$1',[id]);
      await client.query('DELETE FROM bills WHERE id=$1',[id]);
    }
    const oldMembers=await client.query<{id:string;legislator_id:string}>(
      "SELECT m.id,m.legislator_id FROM memberships m JOIN legislators l ON l.id=m.legislator_id "+
      "WHERE l.external_key='test-raw-author-link-7991'");
    for(const row of oldMembers.rows){
      await client.query('DELETE FROM memberships WHERE id=$1',[row.id]);
      await client.query('DELETE FROM legislators WHERE id=$1',[row.legislator_id]);
    }
  };
  try{
    const juris=(await client.query<{id:string}>(
      "INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') "+
      "ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id")).rows[0].id;
    const chambers:Record<string,string>={};
    for(const slug of ['senate','house']){
      chambers[slug]=(await client.query<{id:string}>(
        "INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,$2,$3,$4) "+
        "ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [juris,slug,slug,slug==='senate'?'upper':'lower'])).rows[0].id;
    }
    const sessionId=(await client.query<{id:string}>(
      "INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) "+
      "VALUES($1,'2025-2026','2025-2026','2025-01-01','2026-12-31') "+
      "ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      [juris])).rows[0].id;
    await clean();
    const legislatorId=(await client.query<{id:string}>(
      "INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) "+
      "VALUES($1,'test-raw-author-link-7991','Erin Rawtest','erin rawtest') RETURNING id",
      [juris])).rows[0].id;
    memberId=(await client.query<{id:string}>(
      "INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title) "+
      "VALUES($1,$2,$3,'9','DFL','Senator') RETURNING id",
      [sessionId,chambers.senate,legislatorId])).rows[0].id;
    const insert=async(identifier:string,chamber:'senate'|'house'):Promise<AuthorBill>=>{
      const id=(await client.query<{id:string}>(
        "INSERT INTO bills(session_id,originating_chamber_id,identifier,title) "+
        "VALUES($1,$2,$3,'raw-authorship test') RETURNING id",
        [sessionId,chambers[chamber],identifier])).rows[0].id;
      return {bill_id:id,session_id:sessionId,session_slug:'2025-2026',identifier,chamber};
    };
    bill=await insert('SF7991','senate');
    house=await insert('HF7992','house');
    await client.query(
      "INSERT INTO bill_companions(senate_bill_id,house_bill_id,session_id,source_url,fetched_at) "+
      "VALUES ($1,$2,$3,'https://example.org/bill',now())",
      [bill.bill_id,house.bill_id,sessionId]);
    const roster:SenateMember[]=[{id:memberId,sessionSlug:'2025-2026',
      name:'Erin Rawtest',district:'9'}];
    const capture:AuthorCapture={url:'https://api.revisor.mn.gov/bills/v1/94/2025/0/SF/7991/',
      fetchedAt:new Date().toISOString(),httpStatus:200,rawXml:specimen,result:'success'};
    await persistOfficialAuthorCapture(client,bill,capture,roster);
    await persistOfficialAuthorCapture(client,bill,capture,roster);
    const houseXml=specimen.replace('SF</FILE_TYPE>','HF</FILE_TYPE>')
      .replace('7991</FILE_NUMBER>','7992</FILE_NUMBER>')
      .replaceAll('SENATE','HOUSE');
    await persistOfficialAuthorCapture(client,house,{...capture,rawXml:houseXml},roster);
    await persistOfficialAuthorCapture(client,house,{...capture,rawXml:houseXml},roster);
    const result=(await client.query<{
      authors:number;snapshots:number;chief_linked:number;house_links:number;attempts:number;
    }>(
      "SELECT "+
      "(SELECT count(*)::int FROM senate_bill_authors WHERE bill_id=ANY($1::uuid[])) AS authors,"+
      "(SELECT count(*)::int FROM senate_bill_author_snapshots WHERE bill_id=ANY($1::uuid[])) AS snapshots,"+
      "(SELECT count(*)::int FROM senate_bill_authors WHERE bill_id=$2 AND membership_id=$3 AND role='chief') AS chief_linked,"+
      "(SELECT count(*)::int FROM senate_bill_authors WHERE bill_id=$4 AND membership_id IS NOT NULL) AS house_links,"+
      "(SELECT attempts FROM senate_bill_author_scans WHERE bill_id=$2) AS attempts",
      [[bill.bill_id,house.bill_id],bill.bill_id,memberId,house.bill_id])).rows[0];
    assert.equal(result.authors,6);
    assert.equal(result.snapshots,2);
    assert.equal(result.chief_linked,1);
    assert.equal(result.house_links,0);
    assert.equal(result.attempts,2);
  }finally{
    try{await clean();}finally{client.release(true);await pool.end();}
  }
});
