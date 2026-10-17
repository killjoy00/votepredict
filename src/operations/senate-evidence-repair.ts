/** Research-only adapters and bounded repairs. Never imports forecasting runtime. */
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {parseSenateJournalAuthorChanges} from './senate-bill-author-parser.js';
import {resolveBill,resolveSenator,type SenateMember,type SessionBill} from './senate-identity-bill-resolvers.js';
import {earliestCdxCapture} from './senate-evidence-dates.js';

const SESSIONS=['2021-2022','2023-2024','2025-2026'];
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');

export async function backfillJournalAuthorEvents(pool:Pool,max=500){
  if(!Number.isInteger(max)||max<1||max>1000)throw Error('Invalid journal event batch');
  const people=await pool.query<{id:string;name:string;slug:string;district:string;starts_on:string|null;ends_on:string|null;aliases:string[]}>(
    `SELECT m.id,l.name,s.slug,m.district,m.starts_on::text,m.ends_on::text,
      coalesce(array_agg(a.source_name) FILTER(WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases
     FROM memberships m JOIN legislators l ON l.id=m.legislator_id
     JOIN legislative_sessions s ON s.id=m.session_id
     JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
     JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'
     LEFT JOIN membership_source_aliases a ON a.membership_id=m.id
     WHERE s.slug=ANY($1::text[]) GROUP BY m.id,l.name,s.slug`,[SESSIONS]);
  const roster:SenateMember[]=people.rows.map(r=>({id:r.id,name:r.name,sessionSlug:r.slug,district:r.district,
    startsOn:r.starts_on,endsOn:r.ends_on,aliases:r.aliases}));
  const bills=await pool.query<{id:string;identifier:string;slug:string}>(
    `SELECT b.id,b.identifier,s.slug FROM bills b JOIN legislative_sessions s ON s.id=b.session_id
     JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' WHERE s.slug=ANY($1::text[])`,[SESSIONS]);
  const catalog:SessionBill[]=bills.rows.map(r=>({id:r.id,identifier:r.identifier,sessionSlug:r.slug}));
  const docs=await pool.query<{id:string;source_url:string;raw:{text:string;sessionSlug:string;sourceDate:string}}>(
    `SELECT d.id,d.source_url,d.metadata->'rawPrepassageVotes' AS raw
     FROM source_documents d JOIN legislative_sessions s ON s.id=d.session_id
     JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
     LEFT JOIN senate_author_journal_event_scans scan ON scan.source_document_id=d.id
     WHERE s.slug=ANY($1::text[]) AND d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'
      AND d.metadata#>>'{rawPrepassageVotes,text}' IS NOT NULL
      AND scan.fingerprint IS DISTINCT FROM encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex')
     ORDER BY d.id LIMIT $2`,[SESSIONS,max]);
  let events=0,unresolved=0;
  for(const doc of docs.rows){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(doc.raw.sourceDate??''))continue;
    const changes=parseSenateJournalAuthorChanges(doc.raw.text);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      for(const [i,change] of changes.entries()){
        const bill=resolveBill({printedIdentifier:change.billIdentifier,sessionSlug:doc.raw.sessionSlug},catalog);
        if(!bill.billId){unresolved++;continue;}
        const person=resolveSenator({printedName:change.nameRaw,sessionSlug:doc.raw.sessionSlug,date:doc.raw.sourceDate},roster);
        const key=sha(JSON.stringify([change.billIdentifier,change.nameRaw,change.operation,change.role]));
        await client.query(`INSERT INTO senate_author_journal_events
          (source_document_id,event_key,source_ordinal,bill_id,membership_id,name_raw,operation,role,occurred_on,source_url)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(source_document_id,event_key) DO NOTHING`,
          [doc.id,key,i+1,bill.billId,person.membershipId,change.nameRaw,change.operation,change.role,doc.raw.sourceDate,doc.source_url]);
        events++;
      }
      await client.query(`INSERT INTO senate_author_journal_event_scans(source_document_id,fingerprint)
        VALUES($1,$2) ON CONFLICT(source_document_id) DO UPDATE SET fingerprint=EXCLUDED.fingerprint,scanned_at=now()`,[doc.id,sha(doc.raw.text)]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }
  return {documents:docs.rows.length,events,unresolved};
}

