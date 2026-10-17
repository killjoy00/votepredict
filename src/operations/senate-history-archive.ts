/** Bounded historical-body acquisition. An index timestamp alone never dates current words. */
import type {Pool} from 'pg';
import {captureOfficialRevisorHtml} from './senate-official-bill-text.js';
import {hash,compact,billIdentifier} from './senate-vote-paper-parser.js';
import {historyRoster,HISTORY_SESSIONS,storeHistoricalRoles} from './senate-vote-paper-backfill.js';
import {getMinnesotaHouseSession} from '../sources/minnesota/sessions.js';
import {parseSenateCommitteeRoles,parseSenateLeadershipRoles} from '../sources/minnesota/senate-roles.js';
import {parseLrlSenateRoles} from '../sources/minnesota/lrl-members.js';
import {parseSenateAssignmentPdfText} from '../sources/minnesota/senate-assignment-pdf.js';
import {buildRevisorBillCandidateUrls} from '../sources/minnesota/revisor.js';

/** Recover only papers explicitly named in a journal, rather than choosing a latest version. */
export async function recoverExplicitBaseBodies(pool:Pool,options:{max?:number;fetchImpl?:typeof fetch;sleep?:(ms:number)=>Promise<void>}={}){
 const max=options.max??30;if(!Number.isInteger(max)||max<1||max>100)throw Error('Invalid explicit body batch');
 const candidates=(await pool.query(`SELECT DISTINCT a.bill_id,b.session_id,b.identifier,s.slug,a.explicit_base_locator AS locator
  FROM senate_vote_paper_current_v a JOIN bills b ON b.id=a.bill_id JOIN legislative_sessions s ON s.id=b.session_id
  WHERE a.explicit_base_locator IS NOT NULL`)).rows;
 const queue=candidates.flatMap(c=>buildRevisorBillCandidateUrls(c.slug,c.identifier).map(root=>({...c,root,url:root+c.locator,
  family:c.locator.includes('/ue/')?'unofficial_engrossment':'numbered_version'})));
 if(queue.length)await pool.query(`INSERT INTO senate_official_bill_text_queue(bill_id,session_id,family,printed_label,source_url,status_url,source_locator)
  SELECT v.bill_id,v.session_id,v.family,v.locator,v.url,v.root,v.locator
  FROM jsonb_to_recordset($1::jsonb) v(bill_id uuid,session_id uuid,family text,locator text,url text,root text)
  ON CONFLICT(bill_id,source_url) DO NOTHING`,[JSON.stringify(queue)]);
 const rows=(await pool.query(`WITH ranked AS(SELECT q.*,b.identifier,s.slug,
  row_number() OVER(PARTITION BY s.slug ORDER BY q.attempts,q.source_url) AS rank
  FROM senate_official_bill_text_queue q JOIN bills b ON b.id=q.bill_id JOIN legislative_sessions s ON s.id=q.session_id
  WHERE EXISTS(SELECT 1 FROM senate_vote_paper_current_v a WHERE a.bill_id=q.bill_id AND a.explicit_base_locator=q.source_locator)
  AND(q.status='pending' OR(q.status='failed' AND q.attempts<3 AND q.last_checked_at<now()-interval '6 hours')))
  SELECT * FROM ranked ORDER BY rank,slug LIMIT $1`,[max])).rows;
 const summary={attempted:0,captured:0,unavailable:0,failed:0,throttled:false},fetcher=options.fetchImpl??fetch;
 for(const q of rows){
  if(!validHistorySource('bill_text',q.source_url))throw Error('Invalid explicit base URL');
  await (options.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))(750);summary.attempted++;
  let response:Response|null=null,bytes:Uint8Array|null=null;
  try{response=await fetcher(q.source_url,{redirect:'error',headers:{'User-Agent':'VotePredict/2.0 Senate explicit paper research'},signal:AbortSignal.timeout(20000)});
   if([429,503].includes(response.status)){summary.throttled=true;break;}
   if(response.ok)bytes=await boundedBody(response);
  }catch{/* Source failures are recorded below, outside all database writes. */}
  let captured:ReturnType<typeof captureOfficialRevisorHtml>|null=null;
  if(bytes){try{
   const raw=Buffer.from(bytes).toString('utf8'),title=raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'';
   const m=title.match(/\b(HF|SF)\s*0*(\d+)\b/i);
   if(m&&m[1].toUpperCase()+Number(m[2])===q.identifier)captured=captureOfficialRevisorHtml(bytes);
   if(captured&&!/(?:A bill for an act|Be it enacted|Section 1\.)/i.test(captured.rawText))captured=null;
  }catch{captured=null;}}
  if(captured){
   await pool.query(`INSERT INTO senate_official_bill_text_captures(queue_id,session_id,bill_id,family,source_url,status_url,source_locator,printed_label,
    original_body,raw_text,original_body_sha256,body_hash_provenance,extracted_text_sha256,original_byte_length,content_type,fetched_at,http_status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'fetched_original_bytes',$12,$13,'text/html',now(),200)
    ON CONFLICT(source_url,source_locator,original_body_sha256,extracted_text_sha256) DO NOTHING`,
    [q.id,q.session_id,q.bill_id,q.family,q.source_url,q.status_url,q.source_locator,q.printed_label,captured.originalBody,captured.rawText,
     captured.originalBodySha256,captured.extractedTextSha256,captured.originalByteLength]);summary.captured++;
  }else if(response?.status===404)summary.unavailable++;else summary.failed++;
  await pool.query(`UPDATE senate_official_bill_text_queue SET status=$2,attempts=attempts+1,last_checked_at=now(),last_http_status=$3,last_error_kind=$4 WHERE id=$1`,
   [q.id,captured?'complete':response?.status===404?'unavailable':'failed',response?.status??null,captured?null:'explicit_paper_unavailable_or_unparsed']);
 }
 return summary;
}

