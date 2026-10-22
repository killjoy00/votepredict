/** #864 source inventory and fail-closed recovery of explicitly printed row-form rolls.
 * Source offsets locate evidence only. Persistent identity uses the entire bounded
 * question, committee, hearing/session and bill. No tally/slate-derived identity.
 */
import {createHash} from 'node:crypto';
import {parseSenateCommitteeMinuteVotes} from './minnesota-senate-committee-minutes.ts';
import {parseSenateCommitteeMinutesRaw} from '../sources/minnesota/senate-raw-votes.ts';
import {extractSupplementalNamedSenateRollCandidates} from './senate-committee-supplemental-named-roll-review.ts';
export const VERSION='senate864-population-named-rolls-v1';
export const MARKER='SENATE864_POPULATION_ROW_ROLLS_V1';
export const sha=s=>createHash('sha256').update(s).digest('hex');
export const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const compact=s=>s.replace(/\s+/g,' ').trim();
const canonical=s=>norm(s.replace(/\b([HS])\s*\.?\s*F\s*\.?\s*0*(\d+)\b/gi,(_,a,b)=>a+'F'+Number(b)).replace(/\bA-(\d+)/gi,'A$1'));
const bills=s=>[...new Set([...s.matchAll(/\b([HS])\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?0*(\d+)\b/gi)].map(m=>m[1].toUpperCase()+'F'+Number(m[2])))];
const ref=s=>String(s||'').toUpperCase().replace(/[-\s]/g,'');
const ROW=/^\s*(?:Senator|Sen\.)\s+(.+?)\s*[-–—:]\s*(Yea|Yeas|Aye|Yes|Nay|No|Absent|Excused|Pass|Abstain(?:ed)?|Not Voting)\s*\.?\s*$/i;
const MOTION=/\b(?:Senator|Vice\s+Chair|Chair|Lead)\s+([\p{L}.'-]+(?:\s+(?!Senator\b)[\p{L}.'-]+){0,3}?)\s+(?:moved|moves|offered|offers)\b/giu;
const OUTCOME=/\b(?:the\s+)?(?:motion|amendment)\s+(?:was\s+|is\s+)?(did not prevail|did not carry|not adopted|failed|fails|lost|prevailed|prevails|passed|carried|adopted)\b/gi;
function tally(s){
 const p=[/\b(\d{1,2})\s+(?:yeas?|ayes?|yes)(?:\s+votes?)?\s*(?:,\s*(?:and\s+)?|and\s+|to\s+)(\d{1,2})\s+(?:nays?|nay|noes?|no)\b/i,
 /\b(?:vote\s+(?:of\s+)?|roll\s+call\s*(?:vote\s*)?)(\d{1,2})\s*[/–-]\s*(\d{1,2})\b/i];
 for(const re of p){const m=s.match(re);if(m)return {yea:Number(m[1]),nay:Number(m[2])};}return null;
}
function fullRoster(text){
 const stop=text.search(/called\s+the\s+meeting\s+to\s+order/i);
 if(stop<0||stop>4000)return [];
 const header=text.slice(0,stop);
 return [...header.matchAll(/\bSenator\s+([^,\n]+)(?=,|\n|$)/gi)].map(m=>m[1]
 .replace(/\s*-\s*.*$/,'').replace(/\s+(?:Vice\s+Chair|Chair|Ranking.*|Minority.*)$/i,'').trim())
 .filter(n=>norm(n).split(' ').length>=2);
}
const fullKeys=s=>{const p=norm(s).split(' ').filter(x=>x.length>1);return new Set([norm(s),p.join(' '),p.length>=2?p[0]+' '+p.at(-1):'']);};
export function resolvePrintedHistoricalChoices(q,text,roster,doc){
 const printed=[...new Set(fullRoster(text))],out=[];
 for(const v of q.choices){
  const short=norm(v.name);
  const names=printed.filter(n=>norm(n)===short||norm(n).endsWith(' '+short));
  if(names.length!==1)throw Error('full_printed_identity_ambiguous');
  const keys=fullKeys(names[0]);
  const active=roster.filter(m=>m.session_slug===doc.session_slug&&m.starts_on&&m.ends_on&&m.starts_on<=doc.date&&m.ends_on>=doc.date&&
   [...fullKeys(m.name)].some(k=>k&&keys.has(k)));
  if(active.length!==1)throw Error('historical_full_identity_or_service_hold');
  out.push({...v,fullName:names[0],membershipId:active[0].membership_id});
 }
 if(new Set(out.map(v=>v.membershipId)).size!==out.length)throw Error('contradictory_person_sides');
 return out;
}
/** Exact row labels independently identify choices; attendance supplies full names only. */
export function extractRowRollQuestions(text,doc){
 const lines=text.split('\n'),starts=[];let offset=0;
 for(const line of lines){starts.push(offset);offset+=line.length+1;}
 const rows=[];
 for(let i=0;i<lines.length;i++){
  if(!ROW.test(lines[i]))continue;
  const start=i,entries=[];
  while(i<lines.length){
   const m=lines[i].match(ROW);
   if(m){entries.push({name:m[1].trim(),label:m[2],choice:/^(?:yea|yeas|aye|yes)$/i.test(m[2])?'yea':/^(?:nay|no)$/i.test(m[2])?'nay':'other'});i++;}
   else if(!lines[i].trim()||/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/.test(lines[i]))i++;
   else break;
  }
  const end=i,choices=entries.filter(v=>v.choice!=='other').map(({name,choice})=>({name,choice}));i--;
  if(choices.length<2)continue;
  const before=text.slice(0,starts[start]),intros=[...before.matchAll(MOTION)],intro=intros.at(-1);
  const row={format:'individual_labeled_rows',sourceOffset:starts[start],sourceEnd:starts[end]??text.length,choices,excludedOtherLabels:entries.length-choices.length,confidence:'held_question',holds:[]};
  if(!intro){row.holds.push('no_explicit_motion_introduction');rows.push(row);continue;}
  const at=intro.index,question=compact(text.slice(at,starts[start]));
  row.motionText=question;row.mover=intro[1];
  if(question.length>1800||question.length<15)row.holds.push('unbounded_motion_context');
  if(/\bwithdr(?:aw|ew|awn)|\bvoice\s+vote|\b(?:motion|amendment)\s+(?:prevailed|failed|adopted|passed)\b/i.test(question))row.holds.push('intervening_or_withdrawn_question');
  if(intros.filter(m=>m.index>=at).length!==1)row.holds.push('multiple_motion_introductions');
  // The nearest explicit bill HEADING may supply an otherwise omitted bill,
  // but a later source summary is never allowed to assign the question.
  const heads=[...before.matchAll(/^\s*([HS])\s*\.?\s*F\s*\.?\s*(\d+)\s*:/gim)];
  const head=heads.at(-1),localBills=bills(question),headerBill=head?head[1].toUpperCase()+'F'+Number(head[2]):null;
  row.billIdentifier=localBills.length===1?localBills[0]:headerBill;
  if(localBills.length>1||localBills.length===1&&headerBill&&headerBill!==localBills[0])row.holds.push('contradictory_bill_association');
  if(!row.billIdentifier)row.holds.push('unresolved_bill_or_nonbill_question');
  const references=[...new Set([...question.matchAll(/\bA-?\d{1,3}(?:-\d+)?\b/gi)].map(m=>ref(m[0])))];
  const amended=question.replace(/\bas\s+amended\b/gi,'');
  row.voteKind=/\bamend(?:ment|ed)?\b/i.test(amended)?'amendment':'motion';
  row.amendmentRef=references.length===1?references[0]:null;
  if(references.length>1||/\boral\b|\bdivide\b|\breconsider\b|\brenew/i.test(question))row.holds.push('compound_or_repeated_question');
  if(row.voteKind==='amendment'&&!row.amendmentRef)row.holds.push('unresolved_amendment_identity');
  if(new Set(choices.map(v=>norm(v.name))).size!==choices.length)row.holds.push('duplicate_or_contradictory_names');
  const tail=text.slice(starts[end]??text.length,Math.min(text.length,(starts[end]??text.length)+700));
  const next=[...tail.matchAll(MOTION)][0];
  const bounded=next?tail.slice(0,next.index):tail;
  const outcomes=[...bounded.matchAll(OUTCOME)];
  if(outcomes.length!==1)row.holds.push('ambiguous_or_missing_printed_outcome');
  else row.passed=!/not|fail|lost/i.test(outcomes[0][1]);
  const totals=tally(bounded);
  row.yea=choices.filter(v=>v.choice==='yea').length;row.nay=choices.filter(v=>v.choice==='nay').length;
  if(!totals||totals.yea!==row.yea||totals.nay!==row.nay)row.holds.push('missing_or_disagreeing_printed_tally');
  row.outcomeText=compact(bounded);
  row.questionCanonical=canonical(question);
  row.questionKey=sha(JSON.stringify([doc.session_slug,doc.committee,doc.date,row.billIdentifier,row.voteKind,row.amendmentRef,row.questionCanonical]));
  row.confidence=row.holds.length?'held_question':'source_proven_question';rows.push(row);
 }
 // Repeated identical wording is an ambiguity, never two distinguishable votes.
 for(const q of rows)if(q.questionKey&&rows.filter(r=>r.questionKey===q.questionKey).length>1){q.holds.push('duplicate_question_wording');q.confidence='held_question';}
 return rows;
}
export function inspectOriginal(doc){
 if(!doc.authenticated||!doc.text)return {document:doc,status:'unavailable_or_unparseable',questions:[],candidates:0,choiceOccurrences:0,unresolvedExtractionSignals:null};
 const rows=extractRowRollQuestions(doc.text,doc);
 const legacy=parseSenateCommitteeMinuteVotes(doc.text).filter(q=>q.individualVotesAvailable);
 const raw=parseSenateCommitteeMinutesRaw(doc.text).filter(q=>q.memberVotes.some(v=>v.choice==='yea'||v.choice==='nay'));
 const supplement=extractSupplementalNamedSenateRollCandidates(doc.text);
 const labels=[...doc.text.matchAll(/\b(?:ayes?|yeas?|nays?|noes?)\s*[:–-]/gi)];
 const signals=labels.length+[...doc.text.matchAll(/^\s*(?:Senator|Sen\.)\s+.+?\s*[-–—:]\s*(?:Yea|Yeas|Aye|Yes|Nay|No)\s*\.?\s*$/gim)].length;
 // The three independent recognizers are NOT added together as a denominator.
 // Their disagreement is an extraction hold, never presumed missing votes.
 const candidates=Math.max(rows.length,legacy.length,raw.length,supplement.length);
 const choices=Math.max(rows.reduce((n,q)=>n+q.choices.length,0),...[
  legacy.reduce((n,q)=>n+q.memberVotes.length,0),raw.reduce((n,q)=>n+q.memberVotes.filter(v=>v.choice!=='other').length,0),supplement.reduce((n,q)=>n+q.namedYeaCount+q.namedNayCount,0)]);
 return {document:doc,status:signals||candidates?'named_candidate_original':'examined_no_named_roll',questions:rows,candidates,choiceOccurrences:choices,unresolvedExtractionSignals:Math.max(0,candidates-rows.length),parserCounts:{row:rows.length,legacy:legacy.length,raw:raw.length,supplement:supplement.length},namedSignals:signals};
}
/** Pure conservative production matching: exact bounded question text is identity;
 * sides/tallies only verify an independently identified event. */
