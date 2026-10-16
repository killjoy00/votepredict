/**
 * Bounded, idempotent Senate RAW crosswalks only.
 * Does not update forecasts, features, serving, member_votes, vote_events, or source text.
 */
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  normalizePrintedSenatorName, resolveSenator, resolveBill,
  senateSessionForDate, senateServiceSessionForElection, extractBillInclusionMentions,
  type SenateMember, type SessionBill,
} from './senate-identity-bill-resolvers.js';

const SESSIONS = ['2021-2022','2023-2024','2025-2026'] as const;
const MAX_STATEMENTS = 25000;
const MAX_TESTIMONY = 100000;
const MAX_ELECTIONS = 15000;
const MAX_VOTE_DOCUMENTS = 20000;
const CHUNK = 350;

interface Catalog {
  sessions: Map<string,string>;
  roster: SenateMember[];
  bills: SessionBill[];
  memberById: Map<string,SenateMember>;
}
interface LinkTally { scanned:number; memberEdges:number; billEdges:number; inclusionEdges:number; aliasesLearned:number }
interface Statement {
  id:string; source_url:string; published_on:string|null;
  named_senators:string[]; bill_identifiers:string[];
}
interface Testimony {
  id:string; session_slug:string; source_type:string; witness_name:string|null;
  organization:string|null; bill_identifier:string|null; bill_id:string|null;
  membership_id:string|null; source_url:string; hearing_date:string;
}
interface Election {
  id:string; election_date:string; election_type:string;
  district:string; candidate_name:string; source_url:string;
  membership_id:string|null;
}
interface RawDocument {
  id:string; source_url:string; fetched_at:string; raw: {
    sessionSlug?:unknown;sourceDate?:unknown;fetchedAt?:unknown;
    text?:unknown;records?:unknown;
  };
}
interface RawVote {
  ordinal?:unknown; mover?:unknown; billIdentifier?:unknown;
  memberVotes?:unknown;
}
function asString(value:unknown):string|null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function isWithin(date:string|null):boolean {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
}
function yearFromPublishedUrl(url:string):string|null {
  // A year in a URL segment may be a stable publisher-supplied date;
  // fetch timestamp is NEVER substituted for publication date.
  const path=new URL(url).pathname;
  const years=[...path.matchAll(/(?:^|\/)(202[1-6])(?:\/|$)/g)].map(m=>Number(m[1]));
  return years.length === 1 ? String(years[0])+'-01-01' : null;
}
function sourceSession(published:string|null,url:string):string|null {
  return senateSessionForDate(published ?? yearFromPublishedUrl(url));
}
function memberIdsUnique(rows: readonly {membership_id:string|null}[]):string|null {
  const ids=new Set(rows.map(r=>r.membership_id).filter((id):id is string=>!!id));
  return ids.size===1 ? [...ids][0] : null;
}
function billIdsUnique(rows:readonly {bill_id:string|null}[]):string|null {
  const ids=new Set(rows.map(r=>r.bill_id).filter((id):id is string=>!!id));
  return ids.size===1 ? [...ids][0] : null;
}
async function bulk(
  client:PoolClient, table:string, columns:string[], definitions:string,
  rows:Record<string,unknown>[], clause:string,
):Promise<void> {
  if (!rows.length) return;
  const sql='INSERT INTO '+table+' ('+columns.join(',')+') SELECT '
    +columns.map(c=>'v.'+c).join(',')+' FROM jsonb_to_recordset($1::jsonb) AS v('
    +definitions+') '+clause;
  for(let i=0;i<rows.length;i+=CHUNK) {
    await client.query(sql,[JSON.stringify(rows.slice(i,i+CHUNK))]);
  }
}
async function updateRows(
  client:PoolClient, sql:string, rows:Record<string,unknown>[],
):Promise<void> {
  for(let i=0;i<rows.length;i+=CHUNK)
    await client.query(sql,[JSON.stringify(rows.slice(i,i+CHUNK))]);
}
async function catalog(client:PoolClient):Promise<Catalog>{
  const sessions=await client.query<{slug:string;id:string}>(
    "SELECT s.slug,s.id FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id "+
    "WHERE j.slug='us-mn' AND s.slug=ANY($1::text[])",[SESSIONS]);
  const ids=new Map(sessions.rows.map(row=>[row.slug,row.id]));
  if(ids.size!==3) throw Error('Missing existing Minnesota 2021-2026 sessions');

  const people=await client.query<{
    id:string;session_slug:string;name:string;district:string;
    starts_on:string|null;ends_on:string|null;aliases:string[];
  }>(
    "SELECT m.id,s.slug AS session_slug,l.name,m.district,m.starts_on::text,m.ends_on::text,"+
    "coalesce(array_agg(DISTINCT a.source_name) FILTER (WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases "+
    "FROM memberships m JOIN legislative_sessions s ON s.id=m.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate' "+
    "JOIN legislators l ON l.id=m.legislator_id "+
    "LEFT JOIN membership_source_aliases a ON a.membership_id=m.id "+
    "WHERE s.slug=ANY($1::text[]) GROUP BY m.id,s.slug,l.name,m.district,m.starts_on,m.ends_on",
    [SESSIONS],
  );
  const roster=people.rows.map(p=>({
    id:p.id,sessionSlug:p.session_slug,name:p.name,district:p.district,
    startsOn:p.starts_on,endsOn:p.ends_on,aliases:p.aliases,
  }));
  for(const slug of SESSIONS)
    if(roster.filter(m=>m.sessionSlug===slug).length<40)
      throw Error('Insufficient existing Senate memberships: '+slug);

  const b=await client.query<{id:string;session_slug:string;identifier:string}>(
    "SELECT b.id,s.slug AS session_slug,b.identifier FROM bills b "+
    "JOIN legislative_sessions s ON s.id=b.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "WHERE s.slug=ANY($1::text[])",[SESSIONS]);
  const bills=b.rows.map(row=>({id:row.id,sessionSlug:row.session_slug,identifier:row.identifier}));
  return {sessions:ids,roster,bills,memberById:new Map(roster.map(m=>[m.id,m]))};
}
class AliasBuffer {
  private pending=new Map<string,Record<string,unknown>>();
  add(result:{membershipId:string|null;matchMethod:string},printed:string,sourceSystem:string,url:string,cat:Catalog):void{
    if(!result.membershipId || result.matchMethod==='unresolved')return;
    const canonical=cat.memberById.get(result.membershipId);
    const normalized=normalizePrintedSenatorName(printed);
    if(!canonical||!normalized||normalized===normalizePrintedSenatorName(canonical.name))return;
    const key=[result.membershipId,sourceSystem,normalized].join('|');
    if(!this.pending.has(key))this.pending.set(key,{
      membership_id:result.membershipId,source_system:sourceSystem,
      source_name:printed,normalized_name:normalized,source_url:url,
    });
  }
  async flush(client:PoolClient):Promise<number>{
    const values=[...this.pending.values()];
    await bulk(client,'membership_source_aliases',
      ['membership_id','source_system','source_name','normalized_name','source_url'],
      'membership_id uuid,source_system text,source_name text,normalized_name text,source_url text',
      values,'ON CONFLICT (membership_id,source_system,normalized_name) DO NOTHING');
    this.pending.clear();
    return values.length;
  }
}
async function statements(client:PoolClient,cat:Catalog,aliases:AliasBuffer,tally:LinkTally):Promise<void>{
  let cursor='';
  while(tally.scanned<MAX_STATEMENTS) {
    const q=await client.query<Statement>(
      "SELECT id,source_url,published_on::text,named_senators,bill_identifiers FROM senate_raw_statements "+
      "WHERE ($1::text='' OR id>NULLIF($1,'')::uuid) ORDER BY id LIMIT $2",
      [cursor,Math.min(250,MAX_STATEMENTS-tally.scanned)]);
    if(!q.rows.length)break;
    const memberRows:Record<string,unknown>[]=[];
    const billRows:Record<string,unknown>[]=[];
    const parentRows:Record<string,unknown>[]=[];
    for(const row of q.rows){
      const slug=sourceSession(row.published_on,row.source_url);
      const memberMentions:( {membership_id:string|null;match_method:string})[]=[];
      const billMentions:({bill_id:string|null;match_method:string})[]=[];
      for(const [index,name] of (row.named_senators??[]).entries()){
        const result=resolveSenator({printedName:name,sessionSlug:slug??''},cat.roster);
        memberRows.push({
          statement_id:row.id,source_ordinal:index,printed_name:name,
          membership_id:result.membershipId,match_method:result.matchMethod,
        });
        memberMentions.push({membership_id:result.membershipId,match_method:result.matchMethod});
        aliases.add(result,name,'senate_raw_statements',row.source_url,cat);
      }
      for(const [index,value] of (row.bill_identifiers??[]).entries()){
        const result=resolveBill({printedIdentifier:value,sessionSlug:slug??''},cat.bills);
        billRows.push({
          statement_id:row.id,source_ordinal:index,printed_identifier:value,
          bill_id:result.billId,match_method:result.matchMethod,
        });
        billMentions.push({bill_id:result.billId,match_method:result.matchMethod});
      }
      const memberId=memberMentions.length===1 ? memberIdsUnique(memberMentions) : null;
      const billId=billMentions.length===1 ? billIdsUnique(billMentions) : null;
      parentRows.push({
        id:row.id,session_id:slug?cat.sessions.get(slug):null,
        membership_id:memberId,
        membership_match_method:memberId?memberMentions[0].match_method:'unresolved',
        bill_id:billId,
        bill_match_method:billId?billMentions[0].match_method:'unresolved',
      });
    }
    await bulk(client,'senate_statement_member_mentions',
      ['statement_id','source_ordinal','printed_name','membership_id','match_method'],
      'statement_id uuid,source_ordinal integer,printed_name text,membership_id uuid,match_method text',
      memberRows,
      'ON CONFLICT (statement_id,source_ordinal) DO UPDATE SET '+
      'membership_id=COALESCE(senate_statement_member_mentions.membership_id,EXCLUDED.membership_id), '+
      'match_method=CASE WHEN senate_statement_member_mentions.membership_id IS NULL THEN EXCLUDED.match_method '+
      'ELSE senate_statement_member_mentions.match_method END');
    await bulk(client,'senate_statement_bill_mentions',
      ['statement_id','source_ordinal','printed_identifier','bill_id','match_method'],
      'statement_id uuid,source_ordinal integer,printed_identifier text,bill_id uuid,match_method text',
      billRows,
      'ON CONFLICT (statement_id,source_ordinal) DO UPDATE SET '+
      'bill_id=COALESCE(senate_statement_bill_mentions.bill_id,EXCLUDED.bill_id), '+
      'match_method=CASE WHEN senate_statement_bill_mentions.bill_id IS NULL THEN EXCLUDED.match_method '+
      'ELSE senate_statement_bill_mentions.match_method END');
    await updateRows(client,
      "UPDATE senate_raw_statements t SET session_id=COALESCE(t.session_id,v.session_id),"+
      "membership_id=COALESCE(t.membership_id,v.membership_id),"+
      "membership_match_method=COALESCE(t.membership_match_method,v.membership_match_method),"+
      "bill_id=COALESCE(t.bill_id,v.bill_id),"+
      "bill_match_method=COALESCE(t.bill_match_method,v.bill_match_method) "+
      "FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,session_id uuid,membership_id uuid,"+
      "membership_match_method text,bill_id uuid,bill_match_method text) WHERE t.id=v.id",
      parentRows);
    tally.scanned+=q.rows.length;
    tally.memberEdges+=memberRows.length;tally.billEdges+=billRows.length;
    cursor=q.rows.at(-1)!.id;
  }
}
async function testimony(client:PoolClient,cat:Catalog,aliases:AliasBuffer):Promise<{
  scanned:number;senatorWitnesses:number;billReferences:number;
}>{
  let cursor='',scanned=0,senatorWitnesses=0,billReferences=0;
  while(scanned<MAX_TESTIMONY){
    const result=await client.query<Testimony>(
      "SELECT t.id,s.slug AS session_slug,t.source_type,t.witness_name,t.organization,"+
      "t.bill_identifier,t.bill_id,t.membership_id,t.source_url,t.hearing_date::text "+
      "FROM senate_committee_testimony_raw t JOIN legislative_sessions s ON s.id=t.session_id "+
      "WHERE s.slug=ANY($2::text[]) AND ($1::text='' OR t.id>NULLIF($1,'')::uuid) "+
      "ORDER BY t.id LIMIT $3",[cursor,SESSIONS,Math.min(400,MAX_TESTIMONY-scanned)]);
    if(!result.rows.length)break;
    const updates:Record<string,unknown>[]=[];
    for(const row of result.rows){
      const senator=(row.source_type==='witness' && row.witness_name &&
        (/^(?:Senator|Sen\.)\s+/i.test(row.witness_name) ||
         /\b(?:Minnesota|State)\s+Senate\b/i.test(row.organization??'')));
      const person=senator ? resolveSenator({
        printedName:row.witness_name!,sessionSlug:row.session_slug,date:row.hearing_date,
      },cat.roster) : {membershipId:null,matchMethod:null};
      const bill=row.bill_identifier ? resolveBill({
        printedIdentifier:row.bill_identifier,sessionSlug:row.session_slug,
      },cat.bills) : {billId:null,matchMethod:null};
      if(senator) {
        senatorWitnesses++;
        aliases.add({membershipId:person.membershipId,matchMethod:person.matchMethod??'unresolved'},
          row.witness_name!,'senate_committee_testimony_raw',row.source_url,cat);
      }
      if(row.bill_identifier)billReferences++;
      updates.push({
        id:row.id,membership_id:person.membershipId,
        membership_match_method:senator?person.matchMethod:null,
        bill_id:bill.billId,
        bill_match_method:row.bill_identifier?(row.bill_id && row.bill_id!==bill.billId
          ? 'existing_preserved':bill.matchMethod):null,
      });
    }
    await updateRows(client,
      "UPDATE senate_committee_testimony_raw t SET "+
      "membership_id=COALESCE(t.membership_id,v.membership_id),"+
      "membership_match_method=COALESCE(t.membership_match_method,v.membership_match_method),"+
      "bill_id=COALESCE(t.bill_id,v.bill_id),"+
      "bill_match_method=COALESCE(t.bill_match_method,v.bill_match_method) "+
      "FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,membership_id uuid,"+
      "membership_match_method text,bill_id uuid,bill_match_method text) WHERE t.id=v.id",
      updates);
    scanned+=result.rows.length;cursor=result.rows.at(-1)!.id;
  }
  return {scanned,senatorWitnesses,billReferences};
}
async function elections(client:PoolClient,cat:Catalog,aliases:AliasBuffer):Promise<{scanned:number}>{
  let scanned=0,cursor='';
  while(scanned<MAX_ELECTIONS){
    const q=await client.query<Election>(
      "SELECT id,election_date::text,election_type,district,candidate_name,source_url,membership_id "+
      "FROM mn_senate_election_raw_results "+
      "WHERE ($1::text='' OR id>NULLIF($1,'')::uuid) ORDER BY id LIMIT $2",
      [cursor,Math.min(400,MAX_ELECTIONS-scanned)]);
    if(!q.rows.length)break;
    const updates:Record<string,unknown>[]=[];
    for(const row of q.rows){
      const slug=senateServiceSessionForElection(row.election_date,row.election_type);
      const link=resolveSenator({
        printedName:row.candidate_name,sessionSlug:slug??'',district:row.district,
      },cat.roster);
      const old=row.membership_id;
      const matchMethod=old && old!==link.membershipId ? 'existing_preserved' : link.matchMethod;
      updates.push({id:row.id,membership_id:link.membershipId,match_method:matchMethod});
      if(link.membershipId)aliases.add(link,row.candidate_name,
        'mn_senate_election_raw_results',row.source_url,cat);
    }
    await updateRows(client,
      "UPDATE mn_senate_election_raw_results t SET "+
      "membership_id=COALESCE(t.membership_id,v.membership_id),"+
      "membership_match_method=COALESCE(t.membership_match_method,v.match_method) "+
      "FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,membership_id uuid,match_method text) "+
      "WHERE t.id=v.id",updates);
    scanned+=q.rows.length;cursor=q.rows.at(-1)!.id;
  }
  return {scanned};
}
async function rawVotes(client:PoolClient,cat:Catalog,aliases:AliasBuffer):Promise<{
  scanned:number;members:number;bills:number;inclusions:number;
}>{
  let cursor='',scanned=0,members=0,bills=0,inclusions=0;
  while(scanned<MAX_VOTE_DOCUMENTS){
    const q=await client.query<RawDocument>(
      "SELECT id,source_url,fetched_at::text,metadata->'rawPrepassageVotes' AS raw "+
      "FROM source_documents WHERE metadata->'rawPrepassageVotes'->>'sessionSlug'=ANY($2::text[]) "+
      "AND ($1::text='' OR id>NULLIF($1,'')::uuid) ORDER BY id LIMIT $3",
      [cursor,SESSIONS,Math.min(30,MAX_VOTE_DOCUMENTS-scanned)]);
    if(!q.rows.length)break;
    const memberRows:Record<string,unknown>[]=[];
    const billRows:Record<string,unknown>[]=[];
    const inclusionRows:Record<string,unknown>[]=[];
    for(const row of q.rows){
      const meta=row.raw;
      const slug=asString(meta.sessionSlug);
      if(!slug || !cat.sessions.has(slug))continue;
      const sourceDate=asString(meta.sourceDate);
      const date=isWithin(sourceDate)?sourceDate:null;
      const recordItems=Array.isArray(meta.records)?meta.records:[];
      for(const [recordIndex,item] of recordItems.entries()){
        if(!item || typeof item!=='object' || Array.isArray(item))continue;
        const record=item as RawVote;
        const ordinal=Number.isSafeInteger(record.ordinal)&&Number(record.ordinal)>0
          ? Number(record.ordinal) : recordIndex+1;
        const voterItems=Array.isArray(record.memberVotes)?record.memberVotes:[];
        const all:Array<{name:string;role:'mover'|'voter';ordinal:number}>=[];
        const mover=asString(record.mover);
        if(mover)all.push({name:mover,role:'mover',ordinal:0});
        for(const [index,v] of voterItems.entries()){
          const name=v && typeof v==='object'&&!Array.isArray(v)
            ? asString((v as {name?:unknown}).name) : null;
          if(name)all.push({name,role:'voter',ordinal:index});
        }
        for(const printed of all) {
          const link=resolveSenator({
            printedName:printed.name,sessionSlug:slug,date,
          },cat.roster);
          memberRows.push({
            source_document_id:row.id,record_ordinal:ordinal,name_ordinal:printed.ordinal,
            role:printed.role,printed_name:printed.name,
            membership_id:link.membershipId,match_method:link.matchMethod,
          });
          aliases.add(link,printed.name,'senate_raw_vote_'+(meta as {sourceType?:string}).sourceType,
            row.source_url,cat);
        }
        const billIdentifier=asString(record.billIdentifier);
        if(billIdentifier){
          const link=resolveBill({printedIdentifier:billIdentifier,sessionSlug:slug},cat.bills);
          billRows.push({
            source_document_id:row.id,record_ordinal:ordinal,
            printed_identifier:billIdentifier,bill_id:link.billId,
            match_method:link.matchMethod,
          });
        }
      }
      if(typeof meta.text==='string'){
        const claims=extractBillInclusionMentions(meta.text);
        for(const [idx,claim] of claims.entries()){
          const source=resolveBill({
            printedIdentifier:claim.sourceBillIdentifier,sessionSlug:slug,
          },cat.bills);
          const target=resolveBill({
            printedIdentifier:claim.targetBillIdentifier,sessionSlug:slug,
          },cat.bills);
          const key=createHash('sha256').update(
            [row.id,idx,claim.mentionType,claim.mentionText].join('|')).digest('hex');
          inclusionRows.push({
            mention_key:key,session_id:cat.sessions.get(slug),
            source_bill_id:source.billId,possible_target_bill_id:target.billId,
            source_bill_identifier:claim.sourceBillIdentifier,
            target_bill_identifier:claim.targetBillIdentifier,
            mention_type:claim.mentionType,mention_text:claim.mentionText,
            source_document_id:row.id,source_url:row.source_url,
            source_date:date,fetched_at:asString(meta.fetchedAt)??row.fetched_at,
          });
        }
      }
    }
    await bulk(client,'senate_raw_vote_member_mentions',
      ['source_document_id','record_ordinal','name_ordinal','role','printed_name','membership_id','match_method'],
      'source_document_id uuid,record_ordinal integer,name_ordinal integer,role text,printed_name text,membership_id uuid,match_method text',
      memberRows,
      'ON CONFLICT (source_document_id,record_ordinal,role,name_ordinal) DO UPDATE SET '+
      'membership_id=COALESCE(senate_raw_vote_member_mentions.membership_id,EXCLUDED.membership_id),'+
      'match_method=CASE WHEN senate_raw_vote_member_mentions.membership_id IS NULL THEN EXCLUDED.match_method '+
      'ELSE senate_raw_vote_member_mentions.match_method END');
    await bulk(client,'senate_raw_vote_bill_mentions',
      ['source_document_id','record_ordinal','printed_identifier','bill_id','match_method'],
      'source_document_id uuid,record_ordinal integer,printed_identifier text,bill_id uuid,match_method text',
      billRows,
      'ON CONFLICT (source_document_id,record_ordinal) DO UPDATE SET '+
      'bill_id=COALESCE(senate_raw_vote_bill_mentions.bill_id,EXCLUDED.bill_id),'+
      'match_method=CASE WHEN senate_raw_vote_bill_mentions.bill_id IS NULL THEN EXCLUDED.match_method '+
      'ELSE senate_raw_vote_bill_mentions.match_method END');
    await bulk(client,'bill_inclusion_mentions',
      ['mention_key','session_id','source_bill_id','possible_target_bill_id','source_bill_identifier',
       'target_bill_identifier','mention_type','mention_text','source_document_id','source_url','source_date','fetched_at'],
      'mention_key char(64),session_id uuid,source_bill_id uuid,possible_target_bill_id uuid,'+
      'source_bill_identifier text,target_bill_identifier text,mention_type text,mention_text text,'+
      'source_document_id uuid,source_url text,source_date date,fetched_at timestamptz',
      inclusionRows,
      'ON CONFLICT (mention_key) DO UPDATE SET '+
      'source_bill_id=COALESCE(bill_inclusion_mentions.source_bill_id,EXCLUDED.source_bill_id),'+
      'possible_target_bill_id=COALESCE(bill_inclusion_mentions.possible_target_bill_id,EXCLUDED.possible_target_bill_id)');
    members+=memberRows.length;bills+=billRows.length;inclusions+=inclusionRows.length;
    scanned+=q.rows.length;cursor=q.rows.at(-1)!.id;
  }
  return {scanned,members,bills,inclusions};
}
export async function runSenateRawIdentityBillBackfill(pool:Pool):Promise<{
  statements:LinkTally;testimony:{scanned:number;senatorWitnesses:number;billReferences:number};
  elections:{scanned:number};rawVotes:{scanned:number;members:number;bills:number;inclusions:number};
}>{
  const client=await pool.connect();
  try{
    const cat=await catalog(client);
    const aliases=new AliasBuffer();
    const stmt:LinkTally={scanned:0,memberEdges:0,billEdges:0,inclusionEdges:0,aliasesLearned:0};
    await statements(client,cat,aliases,stmt);
    const tst=await testimony(client,cat,aliases);
    const elect=await elections(client,cat,aliases);
    const votes=await rawVotes(client,cat,aliases);
    stmt.aliasesLearned=await aliases.flush(client);
    return {statements:stmt,testimony:tst,elections:elect,rawVotes:votes};
  }finally{client.release(true);}
}
