import type { PoolClient } from 'pg';
import { canonicalJson } from '../evidence/canonical-json';

export async function verifySealedShadowRetry(client:Pick<PoolClient,'query'>,revisionId:string,membershipId:string,shadow:Record<string,unknown>):Promise<void>{
  const row=(await client.query<{context:unknown[]}>(`SELECT context FROM forecast_member_predictions WHERE revision_id=$1 AND membership_id=$2`,[revisionId,membershipId])).rows[0];
  const matches=(row?.context??[]).filter(x=>x&&typeof x==='object'&&(x as Record<string,unknown>).kind===shadow.kind
    &&(x as Record<string,unknown>).version===shadow.version&&(x as Record<string,unknown>).experiment===shadow.experiment);
  if(matches.length!==1||canonicalJson(matches[0])!==canonicalJson(shadow))throw Error('Existing sealed shadow differs; refusing retry rewrite');
}
