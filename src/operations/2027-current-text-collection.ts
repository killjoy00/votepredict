import { createHash } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { classify2027CollectionUrl,collectionSourceFetch,getArchivedCollectionResponse,COLLECTION_LIMITS } from '@/sources/minnesota/2027-collection-source';
import { parseRevisorBillTextHtml } from '@/sources/minnesota/revisor';
import { retainRuntimeBillText } from '@/forecasting/runtime-bill-text';
import { DAILY_COLLECTION_SOURCE_RECEIPT_TYPE } from './2027-daily-collection';

const sha=(body:Buffer|string)=>createHash('sha256').update(body).digest('hex');
export const CURRENT_TEXT_BINDING_TYPE='application/vnd.votepredict.2027-current-text-binding+json';

type Target={bill_id:string;version_id:string;identifier:string;version_key:string;title:string;text_url:string;published_at:string;status_at:string};

export function assert2027CurrentTextUrl(identifier:string,versionKey:string,sourceUrl:string):void{
  if(classify2027CollectionUrl(sourceUrl)!=='current_text')throw Error('Expected numbered official engrossment URL');
  const id=/^(HF|SF)([1-9]\d*)$/.exec(identifier);
  const key=/^(2027|2028)\.0-(HF|SF)(\d+)-([1-9]\d{0,3})$/.exec(versionKey);
  const path=/^\/bills\/95\/(?:(2027|2028)\/0\/)?(HF|SF)\/(\d+)\/versions\/([1-9]\d{0,3})\/?$/.exec(new URL(sourceUrl).pathname);
  if(!id||!key||!path||key[2]!==id[1]||Number(key[3])!==Number(id[2])||path[2]!==id[1]||
    Number(path[3])!==Number(id[2])||key[4]!==path[4]||(path[1]&&key[1]!==path[1]))
    throw Error('Current version identity mismatch');
}

export async function fetch2027CurrentText(target:Pick<Target,'identifier'|'version_key'|'text_url'>){
  assert2027CurrentTextUrl(target.identifier,target.version_key,target.text_url);
  const response=await collectionSourceFetch(target.text_url,{headers:{'User-Agent':'VotePredict/2.0 bounded official Minnesota bill-text collector'},signal:AbortSignal.timeout(20000)});
  const proof=getArchivedCollectionResponse(response);
  if(!proof||proof.receipt.sourceKind!=='current_text'||proof.receipt.sourceUrl!==target.text_url||
    proof.receipt.httpStatus!==200)throw Error('Current text requires a retained acquisition receipt');
  const raw=Buffer.from(await response.arrayBuffer());
  if(sha(raw)!==proof.receipt.responseBodySha256)throw Error('Current text raw digest mismatch');
  const parsed=parseRevisorBillTextHtml(raw.toString('utf8').replace(/^\uFEFF/,''));
  return {text:parsed.text,textSha256:parsed.sha256,...proof};
}

async function selectTargets(db:Pick<Pool,'query'>,limit:number){
  const result=await db.query<Target>(`
    SELECT b.id::text AS bill_id,bv.id::text AS version_id,b.identifier,bv.version_key,b.title,bv.text_url,
      bv.published_at::text AS published_at,b.metadata #>> '{revisorLiveStatus,fetchedAt}' AS status_at
    FROM bills b
    JOIN legislative_sessions s ON s.id=b.session_id AND s.slug='2027-2028' AND s.is_current
    JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
    JOIN bill_versions bv ON bv.bill_id=b.id AND bv.version_key=b.metadata #>> '{revisorLiveStatus,currentVersion,documentName}'
      AND bv.text_url=b.metadata #>> '{revisorLiveStatus,currentVersion,htmlUrl}'
    WHERE b.metadata #>> '{revisorUniverse,liveSync}'='true'
      AND b.metadata #>> '{revisorLiveStatus,currentVersionKind}'='engrossment'
      AND b.metadata #>> '{revisorLiveStatusAttempt,state}'='succeeded'
      AND (b.metadata #>> '{revisorLiveStatus,fetchedAt}')::timestamptz >= now()-interval '24 hours'
      AND bv.published_at <= now()
      AND (b.metadata #>> '{revisorCurrentTextCapture,versionKey}' IS DISTINCT FROM bv.version_key
           OR b.metadata #>> '{revisorCurrentTextCapture,receiptSha256}' IS NULL)
    ORDER BY (b.metadata #>> '{revisorCurrentTextAttempt,attemptedAt}')::timestamptz NULLS FIRST,b.identifier
    LIMIT $1`,[limit]);
  return result.rows;
}

