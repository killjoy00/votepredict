/** New question only: did missing donor registrations originate in the CSV? */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseCfbCandidateContributionCsv} from '../src/evidence/cfb-candidate-finance-history.js';
import {main as existingSourceAudit} from './audit-cfb-pac116-original-a1-geometry-readonly.mjs';
import {reconcileHeldPacComparators} from '../src/evidence/senate-864-pac-comparator-source.mjs';
export const MARKER='SENATE864_PAC23_EXACT_CURRENT_ORIGINAL_COMPARATOR_20261019_V1';
const URL='https://register.cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2026985457';
const SHA='09d3da4b4ba313698638ed8f2dc76acd99d830881bbf95e3b3449e14042f21f7';
export async function originalComparatorRows(){
 const r=await fetch(URL,{redirect:'error',signal:AbortSignal.timeout(120000)});
 if(r.status!==200||!r.body)throw Error('Original source unavailable');
 const chunks=[];let n=0;const reader=r.body.getReader();
 try{for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>50_000_000)throw Error('Original byte bound');chunks.push(x.value)}}finally{reader.releaseLock()}
 const bytes=Buffer.concat(chunks,n);
 if(n!==39883429||createHash('sha256').update(bytes).digest('hex')!==SHA)throw Error('Reviewed current regulator source changed');
 const rows=parseCfbCandidateContributionCsv(bytes.toString('utf8'),{fromYear:2021,toYear:2025});
 if(rows.length>300000||rows.length<1000)throw Error('Original source schema/count hold');
 return rows;
}
async function main(){
 let phase='original_public_source';
 try{
  const originalRows=await originalComparatorRows();
  if(process.argv[2]==='--source-only'){console.log('SENATE864_PAC23_CURRENT_ORIGINAL_SHA_VERIFIED');return}
  phase='reviewed_main_guard';const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));
  if(process.argv.length!==2||e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
   e.GITHUB_RUN_ATTEMPT!=='1'||e.SENATE864_INDEPENDENT_MAIN!=='true'||event.after!==e.GITHUB_SHA||event.head_commit?.id!==e.GITHUB_SHA||
   event.forced||event.deleted||event.repository?.full_name!==e.GITHUB_REPOSITORY||!event.head_commit?.message?.includes(MARKER))throw Error('Guarded exact main required');
  let receipt;phase='existing_unchanged_candidates_and_source_comparison';
  await existingSourceAudit({inspectTwoOriginalPages:async({client,cohort,allRows,positionedOutcomes})=>{
   const tx=(await client.query("SELECT current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
   if(tx.ro!=='on'||tx.isolation!=='repeatable read')throw Error('Transaction unverified');
   receipt=reconcileHeldPacComparators({cohort,allRows,outcomes:positionedOutcomes,originalRows});
  }});
  if(!receipt)throw Error('No bounded comparator readback');
  console.log('SENATE864_PAC23_ORIGINAL_COMPARATOR_RECEIPT='+JSON.stringify({...receipt,verifiedRepeatableReadReadOnly:true,explicitRollback:true,
   currentRegulatorSourceSha256:SHA,currentRegulatorSourceBytes:39883429}));
 }catch{console.error('SENATE864_PAC23_ORIGINAL_HOLD_AT='+phase);process.exitCode=1}
}
if(process.argv[1]?.endsWith('/audit-senate-864-pac-comparator-originals.mjs'))void main();
