/** #864: require independently authenticated original HTML/CDX proof for each of 72 pages before Neon. */
import {buildRecoveryPlan} from './build-senate-864-95-missing-original-recovery-plan.mjs';
import {VERIFIED} from './verify-senate-864-72-original-artifact-bytes.mjs';
export const PROOF_SCHEMA='senate-864-95-72-historic-original-html-cdx-verified-v1';
function witnessId(w){return JSON.stringify([w.senatorOrdinal,w.pageOrdinalWithinSenator,w.originalUrl,w.originalHtmlSha256]);}
export function assertVerified72Proof(proof,plan=buildRecoveryPlan()){
 if(!proof||proof.schema!==PROOF_SCHEMA||proof.senators!==34||proof.originalPages!==72
  ||proof.readOnlyOriginalPublicSourceArtifactVerification!==true
  ||proof.neonWrites!==0||proof.noProductionForecastOrSourcePromotion!==true
  ||!Array.isArray(proof.results)||proof.results.length!==72
  ||!Array.isArray(plan.witnesses)||plan.witnesses.length!==72)
  throw Error('Historic source proof envelope missing or untrusted');
 const targets=new Map(plan.witnesses.map(w=>[witnessId(w),w]));
 if(targets.size!==72)throw Error('Original source plan contains duplicates');
 const seen=new Set();
 for(const actual of proof.results){
  const id=witnessId(actual),expected=targets.get(id);
  if(!expected||seen.has(id)||actual.status!==VERIFIED
   ||expected.recoveryState!=='READY_FOR_INDEPENDENT_BYTE_VERIFICATION'
   ||actual.originalArchiveCapturedAtUtc!==expected.originalArchiveCapturedAtUtc
   ||actual.originalResearchLedgerPath!==expected.originalResearchLedgerPath
   ||actual.originalHtmlArtifactFile!==expected.originalHtmlArtifactFile
   ||actual.historicalSourceArtifactId!==expected.historicalSourceArtifactId
   ||actual.independentCdxArtifactId!==expected.independentCdxArtifactId)
   throw Error('Historic source bytes have not been independently verified');
  seen.add(id);
 }
 if(seen.size!==72||proof.statuses?.[VERIFIED]!==72
  ||Object.values(proof.statuses||{}).reduce((a,n)=>a+Number(n),0)!==72)
  throw Error('Original historical source holds remain');
 return plan.witnesses;
}
