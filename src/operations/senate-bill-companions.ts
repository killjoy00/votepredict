/**
 * Official Revisor Bill Status API companion links, resumable against ONLY
 * existing session-scoped bills. No bill rows or forecasting tables created.
 */
import type { Pool,PoolClient } from 'pg';
import {
  canonicalBillIdentifier,resolveBill,parseRevisorCompanionXml,
  type SessionBill,
} from './senate-identity-bill-resolvers.js';

const SESSION_INFO=[
  {slug:'2025-2026',year:2025,legislature:94},
  {slug:'2023-2024',year:2023,legislature:93},
  {slug:'2021-2022',year:2021,legislature:92},
] as const;
const MAX_PAGES=25000;
const WORKERS=5;
const TIMEOUT_MS=12000;
interface Pending {senate_bill_id:string;session_id:string;slug:string;identifier:string}
interface Capture {candidate:Pending;url:string;fetchedAt:string;companion:string|null;error:boolean}
interface StatusSummary {
  attempted:number;linked:number;noCompanion:number;targetMissing:number;
  sourceFailures:number;remainingUnscanned:number;sampleFailures:string[];
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
async function fetchCapture(row:Pending):Promise<Capture>{
  const urls=statusUrls(row);
  const now=new Date().toISOString();
  for(const url of urls){
    try{
      const r=await fetch(url,{
        headers:{Accept:'application/xml,text/xml;q=0.9,*/*;q=0.1','User-Agent':'VotePredict/2.0 raw companion crosswalk'},
        signal:AbortSignal.timeout(TIMEOUT_MS),cache:'no-store',
      });
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
      return {candidate:row,url,fetchedAt:new Date().toISOString(),companion,error:false};
    }catch{ /* Official status is unavailable: try the other biennial year. */ }
  }
  return {candidate:row,url:urls[0],fetchedAt:now,companion:null,error:true};
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
export async function backfillOfficialSenateBillCompanions(pool:Pool):Promise<StatusSummary>{
  const client=await pool.connect();
  const summary:StatusSummary={
    attempted:0,linked:0,noCompanion:0,targetMissing:0,sourceFailures:0,
    remainingUnscanned:0,sampleFailures:[],
  };
  try{
    const billCatalog=await catalog(client);
    const work=await pending(client);
    for(let i=0;i<work.length;i+=WORKERS){
      const batch=await Promise.all(work.slice(i,i+WORKERS).map(fetchCapture));
      summary.attempted+=batch.length;
      summary.sourceFailures+=batch.filter(c=>c.error).length;
      for(const failure of batch.filter(c=>c.error).slice(0,2)){
        if(summary.sampleFailures.length<8)
          summary.sampleFailures.push(failure.candidate.slug+':'+failure.candidate.identifier);
      }
      const results=await persist(client,batch,billCatalog);
      summary.linked+=results.linked;
      summary.noCompanion+=results.noCompanion;
      summary.targetMissing+=results.targetMissing;
      if(i%300===0)console.log('SENATE_OFFICIAL_COMPANION_PROGRESS='+JSON.stringify({
        attempted:summary.attempted,linked:summary.linked,
        sourceFailures:summary.sourceFailures,
      }));
      // Short bounded courtesy delay between bursts to official public sources.
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    summary.remainingUnscanned=await remaining(client);
    return summary;
  }finally{client.release(true);}
}
