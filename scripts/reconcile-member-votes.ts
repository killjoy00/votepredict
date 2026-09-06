import { Pool, type PoolClient } from 'pg';
import { reconcileHouseMemberName, type MembershipCandidate } from '../src/sources/minnesota/member-reconciliation.js';
import { getMinnesotaHouseSession, MINNESOTA_HOUSE_HISTORICAL_SESSIONS } from '../src/sources/minnesota/sessions.js';

type Chamber = 'house' | 'senate';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function resolveContext(client: PoolClient, sessionSlug: string, chamberSlug: Chamber): Promise<{ sessionId: string; chamberId: string } | undefined> {
  const result = await client.query<{ session_id: string; chamber_id: string }>(
    `SELECT s.id session_id,c.id chamber_id FROM legislative_sessions s
       JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
       JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug=$2
      WHERE s.slug=$1`, [sessionSlug, chamberSlug]);
  return result.rows[0] ? { sessionId: result.rows[0].session_id, chamberId: result.rows[0].chamber_id } : undefined;
}

async function candidates(client: PoolClient, context: { sessionId: string; chamberId: string }): Promise<MembershipCandidate[]> {
  const members = await client.query<{ membership_id: string; legislator_id: string; name: string; normalized_name: string }>(
    `SELECT m.id membership_id,l.id legislator_id,l.name,l.normalized_name FROM memberships m JOIN legislators l ON l.id=m.legislator_id WHERE m.session_id=$1 AND m.chamber_id=$2`,
    [context.sessionId, context.chamberId]);
  const aliases = await client.query<{ membership_id: string; source_name: string }>(
    `SELECT a.membership_id,a.source_name FROM membership_source_aliases a JOIN memberships m ON m.id=a.membership_id WHERE m.session_id=$1 AND m.chamber_id=$2`,
    [context.sessionId, context.chamberId]);
  const map = new Map<string,string[]>();
  for (const alias of aliases.rows) map.set(alias.membership_id,[...(map.get(alias.membership_id)??[]),alias.source_name]);
  return members.rows.map((row)=>({membershipId:row.membership_id,legislatorId:row.legislator_id,name:row.name,normalizedName:row.normalized_name,aliases:map.get(row.membership_id)}));
}

async function run(client: PoolClient, sessionSlug: string, chamber: Chamber): Promise<{ matched:number; ambiguous:number; unmatched:number }> {
  const context=await resolveContext(client,sessionSlug,chamber);
  if(!context){ console.log(`[${sessionSlug}/${chamber}] no context; skipping`); return {matched:0,ambiguous:0,unmatched:0}; }
  const roster=await candidates(client,context);
  const rows=await client.query<{id:string;source_member_name:string;occurred_on:string}>(
    `SELECT mv.id,mv.source_member_name,ve.occurred_on::text FROM member_votes mv JOIN vote_events ve ON ve.id=mv.vote_event_id
      WHERE ve.session_id=$1 AND ve.chamber_id=$2 AND mv.membership_id IS NULL ORDER BY ve.occurred_on,mv.id`,[context.sessionId,context.chamberId]);
  let matched=0,ambiguous=0,unmatched=0;
  for(const row of rows.rows){
    const active=roster.filter((candidate)=>candidate.membershipId).filter((candidate)=>candidate);
    const resolution=reconcileHouseMemberName(row.source_member_name,active);
    if(resolution.status==='matched'){
      const validity=await client.query<{ok:boolean}>(`SELECT ($2::date >= COALESCE(starts_on,'0001-01-01'::date) AND $2::date <= COALESCE(ends_on,'9999-12-31'::date)) ok FROM memberships WHERE id=$1`,[resolution.membershipId,row.occurred_on]);
      if(validity.rows[0]?.ok){
        await client.query(`UPDATE member_votes SET membership_id=$2,metadata=metadata||$3::jsonb WHERE id=$1`,[row.id,resolution.membershipId,JSON.stringify({reconciliation:resolution,reconciledAt:new Date().toISOString()})]);
        matched+=1;
      } else { unmatched+=1; }
    } else if(resolution.status==='ambiguous') ambiguous+=1; else unmatched+=1;
  }
  console.log(`[${sessionSlug}/${chamber}] candidates=${roster.length} unresolved=${rows.rowCount??rows.rows.length} matched=${matched} ambiguous=${ambiguous} unmatched=${unmatched}`);
  return {matched,ambiguous,unmatched};
}

async function main(): Promise<void>{
  const args=process.argv.slice(2); const requested=argumentValue(args,'--session');
  const sessions=requested?[getMinnesotaHouseSession(requested)]:[...MINNESOTA_HOUSE_HISTORICAL_SESSIONS];
  const chamberArg=argumentValue(args,'--chamber')??'both';
  if(!['house','senate','both'].includes(chamberArg)) throw new Error('--chamber must be house, senate, or both');
  const chambers:Chamber[]=chamberArg==='both'?['house','senate']:[chamberArg as Chamber];
  const connectionString=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL; if(!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool=new Pool({connectionString,max:2}); let unresolved=0;
  try{const client=await pool.connect();try{for(const session of sessions)for(const chamber of chambers){const result=await run(client,session.slug,chamber);unresolved+=result.ambiguous+result.unmatched;}}finally{client.release();}}finally{await pool.end();}
  if(args.includes('--strict')&&unresolved>0) process.exitCode=1;
}
main().catch((error)=>{console.error(error instanceof Error?error.stack??error.message:error);process.exitCode=1;});
