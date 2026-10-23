/** Exact same-original amendments can distinguish a separately restated renewal.
 * The original question, every named side, tally, outcome and historical identity
 * must be independently exact before any stored event is excluded as different.
 */
import {extractRowRollQuestions,reconcileRowQuestion} from './senate-864-population-named-rolls.mjs';
export function verifyPriorAmendmentsForRenewal(originals,snapshot){
 const {pins}=originals;
 if(pins.expectedPriorQuestions!==3||pins.expectedPriorChoices!==40||pins.priorQuestions?.length!==3||pins.questions.length!==1)throw Error('Renewal prior-source bounds changed');
 const target=pins.questions[0];
 if(target.voteKind!=='motion'||target.amendmentRef!==null)throw Error('Renewal must be a distinct complete recommendation');
 const proof=[];
 for(const spec of pins.priorQuestions){
  const source=originals.docs.find(d=>d.url===spec.sourceUrl),stored=snapshot.docs.find(d=>d.source_url===source?.url);
  if(!source||!stored||source.url!==target.sourceUrl||spec.billIdentifier!==target.billIdentifier||spec.voteKind!=='amendment'||!spec.amendmentRef)throw Error('Prior amendment is not from the same authenticated original/bill');
  const doc={...source,...stored,text:source.text,authenticated:true};
  const matches=extractRowRollQuestions(source.text,doc).filter(q=>q.questionKey===spec.questionKey&&q.confidence==='source_proven_question');
  if(matches.length!==1)throw Error('Prior original amendment is not uniquely complete');
  const q=matches[0];
  if(['motionText','billIdentifier','amendmentRef','voteKind','passed','yea','nay','fullQuestionPassageSha256'].some(k=>JSON.stringify(q[k])!==JSON.stringify(spec[k])))throw Error('Prior original question proof drift');
  const result=reconcileRowQuestion(q,doc,{...snapshot,verifiedPriorQuestions:[]});
  const e=snapshot.events.find(e=>e.id===result.eventId);
  if(result.status!=='exact'||!e||e.source_document_id!==doc.id)throw Error('Prior original amendment/choices are not independently exact in production');
  proof.push({eventId:e.id,bill:q.billIdentifier,date:doc.date,kind:q.voteKind,amendmentRef:q.amendmentRef,sourceQuestion:q.motionText,sourceUrl:source.url,sourceTextSha256:source.textSha256,completePassageSha256:q.fullQuestionPassageSha256,questionKey:q.questionKey,choices:q.choices.length,independentlyAuthenticated:true});
 }
 if(new Set(proof.map(p=>p.eventId)).size!==3||new Set(proof.map(p=>p.amendmentRef)).size!==3||proof.reduce((n,p)=>n+p.choices,0)!==40)throw Error('Prior distinct amendment/choice bounds changed');
 return proof;
}