/** A CDX date alone never qualifies a current snapshot. Exact original bytes must match.
 * Bounded anonymous archive requests, no source mirroring or dates inferred from URL.
 */
export async function backfillScorecardContentObservations(pool:Pool,options:{
  fetchImpl?:typeof fetch;sleep?:(ms:number)=>Promise<void>;max?:number;
}={}){
  const max=options.max??20;
  if(!Number.isInteger(max)||max<1||max>30)throw Error('Invalid scorecard proof batch');
  const fetcher=options.fetchImpl??fetch,sleep=options.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));
  const pending=await pool.query<{id:string;url:string;sha256:string}>(
    `SELECT s.id,s.url,s.sha256 FROM senate_scorecard_snapshots s
     LEFT JOIN senate_scorecard_observation_attempts a ON a.snapshot_id=s.id
     WHERE NOT EXISTS(SELECT 1 FROM senate_scorecard_content_observations o WHERE o.snapshot_id=s.id AND o.body_sha256=s.sha256)
     AND (a.snapshot_id IS NULL OR (a.result='unavailable' AND a.attempts<3 AND a.checked_at<now()-interval '6 hours'))
     ORDER BY s.id LIMIT $1`,[max]);
  const summary={attempted:0,verified:0,mismatch:0,unavailable:0,throttled:false};
  for(const s of pending.rows){
    const source=new URL(s.url);
    if(source.protocol!=='https:'||source.username||source.password||source.hash){summary.unavailable++;continue;}
    summary.attempted++;
    let proof:{observed:string;url:string}|null=null;
    let outcome:'verified'|'mismatch'|'unavailable'='unavailable';
    try{
      await sleep(1250);
      const cdx=await fetcher('https://web.archive.org/cdx/search/cdx?url='+encodeURIComponent(s.url)+
        '&matchType=exact&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=5',
        {redirect:'error',signal:AbortSignal.timeout(20000)});
      if([429,503].includes(cdx.status)){summary.throttled=true;break;}
      if(!cdx.ok){summary.unavailable++;continue;}
      const stamp=earliestCdxCapture(await cdx.json());
      if(!stamp){summary.unavailable++;continue;}
      const observed=`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(8,10)}:${stamp.slice(10,12)}:${stamp.slice(12,14)}Z`;
      if(!Number.isFinite(Date.parse(observed))||new Date(observed).toISOString()!==observed.replace('Z','.000Z')||Date.parse(observed)>Date.now()){summary.unavailable++;continue;}
      const url=`https://web.archive.org/web/${stamp}id_/${s.url}`;
      await sleep(1250);
      const replay=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
      if([429,503].includes(replay.status)){summary.throttled=true;break;}
      if(!replay.ok||Number(replay.headers.get('content-length'))>8_000_000){summary.unavailable++;continue;}
      // Stream cap applies even without a trustworthy content-length header.
      const reader=replay.body?.getReader();if(!reader){summary.unavailable++;continue;}
      const chunks:Uint8Array[]=[];let length=0;
      try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;
        if(length>8_000_000)throw Error('Oversized archive body');chunks.push(next.value);}}
      finally{await reader.cancel();}
      const body=Buffer.concat(chunks);
      if(sha(body)!==s.sha256){summary.mismatch++;outcome='mismatch';}
      else {proof={observed,url};outcome='verified';}
    }catch{summary.unavailable++;}finally{
      // Database errors propagate. They are never classified as publisher failures.
      if(proof){
        await pool.query(`INSERT INTO senate_scorecard_content_observations(snapshot_id,observed_at,archive_url,body_sha256)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[s.id,proof.observed,proof.url,s.sha256]);
        summary.verified++;
      }
      if(!summary.throttled)await pool.query(`INSERT INTO senate_scorecard_observation_attempts(snapshot_id,result)
        VALUES($1,$2) ON CONFLICT(snapshot_id) DO UPDATE SET result=EXCLUDED.result,
        attempts=senate_scorecard_observation_attempts.attempts+1,checked_at=now()`,[s.id,outcome]);
    }
  }
  return summary;
}
