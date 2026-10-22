/** Independently reuses an accepted original question; no tally-only identity. */
import {sourceQueue,verifyOriginals,recoveryPlan} from './senate-864-elections-2023-original-recovery.mjs';
export const priorOriginalQueue=sourceQueue;
export function authenticatePriorQuestionOriginals(docs){
 const proof=verifyOriginals(docs).selected;
 if(proof.length!==1||proof[0].kind!=='amendment'||!proof[0].ref)throw Error('Prior exact original question bounds changed');
 return proof;
}
export function verifiedPriorQuestionEvents(proof,snapshot){
 const state={...snapshot,docs:snapshot.docs.map(d=>({...d,meeting_date:d.date,committee_name:d.committee}))};
 const p=recoveryPlan(proof,state);
 if(p.exact.length!==proof.length||p.add.length||p.addChoices.length||p.updates.length||p.holds.length)throw Error('Prior source question is not independently exact in production');
 return proof.map(q=>{
  const events=snapshot.events.filter(e=>e.external_key===q.key);
  if(events.length!==1)throw Error('Prior stable source question key is not unique');
  return {eventId:events[0].id,bill:q.bill,date:q.date,kind:q.kind,amendmentRef:q.ref,sourceQuestion:q.question,originalSourceSha256:q.sourceSha,originalSourceUrl:q.sourceUrl,stableQuestionKey:q.key,independentlyAuthenticated:true};
 });
}
