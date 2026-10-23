/** Deterministic source-only triage. Occurrences and parser fragments are not votes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {extractRowRollQuestions,sha} from '../src/evidence/senate-864-population-named-rolls.mjs';
export const INPUT='docs/evaluation/source-proof/senate-864-population-original-inventory-20261023.json';
export const INPUT_SHA='9101684f03085f6d299cd74dfbed60de0ca0852ce539106afece547941383c4d';
const reopening={question_identity:'Authenticate the complete distinct parliamentary question, including oral/renewed/withdrawn relationships, with exact named sides and outcome; validate a reusable extractor before admitting it.',nonbill_question:'Validate separate nonbill-question identity and storage semantics, with complete printed named sides, tally and explicit outcome; do not assign a nearby bill.',printed_outcome:'Acquire or extract an authenticated explicit result uniquely bound to this complete question and every printed named side; do not infer it from the slate.',printed_tally_or_incomplete_rows:'Authenticate a complete contiguous named list and agreeing printed tally for this exact question; missing labels or fragmented pages cannot supply inferred choices.'};
const count=items=>Object.fromEntries([...new Set(items)].sort().map(k=>[k,items.filter(x=>x===k).length]));
function primary(holds){
 if(holds.some(h=>/compound|withdrawn|unresolved_amendment|contradictory_bill/.test(h)))return 'question_identity';
 if(holds.includes('unresolved_bill_or_nonbill_question'))return 'nonbill_question';
 if(holds.includes('ambiguous_or_missing_printed_outcome'))return 'printed_outcome';
 return 'printed_tally_or_incomplete_rows';
}
export const RENEWAL_INPUT={path:'docs/evaluation/source-proof/senate-864-population-original-inventory-20261023-explicit-labels.json',sha256:'685f08e5e3645fa8262d04876102e9dbbf529dcf0e7c33c669c84d67348b71ea'};
export function buildHeldTriage(bytes=readFileSync(INPUT),pin={path:INPUT,sha256:INPUT_SHA}){
 if(![{path:INPUT,sha256:INPUT_SHA},RENEWAL_INPUT].some(p=>p.path===pin.path&&p.sha256===pin.sha256)||sha(bytes)!==pin.sha256)throw Error('Frozen population input changed');
 const input=JSON.parse(bytes),before=[],after=[],newWitnesses=[],allProven=new Map(),oldKeys=new Set();
 const candidates=input.originals.filter(d=>d.candidateOriginalExtractedText);
 for(const d of candidates)for(const q of d.rowQuestions.filter(q=>q.confidence==='source_proven_question'))oldKeys.add(q.questionKey);
 for(const d of candidates){
  if(sha(d.candidateOriginalExtractedText)!==d.extractedTextSha256)throw Error('Authenticated source text hash mismatch');
  const qs=extractRowRollQuestions(d.candidateOriginalExtractedText,{date:d.date,committee:d.committee,session_slug:d.session});
  const item=q=>({sourceId:d.sourceId,sourceUrl:d.sourceUrl,originalSha256:d.originalSha256,textSha256:d.extractedTextSha256,date:d.date,committee:d.committee,format:d.format,questionKey:q.questionKey||null,motionText:q.motionText||null,holds:q.holds,primaryCause:primary(q.holds),reopeningCondition:reopening[primary(q.holds)]});
  for(const q of d.rowQuestions.filter(q=>q.confidence==='held_question'))before.push(item(q));
  for(const q of qs){
   if(q.confidence==='held_question'){after.push({...item(q),sourceOffset:q.sourceOffset,printedChoiceOccurrences:q.choices.length});continue;}
   allProven.set(q.questionKey,q);
   if(!d.rowQuestions.some(old=>old.confidence==='source_proven_question'&&old.questionKey===q.questionKey))newWitnesses.push({...item(q),choices:q.choices.length,yea:q.yea,nay:q.nay,passed:q.passed,alreadyProvenFromAnotherOriginal:oldKeys.has(q.questionKey)});
  }
  for(const old of d.rowQuestions.filter(q=>q.confidence==='source_proven_question')){
   const now=qs.find(q=>q.confidence==='source_proven_question'&&q.questionKey===old.questionKey);
   if(!now||now.choices.length!==old.choices||now.fullQuestionPassageSha256!==old.sourcePassageSha256)throw Error('Previously proven complete question changed');
  }
 }
 const newKeys=[...allProven].filter(([k])=>!oldKeys.has(k)).map(([questionKey,q])=>({questionKey,billIdentifier:q.billIdentifier,amendmentRef:q.amendmentRef,choices:q.choices.length}));
 const coverage=[2022,2023,2024,2025].map(year=>{const rows=input.originals.filter(d=>d.date.startsWith(String(year)));return {year,originals:rows.length,readable:rows.filter(d=>d.readable).length,ocrVisualQualityUncertified:rows.filter(d=>d.extractionMethod==='ocr_tesseract'&&!d.ocrVisualQualityCertified).length,textNoNamedRollDetected:rows.filter(d=>d.status==='examined_no_named_roll').length,priorCertifiedQuestions:input.distinctRowQuestions.filter(q=>q.date.startsWith(String(year))).length,heldOccurrencesBefore:before.filter(d=>d.date.startsWith(String(year))).length,heldOccurrencesAfter:after.filter(d=>d.date.startsWith(String(year))).length};});
 return {schemaVersion:'senate864-held-row-triage-v1',issue:864,input:{path:pin.path,sha256:pin.sha256,reviewedCommit:input.reviewedCommit,readAt:input.readAt},extractorSha256:sha(readFileSync('src/evidence/senate-864-population-named-rolls.mjs')),sourceOnly:true,productionWrites:0,examinedCandidateOriginals:candidates.length,heldOccurrencesBefore:before.length,heldOccurrencesAfter:after.length,primaryCausesBefore:count(before.map(x=>x.primaryCause)),primaryCausesAfter:count(after.map(x=>x.primaryCause)),overlappingReasonsBefore:count(before.flatMap(x=>x.holds)),overlappingReasonsAfter:count(after.flatMap(x=>x.holds)),newlyProvenSourceWitnesses:newWitnesses,newDistinctQuestionKeys:newKeys,coverageByYear:coverage,heldOccurrences:after,limitations:['Held occurrences include duplicate originals and fragments; their decrease is not a count of recovered votes.',`${newWitnesses.length} newly proven source witnesses include ${newWitnesses.filter(q=>q.alreadyProvenFromAnotherOriginal).length} already proven keys and ${newKeys.length} new distinct keys. Production additions require separate guarded reconciliation.`,'All prior source-proven questions, choice counts and complete-passage hashes are preserved.','The 247 OCR originals remain visually uncertified; text-negative findings do not prove no named roll.','Six missing-Minutes dates, the acquired unparseable Finance PDF, date/attendance conflicts, cross-original aliases and 2021/2022 print equivalence remain held.','Remaining questions require exact independent evidence or a separately validated complete-question extractor; no tally/slate inference or speculative reconstruction is admitted.']};
}
if(process.argv[1]===import.meta.filename){const report=process.argv[3]==='renewal'?buildHeldTriage(readFileSync(RENEWAL_INPUT.path),RENEWAL_INPUT):buildHeldTriage();if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');else console.log(JSON.stringify(report,null,2));}