async function persist(db:Pool,target:Target,observed:Awaited<ReturnType<typeof fetch2027CurrentText>>){
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='10s'");
    // Recheck current version and status snapshot while locking both rows.
    const row=(await client.query<{title:string;raw_text:string|null;text_hash:string|null}>(`
      SELECT b.title,bv.raw_text,bv.text_hash FROM bills b JOIN bill_versions bv ON bv.bill_id=b.id
      JOIN legislative_sessions s ON s.id=b.session_id AND s.slug='2027-2028' AND s.is_current
      WHERE b.id=$1 AND bv.id=$2 AND bv.version_key=$3 AND bv.text_url=$4 AND bv.published_at=$5::timestamptz
        AND b.metadata #>> '{revisorLiveStatus,currentVersion,documentName}'=$3
        AND b.metadata #>> '{revisorLiveStatus,currentVersion,htmlUrl}'=$4
        AND b.metadata #>> '{revisorLiveStatus,fetchedAt}'=$6
        AND b.metadata #>> '{revisorLiveStatusAttempt,state}'='succeeded'
        AND b.metadata #>> '{revisorLiveStatus,currentVersionKind}'='engrossment'
      FOR UPDATE OF b,bv`,[target.bill_id,target.version_id,target.version_key,target.text_url,target.published_at,target.status_at])).rows[0];
    if(!row)throw Error('Current version/status changed during collection');
    if(row.title!==target.title)throw Error('Bill title changed during collection');
    if((row.raw_text!==null&&row.raw_text!==observed.text)||(row.text_hash!==null&&row.text_hash!==observed.textSha256))
      throw Error('Existing official version text differs; refusing rewrite');
    const stored=(await client.query<{body:Buffer;raw_body:Buffer}>(`
      SELECT receipt.body,raw.body AS raw_body FROM evidence_content_blobs receipt
      JOIN evidence_content_blobs raw ON raw.sha256=$2
      WHERE receipt.sha256=$1 AND receipt.media_type=$3`,
      [observed.receiptSha256,observed.receipt.responseBodySha256,DAILY_COLLECTION_SOURCE_RECEIPT_TYPE])).rows[0];
    if(!stored||sha(stored.body)!==observed.receiptSha256||
      stored.body.toString('utf8')!==JSON.stringify(observed.receipt)||sha(stored.raw_body)!==observed.receipt.responseBodySha256||
      Date.parse(observed.receipt.observedAt)<Date.parse(target.published_at))
      throw Error('Missing or inconsistent current-version archive proof');
    const retained=await retainRuntimeBillText(client,{billId:target.bill_id,billVersionId:target.version_id,
      versionKey:target.version_key,sourceUrl:target.text_url,claimedPublishedAt:target.published_at,
      observedAt:observed.receipt.observedAt,text:observed.text,title:target.title});
    if(retained.textSha256!==observed.textSha256)throw Error('Parsed text digest mismatch');
    const binding={schemaVersion:'2027-current-text-binding-v1',session:'2027-2028',billId:target.bill_id,
      versionId:target.version_id,versionKey:target.version_key,statusObservedAt:target.status_at,
      sourceUrl:target.text_url,receiptSha256:observed.receiptSha256,rawSha256:observed.receipt.responseBodySha256,
      textSha256:retained.textSha256,observationId:retained.id,observedAt:retained.observedAt};
    const bytes=Buffer.from(JSON.stringify(binding)),bindingSha=sha(bytes);
    await client.query('INSERT INTO evidence_content_blobs(sha256,body,media_type) VALUES($1,$2,$3) ON CONFLICT(sha256) DO NOTHING',[bindingSha,bytes,CURRENT_TEXT_BINDING_TYPE]);
    const readback=(await client.query<{body:Buffer;media_type:string}>('SELECT body,media_type FROM evidence_content_blobs WHERE sha256=$1',[bindingSha])).rows[0];
    if(!readback||readback.media_type!==CURRENT_TEXT_BINDING_TYPE||!readback.body.equals(bytes))throw Error('Current text binding readback failed');
    await client.query('UPDATE bill_versions SET raw_text=COALESCE(raw_text,$2),text_hash=COALESCE(text_hash,$3) WHERE id=$1',
      [target.version_id,observed.text,observed.textSha256]);
    await client.query(`UPDATE bills SET metadata=metadata||jsonb_build_object('revisorCurrentTextCapture',$2::jsonb,'revisorCurrentTextAttempt',$3::jsonb),updated_at=now() WHERE id=$1`,
      [target.bill_id,JSON.stringify({...binding,bindingSha256:bindingSha}),JSON.stringify({attemptedAt:new Date().toISOString(),state:'succeeded'})]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

/** Only called within the protected archival worker. No latest/ redirect,
 * historical backfill, vote/forecast creation, or replacement of sealed rows. */
export async function collect2027CurrentTextBatch(db:Pool,limit=COLLECTION_LIMITS.currentTextBatch){
  if(!Number.isInteger(limit)||limit<1||limit>COLLECTION_LIMITS.currentTextBatch)throw Error('Invalid current text batch limit');
  const targets=await selectTargets(db,limit);
  let captured=0,failed=0;
  const failedIdentifiers:string[]=[];
  for(const target of targets){
    try{await persist(db,target,await fetch2027CurrentText(target));captured++;}
    catch{
      failed++;failedIdentifiers.push(target.identifier);
      await db.query(`UPDATE bills SET metadata=metadata||jsonb_build_object('revisorCurrentTextAttempt',$2::jsonb),updated_at=now()
        WHERE id=$1 AND metadata #>> '{revisorLiveStatus,currentVersion,documentName}'=$3`,
        [target.bill_id,JSON.stringify({attemptedAt:new Date().toISOString(),state:'failed'}),target.version_key]);
    }
  }
  return {selected:targets.length,captured,failed,failedIdentifiers};
}
