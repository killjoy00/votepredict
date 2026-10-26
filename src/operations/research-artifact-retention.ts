import { canonicalJson as canonical } from '../evidence/canonical-json';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import type { Pool } from 'pg';
import pins from '../../data/evaluation/research-artifact-retention-v1.json';

export const RESEARCH_ARTIFACT_PINS=pins.pins;
export type ArtifactPin=typeof pins.pins[number];
const digest=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');

/** Verify ZIP bytes before decoding any member. Never emit data rows or model parameters. */
export function verifyResearchArtifact(path:string,pin:ArtifactPin): Record<string,unknown> {
  if(digest(readFileSync(path))!==pin.archiveSha256)throw Error('Original research archive digest mismatch');
  const decoded=JSON.parse(execFileSync('python3',['-c',`
import zipfile,hashlib,json,gzip,sys,base64
with zipfile.ZipFile(sys.argv[1]) as z:
 result={'members':{n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}}
 if 'model.json' in z.namelist():result['modelBase64']=base64.b64encode(z.read('model.json')).decode()
 for n in z.namelist():
  if n.endswith('.ndjson.gz'):
   h=hashlib.sha256();rows=0;size=0
   with gzip.GzipFile(fileobj=z.open(n)) as stream:
    while True:
     b=stream.read(1048576)
     if not b:break
     size+=len(b)
     if size>400000000:raise ValueError('Oversize research matrix')
     h.update(b);rows+=b.count(b'\\n')
   result['matrixSha256']=h.hexdigest();result['matrixRows']=rows
 print(json.dumps(result))`,path],{maxBuffer:2000000,encoding:'utf8'})) as {
    members:Record<string,string>;modelBase64?:string;matrixSha256?:string;matrixRows?:number;
  };
  if(JSON.stringify(Object.keys(decoded.members).sort())!==JSON.stringify(Object.keys(pin.members).sort())
    || Object.entries(pin.members).some(([name,sha])=>decoded.members[name]!==sha))throw Error('Research archive internal member mismatch');
  const result:Record<string,unknown>={members:decoded.members};
  if(pin.artifactId===10772991611){
    const model=JSON.parse(Buffer.from(decoded.modelBase64!,'base64').toString('utf8'));
    const sha=digest(JSON.stringify(model.modelContent));
    if(sha!=='abcf583153939d46aa021dccf2afe61d698ad4538a981059cdee265c03166a65'||model.modelContentSha256!==sha)
      throw Error('Frozen P8 model content mismatch');
    result.modelContentSha256=sha;
  }
  if(pin.artifactId===11494634289){
    if(decoded.matrixSha256!=='2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b'||decoded.matrixRows!==135457)
      throw Error('Frozen v1.8 matrix mismatch');
    result.matrixSha256=decoded.matrixSha256;result.matrixRows=decoded.matrixRows;
  }
  return result;
}

export async function archiveResearchArtifacts(db:Pool,files:ReadonlyMap<number,string>): Promise<Array<{artifactId:number;sha256:string;verified:true}>> {
  const result:Array<{artifactId:number;sha256:string;verified:true}>=[];
  for(const pin of RESEARCH_ARTIFACT_PINS){
    const path=files.get(pin.artifactId);if(!path)throw Error('Missing pinned artifact file');
    const internal=verifyResearchArtifact(path,pin),body=readFileSync(path),client=await db.connect();
    try{
      await client.query('BEGIN');
      await client.query(`INSERT INTO evidence_content_blobs(sha256,body,media_type) VALUES($1,$2,'application/zip') ON CONFLICT(sha256) DO NOTHING`,[pin.archiveSha256,body]);
      await client.query(`INSERT INTO research_artifact_archive(artifact_id,workflow_run_id,archive_sha256,original_name,original_expires_at,internal_digests)
        VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(artifact_id) DO NOTHING`,[pin.artifactId,pin.runId,pin.archiveSha256,pin.name,pin.expiresAt,JSON.stringify(internal)]);
      const stored=(await client.query<{archive_sha256:string;body:Buffer;internal_digests:Record<string,unknown>}>(`
        SELECT a.archive_sha256,b.body,a.internal_digests FROM research_artifact_archive a JOIN evidence_content_blobs b ON b.sha256=a.archive_sha256 WHERE a.artifact_id=$1`,[pin.artifactId])).rows[0];
      if(!stored||stored.archive_sha256!==pin.archiveSha256||digest(stored.body)!==pin.archiveSha256
        || canonical(stored.internal_digests)!==canonical(internal))throw Error('Durable artifact readback mismatch');
      await client.query('COMMIT');
      result.push({artifactId:pin.artifactId,sha256:pin.archiveSha256,verified:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  return result;
}

/** Restore only from retained DB bytes; no GitHub or public source access. */
export async function restoreResearchArtifact(db:Pick<Pool,'query'>,pin:ArtifactPin,path:string):Promise<void>{
  const row=(await db.query<{body:Buffer}>(`SELECT b.body FROM research_artifact_archive a JOIN evidence_content_blobs b ON b.sha256=a.archive_sha256 WHERE a.artifact_id=$1 AND a.archive_sha256=$2`,[pin.artifactId,pin.archiveSha256])).rows[0];
  if(!row)throw Error('Pinned durable artifact unavailable');writeFileSync(path,row.body,{flag:'wx'});verifyResearchArtifact(path,pin);
}