export function reconcileRowQuestion(q,doc,snapshot){
 if(q.confidence!=='source_proven_question')return {status:'source_question_hold',reason:q.holds.join(',')};
 let choices;try{choices=resolvePrintedHistoricalChoices(q,doc.text,snapshot.roster,doc);}catch(e){return {status:'historical_identity_hold',reason:e.message};}
 const same=snapshot.events.filter(e=>e.occurred_on===doc.date&&e.session_slug===doc.session_slug&&
  (e.source_document_id===doc.id||e.metadata?.committeeName===doc.committee||e.bill_identifier===q.billIdentifier));
 const anchored=same.filter(e=>e.bill_identifier===q.billIdentifier&&canonical(e.motion_text).includes(q.questionCanonical));
 if(anchored.length>1)return {status:'ambiguous_production_match',reason:'multiple_exact_question_anchors'};
 if(anchored.length===1){
  const e=anchored[0],actual=snapshot.choices.filter(v=>v.vote_event_id===e.id);
  if(e.yea_count!==q.yea||e.nay_count!==q.nay||actual.some(v=>!choices.some(x=>x.membershipId===v.membership_id&&x.choice===v.choice)))return {status:'conflicting_choices_or_tally',eventId:e.id};
  const missing=choices.filter(x=>!actual.some(v=>v.membership_id===x.membershipId&&v.choice===x.choice));
  const classification=e.vote_kind!==q.voteKind||ref(e.amendment_ref)!==ref(q.amendmentRef)||e.passed!==q.passed||e.is_passage!==false;
  if(e.source_document_id!==doc.id)return {status:'different_source_identity',eventId:e.id,missingChoices:missing.length,classification};
  return {status:classification?'classification_defect':missing.length?'missing_choices':'exact',eventId:e.id,choices,missingChoices:missing,classification};
 }
 // An event with a different question can be excluded only by explicit differing
 // amendment refs. All uncertain alternate source or final-motion joins remain held.
 const potential=same.filter(e=>e.bill_identifier===q.billIdentifier&&!(q.amendmentRef&&e.amendment_ref&&ref(q.amendmentRef)!==ref(e.amendment_ref)));
 if(potential.length)return {status:'ambiguous_production_match',reason:'unresolved_existing_question_or_source_identity'};
 return {status:'missing_event',choices};
}