export function validHistorySource(kind:string,url:string):boolean {
 try{
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.hash)return false;
  if(kind==='bill_text')return u.hostname==='www.revisor.mn.gov'&&!u.search&&/^\/bills\/(92|93|94)\/202[1-6]\/0\/(HF|SF)\/[1-9]\d{0,5}\/versions\/(?:\d+|ue\/\d+|ccr\/[A-Za-z0-9]+)\/(?:pdf\/)?$/i.test(u.pathname);
  if(kind==='role_pdf')return u.hostname==='www.senate.mn'&&!u.search&&/^\/committees\/202[135]-202[246]\/info\/comlegal\.pdf$/.test(u.pathname);
  if(kind==='role_html')return (u.hostname==='www.senate.mn'&&['/members','/members/','/committees/committee_bio.html','/committees/committee_bio.php'].includes(u.pathname))
   ||(u.hostname==='www.lrl.mn.gov'&&/^\/legdb\/fulldetail(?:\?)?$/.test(u.pathname)&&/^\d+$/.test(u.searchParams.get('ID')??u.searchParams.get('id')??''));
 }catch{}
 return false;
}
function sameOriginal(original:string,sourceUrl:string){
 try{const u=new URL(original),expected=new URL(sourceUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash)return false;
  u.protocol='https:';u.searchParams.sort();expected.searchParams.sort();return u.toString()===expected.toString()}catch{return false}
}
export function archiveCaptures(payload:unknown,sourceUrl:string,slug:string):Array<{stamp:string;original:string}>{
 if(!Array.isArray(payload)||!Array.isArray(payload[0]))return [];
 const header=payload[0].map(String),ti=header.indexOf('timestamp'),oi=header.indexOf('original'),si=header.indexOf('statuscode');
 if(ti<0||oi<0||si<0)return [];
 const captures=payload.slice(1).filter(Array.isArray).filter(r=>sameOriginal(String(r[oi]),sourceUrl)&&String(r[si])==='200')
  .map(r=>({stamp:String(r[ti]),original:String(r[oi])})).filter(c=>/^\d{14}$/.test(c.stamp)&&Number(c.stamp.slice(0,4))>=Number(slug.slice(0,4))&&Number(c.stamp.slice(0,4))<=Number(slug.slice(5)))
  .sort((a,b)=>a.stamp.localeCompare(b.stamp));
 const chosen:typeof captures=[];
 for(const year of slug.split('-')){const values=captures.filter(c=>c.stamp.startsWith(year));if(values.length)chosen.push(values[0],values.at(-1)!);}
 return [...new Map(chosen.map(c=>[c.stamp,c])).values()];
}
export function archiveTimestamp(stamp:string):string|null {
 if(!/^\d{14}$/.test(stamp))return null;
 const iso=`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(8,10)}:${stamp.slice(10,12)}:${stamp.slice(12,14)}Z`;
 const d=new Date(iso);return Number.isFinite(d.valueOf())&&d.toISOString()===iso.replace('Z','.000Z')&&d.valueOf()<Date.now()?iso:null;
}
export async function boundedBody(response:Response,cap=8_000_000):Promise<Uint8Array>{
 if(Number(response.headers.get('content-length'))>cap)throw Error('Historical body oversized');
 const reader=response.body?.getReader();if(!reader)throw Error('Missing historical body');
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const n=await reader.read();if(n.done)break;length+=n.value.length;if(length>cap)throw Error('Historical body oversized');chunks.push(n.value);}}
 finally{await reader.cancel();}
 return Buffer.concat(chunks);
}
type Job={job_key:string;kind:'bill_text'|'role_html'|'role_pdf';session_id:string;bill_id:string|null;source_url:string;slug:string;identifier:string|null};
export async function stageHistoryJobs(pool:Pool){
 const candidates=(await pool.query(`SELECT DISTINCT s.id AS session_id,s.slug,c.bill_id,c.source_url,'bill_text' AS kind
  FROM senate_official_bill_text_captures c JOIN legislative_sessions s ON s.id=c.session_id WHERE c.family<>'amendment'
  UNION SELECT DISTINCT s.id,s.slug,b.id,coalesce(v.text_url,v.source_url),'bill_text' FROM bill_versions v JOIN bills b ON b.id=v.bill_id
  JOIN legislative_sessions s ON s.id=b.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' WHERE s.slug=ANY($1::text[])
  AND(EXISTS(SELECT 1 FROM vote_events ve JOIN chambers ch ON ch.id=ve.chamber_id AND ch.slug='senate' WHERE ve.bill_id=b.id)
    OR EXISTS(SELECT 1 FROM senate_raw_vote_bill_mentions rm WHERE rm.bill_id=b.id))
  UNION SELECT DISTINCT s.id,s.slug,NULL::uuid,o.source_url,CASE WHEN o.content_type='application/pdf' THEN 'role_pdf' ELSE 'role_html' END
  FROM senate_role_source_snapshots o JOIN legislative_sessions s ON s.id=o.session_id WHERE s.slug=ANY($1::text[])
  UNION SELECT s.id,s.slug,NULL::uuid,'https://www.senate.mn/members?id=leadership','role_html' FROM legislative_sessions s
  JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' WHERE s.slug=ANY($1::text[])`,[HISTORY_SESSIONS])).rows;
 const aliases=candidates.flatMap(c=>{
  if(c.kind==='bill_text'&&c.source_url&&validHistorySource(c.kind,c.source_url)&&!c.source_url.endsWith('/pdf/'))return [c,{...c,source_url:c.source_url+'pdf/'}];
  if(c.kind!=='role_html'||!c.source_url?.includes('/committees/committee_bio.'))return [c];
  const u=new URL(c.source_url),urls=new Set<string>([c.source_url]);
  for(const extension of ['html','php'])for(const includeSession of [true,false]){
   const copy=new URL(u);copy.pathname='/committees/committee_bio.'+extension;
   if(!includeSession)copy.searchParams.delete('ls');urls.add(copy.toString());
  }
  return [...urls].map(source_url=>({...c,source_url}));
 });
 const rows=[...new Map(aliases.filter(c=>validHistorySource(c.kind,c.source_url??'')).map(c=>{
  const key=hash(JSON.stringify([c.session_id,c.kind,c.source_url]));return [key,{...c,key}];})).values()];
 // Set-based and resumable: a newly stored source is staged on the next run.
 if(rows.length)await pool.query(`INSERT INTO senate_historical_source_jobs(job_key,session_id,kind,bill_id,source_url)
  SELECT v.key,v.session_id,v.kind,v.bill_id,v.source_url FROM jsonb_to_recordset($1::jsonb) v(key text,session_id uuid,kind text,bill_id uuid,source_url text)
  ON CONFLICT(job_key) DO NOTHING`,[JSON.stringify(rows)]);
 return rows.length;
}
async function pdfText(bytes:Uint8Array){
 const {PDFParse}=await import('pdf-parse');const {CanvasFactory}=await import('pdf-parse/worker');
 const parser=new PDFParse({data:bytes.slice(),CanvasFactory});try{return (await parser.getText()).text}finally{await parser.destroy()}
}
export function statedAssignmentDate(text:string,slug:string):string|null{
 const m=text.match(/\bAs of\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  ??text.slice(0,1000).match(/(?:^|\n)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?=\n|$)/);
 if(!m||!slug.split('-').includes(m[3]))return null;
 const iso=m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'),d=new Date(iso+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===iso?iso:null;
}
/** A dated official assignment sheet records role facts at its stated date.
 * Its current download is kept separately; no historical page-publication clock is invented.
 */
