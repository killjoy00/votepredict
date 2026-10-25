/** Explicit grouped sides and SHA-bound, individually reviewed handwritten cells.
 * Question identity uses literal parliamentary text, never names/tallies/order. */
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const norm=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const compact=s=>s.replace(/\s+/g,' ').trim();
const canonical=s=>norm(s.replace(/\b([HS])\s*\.?\s*F\s*\.?\s*(\d+)/gi,(_,a,b)=>a+'F'+Number(b)).replace(/\bA-(\d+)/gi,'A$1'));
const key=(q,d)=>sha(JSON.stringify([d.session_slug,d.committee,d.date,q.billIdentifier,q.voteKind,q.amendmentRef,q.questionCanonical]));
function make(q,d){q.questionCanonical=canonical(q.motionText);q.questionKey=key(q,d);q.fullQuestionPassageSha256=sha(q.fullQuestionPassage);q.confidence=q.holds.length?'held_question':'source_proven_question';return q;}
function heading(text,at){return [...text.slice(0,at).matchAll(/^\s*([HS])\s*\.?\s*F\s*\.?\s*(\d+)\s*:/gim)].at(-1);}
/** A result names its amendment; the originating motion and any accepted oral
 * changes must all refer to that same amendment before the named roll. */
export function extractExplicitGroupedRolls(text,doc){
 const out=[],re=/^\s*YEA\s*[:\-]\s*([^\n]+)\n\s*NAY\s*[:\-]\s*([^\n]+)\n(?:\s*Absent\s*:\s*([^\n]+)\n)?\s*There being (\d{1,2}) yes votes,?\s*and (\d{1,2}) no votes,?\s*the A-?(\d+)(?: amendment)?(,?\s*as amended)?[,\s]*(?:amendment,?\s*)?is (not adopted|adopted)\./gim;
 for(const m of text.matchAll(re)){
  const ref='A'+Number(m[6]),before=text.slice(0,m.index),h=heading(text,m.index);
  const q={format:'explicit_labeled_roll_after_bound_motion',holds:[],choices:[],voteKind:'amendment',amendmentRef:ref,yea:Number(m[4]),nay:Number(m[5]),passed:m[8].toLowerCase()==='adopted',excludedOtherLabels:m[3]?m[3].split(',').length:0};
  for(const [list,choice]of[[m[1],'yea'],[m[2],'nay']])for(const literal of list.split(',')){const name=literal.trim().replace(/[.]$/,'').trim();if(!/^[\p{L}.' -]+$/u.test(name)||!name)q.holds.push('invalid_printed_name');q.choices.push({name,choice});}
  if(new Set(q.choices.map(v=>norm(v.name))).size!==q.choices.length)q.holds.push('duplicate_printed_sides');
  if(q.choices.filter(v=>v.choice==='yea').length!==q.yea||q.choices.filter(v=>v.choice==='nay').length!==q.nay)q.holds.push('printed_tally_mismatch');
  const request=before.match(/Senator\s+([\p{L}.' -]+?)\s+(?:requested|asked for)\s+a\s+roll call vote:\s*$/iu);
  const intros=[...before.matchAll(new RegExp('Senator\\s+([\\p{L}.\u0027 -]+?)\\s+(?:offered|moved)\\s+the\\s+A-?'+Number(m[6])+'\\s+amendment\\b','giu'))].filter(x=>!h||x.index>h.index);
  if(!h||!request||intros.length!==1){q.holds.push('missing_unique_motion_request_or_bill');out.push(q);continue;}
  q.billIdentifier=h[1].toUpperCase()+'F'+Number(h[2]);
  const intro=intros[0],context=before.slice(intro.index),body=compact(context),amended=!!m[7];
  if([...context.matchAll(/\b([HS])\s*\.?\s*F\s*\.?\s*(\d+)\b/gi)].some(x=>x[1].toUpperCase()+'F'+Number(x[2])!==q.billIdentifier))q.holds.push('contradictory_bill_association');
  const otherRefs=[...context.matchAll(/\bA-?(\d+)\b/gi)].some(x=>'A'+Number(x[1])!==ref);
  if(context.length>2500||otherRefs||/withdraw|reconsider|renew|not adopted|fails/i.test(context))q.holds.push('intervening_or_compound_question');
  const oral=/\bmoved an oral amendment\b/i.test(context);
  if([...context.matchAll(/Senator\s+[\p{L}.' -]+?\s+(?:offered|moved)\b/giu)].length!==(oral?2:1))q.holds.push('intervening_motion');
  if(oral!==amended)q.holds.push('unbound_as_amended_state');
  if(oral){
   if((context.match(/\bmoved an oral amendment\b/gi)||[]).length!==1||!/accepted the [\p{L}.' -]+ oral amendment as friendly\./iu.test(context)||!new RegExp('oral amendment is adopted along a voice vote to the A-?'+Number(m[6])+'\\.','i').test(context))q.holds.push('oral_change_not_explicitly_accepted');
  }else if(/voice vote|accepted|amended/i.test(context.replace(/\bamendment\b/gi,'')))q.holds.push('intervening_result');
  q.motionText=body;q.fullQuestionPassage=text.slice(intro.index,m.index+m[0].length);q.sourceOffset=intro.index;q.sourceEnd=m.index+m[0].length;
  out.push(make(q,doc));
 }
 return out;
}
/** This accepts observations, not inferred OCR marks. Production supplies only
 * a reviewed artifact whose complete SHA and original PDF SHA are pinned. */
export function extractReviewedCheckboxQuestions(text,doc){
 const proof=doc.reviewedCheckboxEvidence;if(!proof)return [];
 if(proof.originalSha256!==doc.sha256||proof.textSha256!==sha(text)||proof.date!==doc.date||proof.committee!==doc.committee)throw Error('Reviewed original/text identity drift');
 const out=[],seenPages=new Set();
 for(const t of proof.tables){
  const q={format:'reviewed_handwritten_checkbox_cells',holds:[],choices:[],excludedOtherLabels:0,voteKind:t.amendmentRef?'amendment':'motion',amendmentRef:t.amendmentRef||null,billIdentifier:t.billIdentifier,passed:t.passed,yea:t.yea,nay:t.nay,motionText:t.motionText};
  if(!t.reviewConfirmed||t.date!==doc.date||!Number.isInteger(t.page)||t.page<1||seenPages.has(t.page)||![t.raw300dpiPageSha256,t.reviewImageSha256].every(x=>/^[a-f0-9]{64}$/.test(x)))q.holds.push('unreviewed_or_duplicate_page');seenPages.add(t.page);
  if(JSON.stringify(t.header)!==JSON.stringify(['Senator','Yes','No','Pass','Absent'])||t.rows.length!==10)q.holds.push('incomplete_printed_grid');
  const at=text.indexOf(t.narrativePassage),h=at>=0?heading(text,at):null;
  if(at<0||at!==text.lastIndexOf(t.narrativePassage)||!h||h[1].toUpperCase()+'F'+Number(h[2])!==t.billIdentifier||!compact(t.narrativePassage).startsWith(t.motionText))q.holds.push('unbound_literal_question');
  const totals=t.narrativePassage.match(/(?:With a (?:roll call |call )?vote of)\s*(\d+)\s*ayes,?\s*(?:and\s*)?(\d+)\s*nays/i);
  if(!totals||Number(totals[1])!==t.yea||Number(totals[2])!==t.nay)q.holds.push('disagreeing_narrative_tally');
  const fail=/did not prevail|not adopted/i.test(t.narrativePassage),pass=/motion prevailed|was adopted|motion did prevail/i.test(t.narrativePassage);
  if(fail===pass||t.passed!==pass||t.printedOutcome!==(pass?'Prevailed':'Did Not Prevail'))q.holds.push('disagreeing_question_outcome');
  if(t.amendmentRef){
   if(t.literalQuestion!==t.amendmentRef||!new RegExp('\\b'+t.amendmentRef+'\\b').test(t.motionText))q.holds.push('different_selected_amendment');
   if(t.parentAmendmentRef&&!new RegExp('\\b'+t.parentAmendmentRef+'\\b').test(t.motionText))q.holds.push('unbound_parent_amendment');
  }else if(t.literalQuestion!==t.billIdentifier||!new RegExp('SF\\s*'+t.billIdentifier.slice(2)+'\\b').test(t.motionText)||!/recommended to pass/i.test(t.motionText))q.holds.push('incomplete_selected_recommendation');
  const names=new Set();
  for(const r of t.rows){
   const n=norm(r.name);if(names.has(n)||!n)q.holds.push('duplicate_or_missing_row_name');names.add(n);
   if(!Array.isArray(r.marks)||!r.marks.length||new Set(r.marks).size!==r.marks.length||r.marks.some(m=>!['yes','no','pass','absent','blank'].includes(m))){q.holds.push('unknown_cell_mark');continue;}
   let mark=r.marks[0];
   if(r.marks.length>1){const c=r.correction;if(!c?.reviewConfirmed||!r.marks.includes(c.finalMark)||!/^changed(?: vote)? to (?:yes|no)$/i.test(c.literal.replace(/^Senator Klein /i,''))||!c.literal.toLowerCase().endsWith(c.finalMark)){q.holds.push('unresolved_changed_vote');continue;}mark=c.finalMark;}
   if(mark==='yes'||mark==='no')q.choices.push({name:r.name,choice:mark==='yes'?'yea':'nay'});else q.excludedOtherLabels++;
  }
  if(q.choices.filter(v=>v.choice==='yea').length!==q.yea||q.choices.filter(v=>v.choice==='nay').length!==q.nay)q.holds.push('reviewed_cell_tally_mismatch');
  q.sourceOffset=at;q.sourceEnd=at+t.narrativePassage.length;q.reviewedPage=t.page;q.parentAmendmentRef=t.parentAmendmentRef||null;q.nonbinaryLabelConflict=t.nonbinaryLabelConflict||null;
  q.fullQuestionPassage=JSON.stringify({narrative:t.narrativePassage,reviewedTable:t,originalSha256:proof.originalSha256});out.push(make(q,doc));
 }
 return out;
}
