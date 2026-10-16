/**
 * Official Revisor Bill Status API companion links, resumable against ONLY
 * existing session-scoped bills. Missing official targets can be re-resolved locally.
 */
import type { Pool,PoolClient } from 'pg';
import {
  canonicalBillIdentifier,resolveBill,parseRevisorCompanionXml,
  type SessionBill,
} from './senate-identity-bill-resolvers.js';
import {RevisorPacer} from './senate-revisor-pacer.js';

const SESSION_INFO=[
  {slug:'2025-2026',year:2025,legislature:94},
  {slug:'2023-2024',year:2023,legislature:93},
  {slug:'2021-2022',year:2021,legislature:92},
] as const;
const MAX_PAGES=600;
const TIMEOUT_MS=12000;
interface Pending {senate_bill_id:string;session_id:string;slug:string;identifier:string}
interface Capture {candidate:Pending;url:string;fetchedAt:string;companion:string|null;error:boolean;throttled:boolean}
interface StatusSummary {
  attempted:number;linked:number;noCompanion:number;targetMissing:number;
  sourceFailures:number;remainingUnscanned:number;sampleFailures:string[];
  recoveredFromSavedTarget:number;stoppedForThrottle:boolean;
}
function statusUrls(row:Pending):string[]{
  const session=SESSION_INFO.find(s=>s.slug===row.slug);
  const canonical=canonicalBillIdentifier(row.identifier);
  if(!session || !canonical || !/^SF[1-9]\d{0,5}$/.test(canonical))
    throw Error('Unusable session Senate bill identifier');
  const number=Number(canonical.slice(2));
  // Revisor indexes a biennium by its introduction year; 2026-introduced
  // bills use /94/2026/, while 2025-introduced bills use /94/2025/.
  return [session.year,session.year+1].map(year=>
    'https://api.revisor.mn.gov/bills/v1/'+session.legislature+'/'+year+'/0/SF/'+number+'/');
}
async function fetchCapture(row:Pending,pacer:RevisorPacer):Promise<Capture>{
  const urls=statusUrls(row);
  const now=new Date().toISOString();
  for(const url of urls){
    await pacer.wait();
    try{
      const r=await fetch(url,{
        headers:{Accept:'application/xml,text/xml;q=0.9,*/*;q=0.1','User-Agent':'VotePredict/2.0 raw companion crosswalk'},
        signal:AbortSignal.timeout(TIMEOUT_MS),cache:'no-store',
      });
      if(r.status===429 || r.status===503)
        return {candidate:row,url,fetchedAt:now,companion:null,error:true,throttled:true};
      if(!r.ok) continue;
      const xml=await r.text();
      const type=xml.match(/<FILE_TYPE>\s*(HF|SF)\s*<\/FILE_TYPE>/i)?.[1]?.toUpperCase();
      const num=Number(xml.match(/<FILE_NUMBER>\s*(\d+)\s*<\/FILE_NUMBER>/i)?.[1]);
      const year=Number(xml.match(/<SESSION_YEAR>\s*(\d{4})\s*<\/SESSION_YEAR>/i)?.[1]);
      if(type!=='SF' || canonicalBillIdentifier(type+num)!==canonicalBillIdentifier(row.identifier)
        || year!==Number(new URL(url).pathname.split('/')[4])
        || !/<BILL(?:\s|>)/i.test(xml) || !/<COMPANION_TYPE\s*\/?>(?:[\s\S]*?<\/COMPANION_TYPE>)?/i.test(xml))
        continue;
      const companion=parseRevisorCompanionXml(xml);
      return {candidate:row,url,fetchedAt:new Date().toISOString(),companion,error:false,throttled:false};
    }catch{ /* Official status is unavailable: try the other biennial year. */ }
  }
  return {candidate:row,url:urls[0],fetchedAt:now,companion:null,error:true,throttled:false};
}
async function pending(client:PoolClient):Promise<Pending[]>{
  const q=await client.query<Pending>(
    "SELECT b.id AS senate_bill_id,s.id AS session_id,s.slug,b.identifier "+
    "FROM bills b JOIN legislative_sessions s ON s.id=b.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "LEFT JOIN senate_bill_companion_scans scan ON scan.senate_bill_id=b.id "+
    "WHERE s.slug=ANY($1::text[]) AND b.identifier ~* '^SF[0-9]{1,6}$' "+
    "AND scan.senate_bill_id IS NULL ORDER BY s.slug DESC,b.identifier LIMIT $2",
    [SESSION_INFO.map(x=>x.slug),MAX_PAGES],
  );
  return q.rows;
}
async function remaining(client:PoolClient):Promise<number>{
  const q=await client.query<{n:number}>(
    "SELECT count(*)::int AS n FROM bills b "+
    "JOIN legislative_sessions s ON s.id=b.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "LEFT JOIN senate_bill_companion_scans scan ON scan.senate_bill_id=b.id "+
    "WHERE s.slug=ANY($1::text[]) AND b.identifier ~* '^SF[0-9]{1,6}$' "+
    "AND scan.senate_bill_id IS NULL",[SESSION_INFO.map(x=>x.slug)],
  );
  return q.rows[0]?.n??0;
}
async function catalog(client:PoolClient):Promise<SessionBill[]>{
  const q=await client.query<{id:string;session_slug:string;identifier:string}>(
    "SELECT b.id,s.slug AS session_slug,b.identifier FROM bills b "+
    "JOIN legislative_sessions s ON s.id=b.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "WHERE s.slug=ANY($1::text[])",[SESSION_INFO.map(x=>x.slug)]);
  return q.rows.map(r=>({id:r.id,sessionSlug:r.session_slug,identifier:r.identifier}));
}
async function persist(client:PoolClient,rows:Capture[],billCatalog:SessionBill[]):Promise<{
  linked:number;noCompanion:number;targetMissing:number;
}>{
  const success=rows.filter(row=>!row.error);
  let linked=0,noCompanion=0,targetMissing=0;
  if(!success.length)return {linked,noCompanion,targetMissing};
  await client.query('BEGIN');
  try{
    for(const c of success){
      const companion=c.companion;
      const result=companion && companion.startsWith('HF')
        ? resolveBill({printedIdentifier:companion,sessionSlug:c.candidate.slug},billCatalog)
        : null;
      const status=!companion ? 'none' : result?.billId ? 'linked' : 'target_missing';
      if(status==='none')noCompanion++;
      if(status==='target_missing')targetMissing++;
      if(result?.billId && companion?.startsWith('HF')){
        await client.query(
          'INSERT INTO bill_companions (senate_bill_id,house_bill_id,session_id,source_url,fetched_at) '+
          'VALUES ($1,$2,$3,$4,$5) ON CONFLICT (session_id,senate_bill_id,house_bill_id) DO NOTHING',
          [c.candidate.senate_bill_id,result.billId,c.candidate.session_id,c.url,c.fetchedAt]);
        linked++;
      }
      await client.query(
        'INSERT INTO senate_bill_companion_scans '+
        '(senate_bill_id,session_id,source_url,fetched_at,printed_companion_identifier,result) '+
        'VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (senate_bill_id) DO NOTHING',
        [c.candidate.senate_bill_id,c.candidate.session_id,c.url,c.fetchedAt,companion,status],
      );
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  return {linked,noCompanion,targetMissing};
}
/**
 * Re-resolve saved companion identifiers after new House bills arrive.
 * Never refetch status XML or rewrite its original fetched_at/source_url.
 */
async function recoverStoredCompanionTargets(
  client:PoolClient,billCatalog:SessionBill[],
):Promise<number>{
  const q=await client.query<{
    senate_bill_id:string;session_id:string;session_slug:string;
    printed_companion_identifier:string;source_url:string;fetched_at:string;
  }>(
    "SELECT scan.senate_bill_id,scan.session_id,s.slug AS session_slug,"+
    "scan.printed_companion_identifier,scan.source_url,scan.fetched_at::text "+
    "FROM senate_bill_companion_scans scan "+
    "JOIN legislative_sessions s ON s.id=scan.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "WHERE s.slug=ANY($1::text[]) AND scan.result='target_missing' "+
    "AND scan.printed_companion_identifier IS NOT NULL "+
    "ORDER BY scan.senate_bill_id LIMIT 25000",
    [SESSION_INFO.map(x=>x.slug)],
  );
  const matched=q.rows.flatMap(row=>{
    const id=resolveBill({
      printedIdentifier:row.printed_companion_identifier,sessionSlug:row.session_slug,
    },billCatalog).billId;
    return id&&canonicalBillIdentifier(row.printed_companion_identifier)?.startsWith('HF')
      ? [{...row,house_bill_id:id}] : [];
  });
  if(!matched.length)return 0;
  await client.query('BEGIN');
  try{
    for(let i=0;i<matched.length;i+=350){
      const batch=JSON.stringify(matched.slice(i,i+350));
      await client.query(
        "INSERT INTO bill_companions(senate_bill_id,house_bill_id,session_id,source_url,fetched_at) "+
        "SELECT v.senate_bill_id,v.house_bill_id,v.session_id,v.source_url,v.fetched_at "+
        "FROM jsonb_to_recordset($1::jsonb) AS v("+
        "senate_bill_id uuid,house_bill_id uuid,session_id uuid,source_url text,fetched_at timestamptz) "+
        "ON CONFLICT (session_id,senate_bill_id,house_bill_id) DO NOTHING",
        [batch],
      );
      await client.query(
        "UPDATE senate_bill_companion_scans s SET result='linked',last_checked_at=now() "+
        "FROM jsonb_to_recordset($1::jsonb) AS v(senate_bill_id uuid) "+
        "WHERE s.senate_bill_id=v.senate_bill_id AND s.result='target_missing'",
        [batch],
      );
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  return matched.length;
}
export async function reconcileMissingSenateCompanionTargets(pool:Pool):Promise<number>{
  const client=await pool.connect();
  try{return await recoverStoredCompanionTargets(client,await catalog(client));}
  finally{client.release(true);}
}
export async function backfillOfficialSenateBillCompanions(
  pool:Pool,pacer=new RevisorPacer(),
):Promise<StatusSummary>{
  const client=await pool.connect();
  const summary:StatusSummary={
    attempted:0,linked:0,noCompanion:0,targetMissing:0,sourceFailures:0,
    remainingUnscanned:0,sampleFailures:[],recoveredFromSavedTarget:0,
    stoppedForThrottle:false,
  };
  try{
    const billCatalog=await catalog(client);
    summary.recoveredFromSavedTarget=await recoverStoredCompanionTargets(client,billCatalog);
    const work=await pending(client);
    for(const row of work){
      const capture=await fetchCapture(row,pacer);
      summary.attempted++;
      if(capture.error){
        summary.sourceFailures++;
        if(summary.sampleFailures.length<8)
          summary.sampleFailures.push(capture.candidate.slug+':'+capture.candidate.identifier);
      }
      if(capture.throttled){
        summary.stoppedForThrottle=true;
        break;
      }
      const results=await persist(client,[capture],billCatalog);
      summary.linked+=results.linked;
      summary.noCompanion+=results.noCompanion;
      summary.targetMissing+=results.targetMissing;
      if(summary.attempted%100===0)console.log('SENATE_OFFICIAL_COMPANION_PROGRESS='+JSON.stringify({
        attempted:summary.attempted,linked:summary.linked,
        sourceFailures:summary.sourceFailures,
      }));
    }
    summary.remainingUnscanned=await remaining(client);
    return summary;
  }finally{client.release(true);}
}
