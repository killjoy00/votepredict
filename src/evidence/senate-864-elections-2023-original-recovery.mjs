/**
 * #864: bounded 2023 Elections original Minutes recovery. The ten historical
 * source rolls and seven original-PDF/text SHAs are already independently pinned.
 * Two questions with unsettled identity remain hard source holds.
 * No surname-only database resolution and no parser-ordinal database keys.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {extractNineSourceIndividualRolls} from './senate-committee-nine-no-label-counted-rolls.ts';
import {normalizeMemberName} from '../sources/minnesota/house-votes.ts';
import {senateCommitteeHearingTiming} from './senate-committee-meeting-timing.ts';

const sha=x=>createHash('sha256').update(x).digest('hex');
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export const VERSION='senate864-elections-2023-original-guarded-v1';
export const MARKER='SENATE864_ELECTIONS_2023_ORIGINAL_GUARDED_V1';
export const QUEUE='docs/evaluation/source-proof/senate-committee-nine-tally-matched-source-action-review-queue.json';
// Full first/given/family names printed on the official Senate Feb 7, 2023
// Elections Minutes: senate.mn/schedule/hearing_minutes.html?hearing_id=17523&ls=93.
// Their contemporaneous roster is a separate identity witness from the PDF's
// surname-only named choice rows. Never resolve a stored person by surname.
export const OFFICIAL_FULL=[
 ['Anderson','Bruce D. Anderson'],['Bahr','Calvin K. Bahr'],
 ['Boldon','Liz Boldon'],['Carlson','Jim Carlson'],
 ['Cwodzinski','Steve A. Cwodzinski'],['Dornink','Gene Dornink'],
 ['Koran','Mark W. Koran'],['Limmer','Warren Limmer'],
 ['Marty','John Marty'],['Mathews','Andrew Mathews'],
 ['Mitchell','Nicole Mitchell'],['Port','Lindsey Port'],
 ['Rest','Ann H. Rest'],['Westlin','Bonnie S. Westlin']
];
const normalForms=name=>{
 const pieces=norm(name).split(' ').filter(Boolean);
 return new Set([pieces.join(' '),pieces.filter((x,i)=>i===0||i===pieces.length-1||x.length>1).join(' '),
   pieces.filter(x=>x.length>1).join(' ')]);
};
const knownNames=new Map(OFFICIAL_FULL.map(([surname,name])=>[surname,{
 name,keys:normalForms(name)}]));
if(knownNames.size!==14)throw Error('2023 public Senate committee roster altered');
export const SPECS=[
 {date:'2023-01-17',offset:1399,bill:'SF26',kind:'motion',ref:null,passed:true,
  question:'SF26 Elections committee recommendation'},
 {date:'2023-02-07',offset:2056,bill:'SF3',kind:'amendment',ref:'A35',passed:false,
  question:'SF3 Koran A35 amendment'},
 {date:'2023-02-07',offset:2635,bill:'SF3',kind:'motion',ref:null,passed:true,
  question:'SF3 Marty as amended recommendation to Transportation'},
 {date:'2023-02-14',offset:2061,bill:'SF1515',kind:'motion',ref:null,passed:true,
  question:'SF1515 Elections committee recommendation'},
 {date:'2023-02-14',offset:3305,bill:'SF1507',kind:'motion',ref:null,passed:true,
  question:'SF1507 Elections committee recommendation'},
 {date:'2023-02-21',offset:2663,bill:'SF749',kind:'motion',ref:null,passed:true,
  question:'SF749 Elections committee recommendation'},
 {date:'2023-03-02',offset:1287,bill:'SF1434',kind:'amendment',ref:null,passed:false,
  question:'SF1434 separately recorded oral amendment'},
 {date:'2023-03-14',offset:1315,bill:'SF1827',kind:'motion',ref:null,passed:true,
  question:'SF1827 Elections committee recommendation'}
];
export const HELD=[
 {date:'2023-02-07',offset:1530,choices:14,
  reason:'A36 as filed versus distinct oral amendment question label unresolved'},
 {date:'2023-03-07',offset:1899,choices:13,
  reason:'A2 precise source bill and parliamentary anchor not independently settled'}
];
export function sourceQueue(){
 const raw=JSON.parse(readFileSync(QUEUE,'utf8'));
 if(raw.schemaVersion!=='senate-nine-12-numeric-matched-original-source-roll-review-queue-v1')
  throw Error('Immutable original roll review queue identity changed');
 const docs=raw.documents.filter(x=>x.year===2023);
 if(docs.length!==7||docs.reduce((n,d)=>n+d.sourceRollBlocks.length,0)!==10||
    docs.reduce((n,d)=>n+d.sourceRollBlocks.reduce((a,r)=>a+r.sourceNamedYeaCount+r.sourceNamedNayCount,0),0)!==133||
    SPECS.length!==8||HELD.length!==2||
    HELD.reduce((n,x)=>n+x.choices,0)!==27)
  throw Error('Fixed 2023 original source denominator changed');
 return docs;
}
const fingerprintNames=new Map();
for(const [surname] of OFFICIAL_FULL)for(const choice of ['yea','nay','absent','pass']){
 const key=sha(choice+':'+normalizeMemberName(surname));
 if(fingerprintNames.has(key))throw Error('Public roster choice digest collision');
 fingerprintNames.set(key,{surname,choice});
}
function decodeOriginalChoices(record){
 const used=new Set(),out=[];
 if(record.sourceChoiceFingerprintSha256?.length!==14||
    record.namedYeaNayTallyMatchesSource!==true||
    record.explicitNamesAreUniqueWithinRoll!==true)
  throw Error('Original named-choice source is incomplete');
 for(const digest of record.sourceChoiceFingerprintSha256){
  const v=fingerprintNames.get(digest);
  if(!v||used.has(v.surname))throw Error('Original printed surname/side not proved by roster');
  used.add(v.surname);
  if(v.choice==='yea'||v.choice==='nay')out.push({...v,sourceName:v.surname});
 }
 if(used.size!==14||out.length!==record.sourceYeaCount+record.sourceNayCount||
    out.filter(x=>x.choice==='yea').length!==record.sourceYeaCount||
    out.filter(x=>x.choice==='nay').length!==record.sourceNayCount)
  throw Error('Original vote roster and explicitly printed side totals disagree');
 return out.sort((a,b)=>a.surname.localeCompare(b.surname));
}
function billInContext(text,offset){
 const matches=[...text.slice(Math.max(0,offset-3200),offset).matchAll(
  /\bS\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?(\d{1,4})\b/gi)];
 return matches.length?'SF'+Number(matches.at(-1)[1]):null;
}
function proofOfMotion(text,spec,nextAt){
 const context=text.slice(Math.max(0,spec.offset-1350),spec.offset);
 const segment=text.slice(spec.offset,Math.min(text.length,nextAt??spec.offset+1700));
 if(billInContext(text,spec.offset)!==spec.bill)
  throw Error('Original question bill identity not separately proven');
 if(spec.ref){
  if(!new RegExp('\\b'+spec.ref.replace('A','A\\s*')+'\\b','i').test(context)||
    !/\bamendment\b/i.test(context))
   throw Error('Original numbered amendment identity not proven');
 }else if(spec.kind==='amendment'){
  if(!/\boral\s+amendment\b/i.test(context))
   throw Error('Original oral amendment identity not proven');
 }else if(!/\b(?:recommen\w*|re-?refer|to\s+pass)\b/i.test(context))
  throw Error('Original committee recommendation identity not proven');
 // Explicit motion result is required; a numeric majority alone does not prove
 // adoption, a voice vote, the amendment label or the parliamentary question.
 // The independently extracted named-roll candidate has already compared its
 // printed numeric YEA/NAY tally with 14 distinct original named statuses.
 // The certified 2023 source sometimes prints the tally in NAY/YEAs order
 // or separates it from the motion result, so don't require redundant prose
 // ordering here. Require one locally attached explicit result after the
 // roll-call cue, while separately checking bill/question and original SHA.
 const outcomes=[...segment.matchAll(/\b(?:the\s+)?motion\s+(failed|prevailed|passed|did\s+not\s+prevail)\b/gi)];
 if(outcomes.length!==1||segment.slice(0,outcomes[0]?.index??0).search(/\broll\s+call\b/i)<0)
  throw Error('Original source outcome unbound on '+spec.date+' offset '+spec.offset);
 const outcome=outcomes[0];
 const passed=/^(?:prevailed|passed)$/i.test(outcome[1]);
 if(passed!==spec.passed)
  throw Error('Original source result disagrees with selected parliamentary question');
 return {passed,contextSha256:sha(context+'|'+segment.slice(0,(outcome.index??0)+outcome[0].length))};
}
/**
 * Narrow original-question holds cannot waive original bytes, named sides,
 * numeric-tally parity, or historical member identity checks. Never turn an
 * arbitrary parsing/network exception into a silent skip.
 */
