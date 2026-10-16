/**
 * Bounded catalog import from official Revisor search XML, Senate and House
 * identifiers only. Missing bills are added; existing bill data is untouched.
 * This does NOT fetch bill text, features, votes or any prediction inputs.
 */
import type {Pool} from 'pg';
import {fetchRevisorBillSearchRangeDocument} from '../sources/minnesota/revisor-bill-search.js';
import {RevisorPacer} from './senate-revisor-pacer.js';
import {getMinnesotaHouseSession} from '../sources/minnesota/sessions.js';

const SESSIONS = ['2025-2026','2023-2024','2021-2022'] as const;
const MAX_BILL_NUMBER = 12000;
const BATCH_SIZE = 500;
export interface OfficialBillUniverseResult {
  rangesFetched: number;
  rangesAlreadyRecorded: number;
  discovered: number;
  inserted: number;
  alreadyPresent: number;
  completed: boolean;
  stoppedForThrottle: boolean;
  upperBillNumberBound: number;
  lastRange: string | null;
}
export async function importOfficialMinnesotaBillUniverse(
  pool:Pool, pacer:RevisorPacer,
):Promise<OfficialBillUniverseResult>{
  const result:OfficialBillUniverseResult={
    rangesFetched:0,rangesAlreadyRecorded:0,discovered:0,inserted:0,alreadyPresent:0,
    completed:false,stoppedForThrottle:false,
    upperBillNumberBound:MAX_BILL_NUMBER,lastRange:null,
  };
  const client=await pool.connect();
  try{
    const scope=await client.query<{slug:string;session_id:string;chamber:string;chamber_id:string}>(
      "SELECT s.slug,c.slug AS chamber,s.id AS session_id,c.id AS chamber_id "+
      "FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
      "JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug IN ('senate','house') "+
      "WHERE s.slug=ANY($1::text[])",
      [SESSIONS],
    );
    if(scope.rows.length!==6)throw Error('All three official Minnesota sessions and both chambers required');
    const chamberMap=new Map(scope.rows.map(row=>[row.slug+':'+row.chamber,row]));
    const scanned=await client.query<{session_id:string;body:string;first_bill:number}>(
      "SELECT session_id,body,first_bill FROM senate_revisor_bill_catalog_ranges",
    );
    const seen=new Set(scanned.rows.map(r=>r.session_id+':'+r.body+':'+r.first_bill));
    for(const slug of SESSIONS){
      for(const body of ['Senate','House'] as const){
        const fileType=body==='Senate'?'SF':'HF';
        const chamber=chamberMap.get(slug+':'+body.toLowerCase());
        if(!chamber)throw Error('Missing scoped Minnesota '+body+' chamber');
        for(let first=1;first<=MAX_BILL_NUMBER;first+=BATCH_SIZE){
          const last=Math.min(MAX_BILL_NUMBER,first+BATCH_SIZE-1);
          result.lastRange=slug+':'+fileType+':'+first+'-'+last;
          const key=chamber.session_id+':'+body+':'+first;
          if(seen.has(key)){result.rangesAlreadyRecorded++;continue;}
          await pacer.wait();
          let doc;
          try{
            doc=await fetchRevisorBillSearchRangeDocument({
              sessionKey:slug,body,firstBill:first,lastBill:last,
            });
          }catch(error){
            const message=error instanceof Error?error.message:String(error);
            if(/\b(?:429|503)\b/.test(message)){
              result.stoppedForThrottle=true;
              return result;
            }
            throw Error('Official Revisor catalog range unavailable: '+result.lastRange);
          }
          const session=getMinnesotaHouseSession(slug);
          const firstYear=Number(session.startsOn.slice(0,4));
          if(doc.results.some(row=>{
            const uri=new URL(row.statusXmlUrl);
            const path=uri.pathname.match(/^\/bills\/v1\/(\d+)\/(\d{4})\/0\/(HF|SF)\/(\d+)\/$/);
            return row.fileType!==fileType || row.fileNumber<first || row.fileNumber>last ||
              uri.protocol!=='https:' || uri.hostname!=='api.revisor.mn.gov' || !path ||
              Number(path[1])!==session.legislature ||
              ![firstYear,firstYear+1].includes(Number(path[2])) ||
              path[3]!==fileType || Number(path[4])!==row.fileNumber;
          }))
            throw Error('Official catalog returned a foreign, out-of-range, or mismatched bill');
          const unique=new Map(doc.results.map(row=>[row.identifier,row]));
          const rows=[...unique.values()].map(row=>({
            session_id:chamber.session_id,
            originating_chamber_id:chamber.chamber_id,
            identifier:row.identifier,
            title:row.description||row.identifier,
            source_url:row.statusXmlUrl,
            metadata:{revisorCatalog:{
              sourceUrl:doc.sourceUrl,contentSha256:doc.contentSha256,
              fetchedAt:doc.fetchedAt,sourceKind:'official_revisor_search_xml',
            }},
          }));
          await client.query('BEGIN');
          try{
            let inserted=0;
            if(rows.length){
              const q=await client.query<{id:string}>(
                "INSERT INTO bills (session_id,originating_chamber_id,identifier,title,source_url,metadata) "+
                "SELECT v.session_id,v.originating_chamber_id,v.identifier,v.title,v.source_url,v.metadata "+
                "FROM jsonb_to_recordset($1::jsonb) AS v("+
                "session_id uuid,originating_chamber_id uuid,identifier text,title text,source_url text,metadata jsonb) "+
                "ON CONFLICT (session_id,identifier) DO NOTHING RETURNING id",
                [JSON.stringify(rows)],
              );
              inserted=q.rowCount??0;
            }
            await client.query(
              "INSERT INTO senate_revisor_bill_catalog_ranges "+
              "(session_id,body,first_bill,last_bill,source_url,content_sha256,fetched_at,discovered,inserted) "+
              "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) "+
              "ON CONFLICT (session_id,body,first_bill) DO NOTHING",
              [chamber.session_id,body,first,last,doc.sourceUrl,doc.contentSha256,
                doc.fetchedAt,rows.length,inserted],
            );
            await client.query('COMMIT');
            seen.add(key);
            result.rangesFetched++;
            result.discovered+=rows.length;
            result.inserted+=inserted;
            result.alreadyPresent+=rows.length-inserted;
          }catch(error){await client.query('ROLLBACK');throw error;}
        }
      }
    }
    result.completed=true;
    return result;
  }finally{client.release(true);}
}