export async function collectDatedAssignmentFacts(pool:Pool,options:{fetchImpl?:typeof fetch}={}){
 const sessions=(await pool.query(`SELECT s.id,s.slug FROM legislative_sessions s JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
  LEFT JOIN senate_role_dated_roster_checks r ON r.session_id=s.id WHERE s.slug=ANY($1::text[])
  AND(r.session_id IS NULL OR(r.result='unavailable' AND r.attempts<3 AND r.checked_at<now()-interval '6 hours')) ORDER BY s.slug`,[HISTORY_SESSIONS])).rows;
 const roster=await historyRoster(pool),summary={checked:0,capturedSources:0,roleFacts:0,unparsed:0,unavailable:0};
 for(const s of sessions){
  const url=`https://www.senate.mn/committees/${s.slug}/info/comlegal.pdf`;
  let bytes:Uint8Array|null=null,text:string|null=null;
  try{const r=await (options.fetchImpl??fetch)(url,{redirect:'error',headers:{'User-Agent':'VotePredict/2.0 dated Senate role research'},signal:AbortSignal.timeout(20000)});
   if(r.ok){bytes=await boundedBody(r,30_000_000);if(Buffer.from(bytes.slice(0,5)).toString()==='%PDF-')text=await pdfText(bytes);}
  }catch{/* Public source failure only: storage stays outside this catch. */}
  const date=text?statedAssignmentDate(text,s.slug):null;
  const parsed=text?parseSenateAssignmentPdfText(text,getMinnesotaHouseSession(s.slug)):null;
  const result=!text?'unavailable':!date||!parsed?.roles.length?'unparsed':'captured';summary.checked++;
  if(result==='captured'){
   summary.roleFacts+=await storeHistoricalRoles(pool,roster,{sessionId:s.id,slug:s.slug,sourceUrl:url,body:text!,originalSha:hash(bytes!),
    occurredOn:date!,kind:'official_dated_roster',roles:parsed!.roles});summary.capturedSources++;
  }else if(result==='unparsed')summary.unparsed++;else summary.unavailable++;
  await pool.query(`INSERT INTO senate_role_dated_roster_checks(session_id,result,attempts) VALUES($1,$2,1)
   ON CONFLICT(session_id) DO UPDATE SET result=EXCLUDED.result,attempts=senate_role_dated_roster_checks.attempts+1,checked_at=now()`,[s.id,result]);
 }
 return summary;
}
export async function captureArchivedHistory(pool:Pool,job:Job,stamp:string,bytes:Uint8Array,roster:Awaited<ReturnType<typeof historyRoster>>,original=job.source_url){
 const observed=archiveTimestamp(stamp);if(!observed||!validHistorySource(job.kind,job.source_url))throw Error('Invalid archived source identity');
 if(!sameOriginal(original,job.source_url))throw Error('Archived original URL mismatch');
 const archiveUrl=`https://web.archive.org/web/${stamp}id_/${original}`,originalSha=hash(bytes);
 if(job.kind==='bill_text'){
  const isPdf=job.source_url.endsWith('/pdf/');let raw:string;
  if(isPdf){if(Buffer.from(bytes.slice(0,5)).toString()!=='%PDF-')return 0;try{raw=await pdfText(bytes)}catch{return 0}}
  else raw=Buffer.from(bytes).toString('utf8');
  // Reject archive error/challenge pages and wrong-bill replays, including a valid status banner without legislative body.
  const title=isPdf?raw.slice(0,4000):raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'';
  const titleBill=compact(title).match(/\b(HF|SF)\s*0*(\d+)\b/i);
  if((isPdf?billIdentifier(title):titleBill?titleBill[1].toUpperCase()+Number(titleBill[2]):null)!==job.identifier)return 0;
  let parsed;
  if(isPdf)parsed={rawText:raw,originalBody:null,extractedTextSha256:hash(raw)};
  else try{parsed=captureOfficialRevisorHtml(bytes)}catch{return 0}
  if(parsed.rawText.length<100||!/(?:A bill for an act|Section 1\.|Be it enacted)/i.test(parsed.rawText))return 0;
  const u=new URL(job.source_url),parts=u.pathname.match(/(versions\/(?:\d+|ue\/\d+|ccr\/[A-Za-z0-9]+)\/)(?:pdf\/)?$/i)!;
  const locator=parts[1],family=/\/ue\//i.test(locator)?'unofficial_engrossment':/\/ccr\//i.test(locator)?'conference_report':'numbered_version';
  // If an identical body was already captured, retain the independent archive receipt and earliest observation too.
  await pool.query(`INSERT INTO senate_official_bill_text_captures(session_id,bill_id,family,source_url,source_locator,printed_label,original_body,raw_text,
   original_body_sha256,body_hash_provenance,extracted_text_sha256,original_byte_length,content_type,fetched_at,archived_observed_at,http_status)
   VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,'fetched_original_bytes',$9,$10,$12,now(),$11,200)
   ON CONFLICT(source_url,source_locator,original_body_sha256,extracted_text_sha256) DO UPDATE SET
    archived_observed_at=LEAST(senate_official_bill_text_captures.archived_observed_at,EXCLUDED.archived_observed_at)`,
   [job.session_id,job.bill_id,family,job.source_url,locator,parsed.originalBody,parsed.rawText,originalSha,parsed.extractedTextSha256,bytes.length,observed,isPdf?'application/pdf':'text/html']);
  return 1;
 }
 if(job.kind==='role_pdf'&&Buffer.from(bytes.slice(0,5)).toString()!=='%PDF-')return 0;
 const session=getMinnesotaHouseSession(job.slug);let body:string;
 try{body=job.kind==='role_pdf'?await pdfText(bytes):Buffer.from(bytes).toString('utf8')}catch{return 0}
 const roles=job.kind==='role_pdf'?parseSenateAssignmentPdfText(body,session).roles
  :job.source_url.includes('/legdb/')?parseLrlSenateRoles({html:body,session,lrlId:new URL(job.source_url).searchParams.get('ID')??'',fallbackName:''})
  :job.source_url.includes('/members')?parseSenateLeadershipRoles(body,session):parseSenateCommitteeRoles(body,session);
 return storeHistoricalRoles(pool,roster,{sessionId:job.session_id,slug:job.slug,sourceUrl:job.source_url,archiveUrl,body,originalSha,
  observedAt:observed,kind:job.kind==='role_pdf'?'archived_pdf':'archived_html',roles});
}
export async function recoverHistoricalArchives(pool:Pool,options:{maxJobs?:number;fetchImpl?:typeof fetch;sleep?:(ms:number)=>Promise<void>}={}){
 const max=options.maxJobs??18;if(!Number.isInteger(max)||max<1||max>60)throw Error('Invalid historical archive batch');
 const fetcher=options.fetchImpl??fetch,sleep=options.sleep??(ms=>new Promise(r=>setTimeout(r,ms))),roster=await historyRoster(pool);
 const jobs=(await pool.query<Job>(`WITH ranked AS(SELECT q.*,s.slug,b.identifier,
  row_number() OVER(PARTITION BY s.slug,CASE WHEN q.kind='bill_text' THEN 'text' ELSE 'role' END
   ORDER BY CASE WHEN q.kind='role_pdf' THEN 0 WHEN q.source_url LIKE '%/members%' THEN 1
    WHEN q.source_url LIKE '%/committees/%' THEN 2 ELSE 3 END,q.attempts,q.job_key) AS rank
  FROM senate_historical_source_jobs q JOIN legislative_sessions s ON s.id=q.session_id LEFT JOIN bills b ON b.id=q.bill_id
  WHERE q.status='pending' OR(q.status='failed' AND q.attempts<3 AND q.checked_at<now()-interval '6 hours')
   OR(q.status='unavailable' AND q.attempts<3 AND q.checked_at<now()-interval '30 days'))
  SELECT * FROM ranked ORDER BY rank,kind,slug LIMIT $1`,[max])).rows;
 const summary={jobs:0,archiveBodies:0,billTexts:0,roleItems:0,unparsed:0,unavailable:0,throttled:false};
 class ArchiveUnavailable extends Error{}
 const get=async(url:string)=>{await sleep(1250);try{return await fetcher(url,{redirect:'error',headers:{'User-Agent':'VotePredict/2.0 historical Senate source research'},signal:AbortSignal.timeout(20000)})}catch{throw new ArchiveUnavailable()}};
 const read=async(response:Response,cap:number)=>{try{return await boundedBody(response,cap)}catch{throw new ArchiveUnavailable()}};
 for(const job of jobs){
  if(!validHistorySource(job.kind,job.source_url))throw Error('Untrusted queued history URL');
  let status='complete',error:string|null=null,captured=0;
  try{
   const index=await get('https://web.archive.org/cdx/search/cdx?url='+encodeURIComponent(job.source_url)+
    '&matchType=exact&from='+job.slug.slice(0,4)+'&to='+job.slug.slice(5)+'&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&collapse=timestamp:6&limit=48');
   if([429,503].includes(index.status)){summary.throttled=true;break;}
   if(!index.ok)throw new ArchiveUnavailable();
   const indexBytes=await read(index,200000);let payload:unknown;
   try{payload=JSON.parse(Buffer.from(indexBytes).toString('utf8'))}catch{throw new ArchiveUnavailable()}
   const stamps=archiveCaptures(payload,job.source_url,job.slug);
   if(!stamps.length){status='unavailable';summary.unavailable++;}
   for(const {stamp,original} of stamps){
    const observed=archiveTimestamp(stamp);if(!observed)continue;
    const archiveUrl=`https://web.archive.org/web/${stamp}id_/${original}`;
    if((await pool.query("SELECT 1 FROM senate_historical_archive_attempts WHERE job_key=$1 AND archive_url=$2 AND outcome IN ('captured','unparsed')",[job.job_key,archiveUrl])).rows.length)continue;
    const response=await get(archiveUrl);
    if([429,503].includes(response.status)){summary.throttled=true;break;}
    let bodySha:string|null=null,outcome='unavailable';
    const memento=response.headers.get('memento-datetime');
    if(response.ok&&(!memento||Date.parse(memento)===Date.parse(observed))){
     const bytes=await read(response,job.kind==='role_pdf'||job.source_url.endsWith('/pdf/')?30_000_000:8_000_000);bodySha=hash(bytes);
     const count=await captureArchivedHistory(pool,job,stamp,bytes,roster,original);
     outcome=count?'captured':'unparsed';captured+=count;summary.archiveBodies++;
     if(job.kind==='bill_text')summary.billTexts+=count;else summary.roleItems+=count;
     if(!count)summary.unparsed++;
    }else{summary.unavailable++;status='failed';error='archive_replay_unavailable_or_clock_mismatch';}
    await pool.query(`INSERT INTO senate_historical_archive_attempts(job_key,archive_url,observed_at,outcome,body_sha256)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(job_key,archive_url) DO UPDATE SET outcome=EXCLUDED.outcome,body_sha256=EXCLUDED.body_sha256,checked_at=now()`,[job.job_key,archiveUrl,observed,outcome,bodySha]);
   }
   if(summary.throttled)break;
  }catch(errorCaught){
   // Database failures must fail the run, rather than masquerading as unavailable public sources.
   if(!(errorCaught instanceof ArchiveUnavailable))throw errorCaught;
   status='failed';error='archive_fetch_or_parse_unavailable';summary.unavailable++;
  }
  await pool.query(`UPDATE senate_historical_source_jobs SET status=$2,attempts=attempts+1,checked_at=now(),captures=captures+$3,error_kind=$4 WHERE job_key=$1`,[job.job_key,status,captured,error]);
  summary.jobs++;
 }
 return summary;
}