export function sourceProofHoldReason(reason){
 const eligible={
  'Original question bill identity not separately proven':'original_bill_context_unproved',
  'Original numbered amendment identity not proven':'original_amendment_identity_unproved',
  'Original oral amendment identity not proven':'original_oral_amendment_unproved',
  'Original committee recommendation identity not proven':'original_recommendation_unproved',
  'Original source result disagrees with selected parliamentary question':'original_question_outcome_conflict'
 };
 return Object.hasOwn(eligible,reason)?eligible[reason]:
  (/^Original source outcome unbound on 2023-0[1-3]-\d\d offset \d{3,5}$/.test(reason)
   ?'original_named_roll_outcome_unbound':null);
}
export function verifyOriginals(originals){
 const queue=sourceQueue();
 if(originals.length!==7||new Set(originals.map(x=>x.date)).size!==7)
  throw Error('Exactly seven independent 2023 original Minutes required');
 const selected=[],sourceHolds=[];
 for(const original of originals){
  const pin=queue.find(x=>x.hearingDate===original.date);
  if(!pin||pin.officialSourcePdfUrl!==original.url||
    pin.originalSourcePdfSha256!==original.rawSha||
    pin.originalEmbeddedTextSha256!==sha(original.text))
   throw Error('Authenticated original official Senate PDF or text SHA drift');
  const parsed=extractNineSourceIndividualRolls(original.text,2023,'Elections');
  if(parsed.length!==pin.sourceRollBlocks.length)
   throw Error('Original 2023 Elections roll denominator drift');
  const byOffset=new Map(parsed.map(x=>[x.sourceOffset,x]));
  if(byOffset.size!==parsed.length)throw Error('Original roll positions not individually unique');
  for(const check of pin.sourceRollBlocks){
   const row=byOffset.get(check.sourceTextOffset);
   if(!row||row.sourceYeaCount!==check.sourceNamedYeaCount||
      row.sourceNayCount!==check.sourceNamedNayCount||
      row.explicitlyListedAbsent!==check.sourceAbsentCount||
      row.explicitlyListedPass!==check.sourcePassCount)
    throw Error('Original exact-offset roll / source tally mismatch');
   const votes=decodeOriginalChoices(row);
   const selectedSpec=SPECS.find(x=>x.date===original.date&&x.offset===check.sourceTextOffset);
   if(!selectedSpec){
    const hold=HELD.find(x=>x.date===original.date&&x.offset===check.sourceTextOffset);
    if(!hold||hold.choices!==votes.length)throw Error('Unaccounted source-only held motion');
    continue;
   }
   const next=pin.sourceRollBlocks.find(x=>x.sourceTextOffset>check.sourceTextOffset)?.sourceTextOffset;
   let motion;
   try{motion=proofOfMotion(original.text,selectedSpec,next)}
   catch(error){
    // A source question that cannot be bound to one authenticated exact
    // parliamentary motion is a HOLD, never a guessed vote. Original YEA/NAY
    // names, numeric tally, 14-person partition and PDF SHA remain verified.
    const hold=sourceProofHoldReason(String(error?.message||''));
    if(!hold)throw error;
    sourceHolds.push({date:selectedSpec.date,offset:selectedSpec.offset,
      choices:votes.length,reason:hold});
    continue;
   }
   selected.push({...selectedSpec,choices:votes,contextSha256:motion.contextSha256,
     sourceSha:original.rawSha,sourceUrl:original.url,
     key:'senate-committee-source-v1:'+sha(JSON.stringify([
       original.rawSha,original.date,selectedSpec.bill,selectedSpec.question]))});
  }
 }
 const held=[...HELD,...sourceHolds];
 const selectedChoices=selected.reduce((n,q)=>n+q.choices.length,0);
 if(selected.length+held.length!==10||
   selectedChoices+held.reduce((n,h)=>n+h.choices,0)!==133||
   selected.length>8||new Set(selected.map(x=>x.key)).size!==selected.length||
   new Set([...selected,...held].map(x=>x.date+'|'+x.offset)).size!==10)
  throw Error('Selected original source question/hold accounting did not partition all ten named rolls');
 return {selected:selected.sort((a,b)=>a.date.localeCompare(b.date)||a.question.localeCompare(b.question)),
   sourceHolds:held.sort((a,b)=>a.date.localeCompare(b.date)||a.offset-b.offset)};
}
const unique=(rows,reason)=>{if(rows.length!==1)throw Error(reason);return rows[0]};
function fullIdentity(snapshot,surname,date){
 const publicName=knownNames.get(surname);
 if(!publicName)throw Error('No independent official first and family name');
 const matched=snapshot.roster.filter(r=>r.session_slug==='2023-2024'&&
   r.starts_on&&r.ends_on&&r.starts_on<=date&&r.ends_on>=date&&
   [r.name,r.normalized_name,...(r.aliases||[])].some(n=>[...normalForms(n)].some(k=>publicName.keys.has(k))));
 return unique(matched,'Historical full-name session membership identity not unique');
}
const ref=s=>norm(s).replace(/^(?:a\s*)(\d+)$/,'a$1');
const motionAnchored=(q,e)=>{
 if(e.external_key===q.key||e.metadata?.sourceQuestion===q.question)return true;
 if(q.ref)return ref(e.amendment_ref)===ref(q.ref)||
     new RegExp('\\b'+ref(q.ref)+'\\b','i').test(norm(e.motion_text));
 if(q.kind==='amendment')return /\boral\s+amendment\b/i.test(norm(e.motion_text))&&
   norm(e.motion_text).includes(norm(q.bill));
 return /(recommend|re.?refer|to pass|committee report)/i.test(norm(e.motion_text));
};
export function recoveryPlan(proof,snapshot){
 const add=[],addChoices=[],updates=[],exact=[],holds=[],seen=new Set();
 for(const q of proof){
  let doc,b,votes;
  try{
   doc=unique(snapshot.docs.filter(d=>d.source_url===q.sourceUrl&&
     d.content_sha256===q.sourceSha&&d.meeting_date===q.date&&
     d.committee_name==='Elections'),'Original stored source identity missing or duplicate');
   b=unique(snapshot.bills.filter(b=>b.identifier===q.bill&&b.session_slug==='2023-2024'&&
      b.session_id===doc.session_id&&b.chamber_id===doc.chamber_id),
      'Historical Senate bill/session not unique');
   votes=q.choices.map(v=>{
    const m=fullIdentity(snapshot,v.surname,q.date);
    return {...v,membershipId:m.membership_id,normalizedName:normalizeMemberName(v.sourceName)};
   });
   if(new Set(votes.map(v=>v.membershipId)).size!==votes.length)
    throw Error('One active historical member mapped twice');
  }catch{
   holds.push({question:q.question,reason:'official_source_or_full_roster_session_identity_hold'});continue;
  }
  const same=snapshot.events.filter(e=>e.occurred_on===q.date&&(
   e.source_document_id===doc.id||
   ['Elections','Committee on Elections'].includes(e.metadata?.committeeName)||
   e.bill_identifier===q.bill&&e.metadata?.committeeVote===true));
  const anchors=same.filter(e=>e.bill_identifier===q.bill&&motionAnchored(q,e));
  if(anchors.length>1){
   holds.push({question:q.question,reason:'multiple_existing_motion_anchors'});continue;
  }
  if(anchors.length===1){
   const e=anchors[0],old=snapshot.choices.filter(x=>x.vote_event_id===e.id);
   if(seen.has(e.id))throw Error('Existing parliamentary event assigned to two source questions');
   seen.add(e.id);
   const oldSidesValid=new Set(old.map(x=>x.membership_id)).size===old.length&&
    old.every(x=>votes.some(v=>v.membershipId===x.membership_id&&v.choice===x.choice));
   if(!oldSidesValid||e.source_document_id!==doc.id||e.session_id!==b.session_id||
    e.chamber_id!==b.chamber_id||e.bill_id!==b.id||e.yea_count!==votes.filter(x=>x.choice==='yea').length||
    e.nay_count!==votes.filter(x=>x.choice==='nay').length||e.is_passage!==false||
    e.metadata?.committeeVote!==true){
    holds.push({question:q.question,reason:'legacy_event_original_or_named_choice_conflict'});continue;
   }
   // Preserve all prior event IDs. Fix only source-proven question classification.
   if(e.vote_kind!==q.kind||ref(e.amendment_ref)!==ref(q.ref)||e.passed!==q.passed)
    updates.push({event:e,q});
   const missing=votes.filter(v=>!old.some(x=>x.membership_id===v.membershipId));
   addChoices.push(...missing.map(v=>({eventId:e.id,q,v})));
   if(!missing.length&&e.vote_kind===q.kind&&ref(e.amendment_ref)===ref(q.ref)&&
      e.passed===q.passed)exact.push(q);
   continue;
  }
  // Identical sides/tallies on different questions are NOT evidence of identity.
  // But any *unanchored* legacy event with same bill/day/count is a duplicate
  // risk, and prevents an add-only write rather than shifting ordinal keys.
  const conflicts=same.filter(e=>e.yea_count===q.choices.filter(v=>v.choice==='yea').length&&
   e.nay_count===q.choices.filter(v=>v.choice==='nay').length&&
   (!e.bill_identifier||e.bill_identifier===q.bill)&&
   !(q.ref&&e.amendment_ref&&ref(q.ref)!==ref(e.amendment_ref)&&
      new RegExp('\\b'+ref(e.amendment_ref)+'\\b','i').test(norm(e.motion_text))));
  if(conflicts.length){
   holds.push({question:q.question,reason:'possible_unanchored_legacy_same_day_roll'});continue;
  }
  add.push({q,doc,b,votes});
 }
 return {add,addChoices,updates,exact,holds};
}
export function eventMetadata(q){
 return {committeeVote:true,committeeName:'Elections',individualVotesAvailable:true,
  finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,
  ...senateCommitteeHearingTiming(q.date).metadata,
  issue864ProductionRepair:VERSION,originalPdfSha256:q.sourceSha,
  originalMotionContextSha256:q.contextSha256,
  sourceQuestion:q.question,originalSourceIsNamedRoll:true};
}
