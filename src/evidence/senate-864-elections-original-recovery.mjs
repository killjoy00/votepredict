/** #864: only preidentified, SHA-verified, original 2025 Elections Minutes.
 * Pure planner. No generic parser replay, offsets in persistent keys, attendance
 * inference, same-slate motion matching, or reclassification without identity.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {extractSupplementalNamedSenateRollCandidates} from './senate-committee-supplemental-named-roll-review.ts';
import {normalizeMemberName} from '../sources/minnesota/house-votes.ts';
import {senateCommitteeHearingTiming} from './senate-committee-meeting-timing.ts';

const sha=x=>createHash('sha256').update(x).digest('hex');
const norm=x=>String(x||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const full=x=>norm(x).replace(/\b([a-z])\b(?=\s)/g,'$1');
export const VERSION='senate864-elections-original-2025-addonly-v1';
export const MARKER='SENATE864_ELECTIONS_2025_ORIGINAL_GUARDED_V1';
export const PROOF_PATH='docs/evaluation/source-proof/senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json';
export const sourceLedger=()=>JSON.parse(readFileSync(PROOF_PATH,'utf8'));
/** The official contemporaneous Minutes print these full given and family names,
 * independently corroborated by the 94th Session LRL committee membership page.
 * Never resolve a printed surname directly against all historical legislators.
 */
export const OFFICIAL_FULL=[
 ['Bahr','Calvin K. Bahr'],['Boldon','Liz Boldon'],['Carlson','Jim Carlson'],
 ['Cwodzinski','Steve A. Cwodzinski'],['Koran','Mark W. Koran'],
 ['Limmer','Warren E. Limmer'],['Lucero','Eric Lucero'],['Marty','John J. Marty'],
 ['Mathews','Andrew Mathews'],['Port','Lindsey Port'],['Westlin','Bonnie S. Westlin'],
];
const official=new Map(OFFICIAL_FULL);
const exactNames=n=>[norm(n),norm(n).split(' ').filter(x=>x.length>1).join(' '),
  norm(n).split(' ').filter((x,i,a)=>i===0||i===a.length-1).join(' ')];
const allNames=OFFICIAL_FULL.map(([,name])=>({name,keys:new Set(exactNames(name))}));
/** Nine motion-specific proposals; four other original paragraphs are held.
 * All nine are explicitly distinct original parliamentary questions in existing
 * contextual original-source reviews, not source text positions as vote IDs.
 */
export const QUESTIONS=[
 {date:'2025-02-06',offset:1574,bill:'SF529',kind:'amendment',ref:'A1',mover:'Lucero',yea:5,nay:6,passed:false,question:'SF529 Lucero A1 oral amendment one eligible citizen one vote'},
 {date:'2025-02-06',offset:2522,bill:'SF529',kind:'motion',ref:null,mover:'Limmer',yea:5,nay:6,passed:false,question:'SF529 Limmer motion to lay on table'},
 {date:'2025-02-06',offset:2946,bill:'SF529',kind:'motion',ref:null,mover:'Boldon',yea:6,nay:5,passed:true,question:'SF529 Boldon as-amended committee recommendation to Rules'},
 {date:'2025-02-11',offset:3460,bill:'SF569',kind:'motion',ref:null,mover:'Boldon',yea:7,nay:4,passed:true,question:'SF569 committee recommendation and Rules rereferral'},
 {date:'2025-03-25',offset:1326,bill:'SF1812',kind:'motion',ref:null,mover:'Carlson',yea:8,nay:3,passed:true,question:'SF1812 Carlson as-amended recommendation to Judiciary'},
 {date:'2025-04-08',offset:2133,bill:'SF2384',kind:'amendment',ref:'A20',mover:'Koran',yea:5,nay:6,passed:false,question:'SF2384 Koran A20 amendment'},
 {date:'2025-04-08',offset:2401,bill:'SF2384',kind:'amendment',ref:'A32',mover:'Bahr',yea:5,nay:6,passed:false,question:'SF2384 Bahr A32 amendment voted after withdrawal'},
 {date:'2025-04-08',offset:2673,bill:'SF2384',kind:'amendment',ref:'A21',mover:'Lucero',yea:5,nay:6,passed:false,question:'SF2384 Lucero A21 amendment'},
 {date:'2025-04-08',offset:2941,bill:'SF2384',kind:'amendment',ref:'A19',mover:'Bahr',yea:5,nay:6,passed:false,question:'SF2384 Bahr A19 amendment'},
];
export const HELD=[
 {date:'2025-02-06',offset:1991,choices:11,reason:'repeated A2 label and identical slate unresolved'},
 {date:'2025-02-06',offset:2250,choices:11,reason:'second A2 paragraph unproved distinct'},
 {date:'2025-02-11',offset:2354,choices:11,reason:'printed SF0529 versus independent SF0828 bill log'},
 {date:'2025-04-08',offset:3303,choices:11,reason:'combined SF2384 into SF3096 procedural motion identity requires independent question classification'},
];
const SIDES=/\b(Ayes?|Yeas?|Yes|Nays?|No)\s*[:\-–—]\s*/gi;
const STOP=/\b(?:absent\s*[:\-–]|present\s*[:\-–]|motion\s+(?:failed|passed|prevails?|prevailed)|on\s+a\s+vote|by\s+a\s+roll\s+call|--\s*\d+\s+of\s+\d+|Senator\s+[^.\n]{0,45}\s+moved)\b/i;
const side=x=>/^n|^no$/i.test(x)?'nay':'yea';
const names=s=>s.replace(/\s+and\s+/gi,', ').split(/[,;]/).map(n=>n.trim()
 .replace(/^(?:Senators?|Vice Chair|Chair)\s+/i,'').replace(/[.;]+$/,'').trim()).filter(Boolean);
function originalNames(text,offset,expected){
 const heads=[...text.matchAll(SIDES)].map(m=>({at:m.index,end:m.index+m[0].length,label:m[1],choice:side(m[1])}));
 const ix=heads.findIndex(h=>h.at===offset);
 if(ix<0||!heads[ix+1]||heads[ix].choice===heads[ix+1].choice||heads[ix+1].at-heads[ix].end>520)
  throw Error('Original named opposing side boundary does not match pinned offset');
 const a=heads[ix],b=heads[ix+1];
 let tail=text.slice(b.end,Math.min(text.length,b.end+360));
 const stop=tail.search(STOP);if(stop>=0)tail=tail.slice(0,stop);
 const line=tail.indexOf('\n');if(line>=0)tail=tail.slice(0,line);
 const left=names(text.slice(a.end,b.at)),right=names(tail);
 const choices=[...left.map(name=>({name,choice:a.choice})),...right.map(name=>({name,choice:b.choice}))];
 if(choices.length!==expected.yea+expected.nay||
  choices.filter(x=>x.choice==='yea').length!==expected.yea||
  choices.filter(x=>x.choice==='nay').length!==expected.nay||
  new Set(choices.map(x=>x.name)).size!==choices.length||
  choices.some(x=>!official.has(x.name)||!/^[A-Za-z][A-Za-z -]{1,45}$/.test(x.name)))
  throw Error('Original explicit names/tally differ from pinned source proof');
 return choices;
}
function headingProof(text){
 const i=text.search(/called the meeting to order/i);
 if(i<150||i>1600)throw Error('Original opening meeting header missing');
 const h=text.slice(0,i);
 if(!/\bPresent\s*:/i.test(h)||!/\bAbsent\s*:\s*No Members Absent\b/i.test(h))
  throw Error('Opening present/absent source proof changed');
 for(const [surname,name] of OFFICIAL_FULL){
  const first=name.split(' ')[0];
  const r=new RegExp('\\bSenator\\s+'+first+'(?:\\s+[A-Z]\\.)?\\s+'+surname+'\\b','i');
  if(!r.test(h))throw Error('Full original hearing-day named roster mismatch');
 }
 return true;
}
export function verifyFourOriginalTexts(docs){
 const ledger=sourceLedger();
 if(ledger.originalPdfSourcesReverified!==4||ledger.exactNamedRollOffsetsReverified!==13||
  ledger.sourceTotalExplicitYeaNay!==143||ledger.sourceRecords.length!==4||
  ledger.allFourOriginalOpeningRostersPartitionElevenCommitteeMembers!==true)
  throw Error('Frozen source denominator changed');
 if(docs.length!==4||new Set(docs.map(x=>x.date)).size!==4||
  QUESTIONS.length!==9||HELD.length!==4||
  QUESTIONS.reduce((n,x)=>n+x.yea+x.nay,0)!==99||
  HELD.reduce((n,x)=>n+x.choices,0)!==44)
  throw Error('Selected original motion population drift');
 const selected=[];
 for(const d of docs){
  const pin=ledger.sourceRecords.find(x=>x.indexedHearingDate===d.date);
  if(!pin||d.url!==pin.officialOriginalPDFUrl||
   d.rawSha!==pin.shaPinnedOriginalPDF||d.bytes!==pin.shaPinnedOriginalPdfBytes||
   sha(d.text)!==pin.shaPinnedExtractedText||
   d.date!==pin.printedMeetingDate||!pin.printedDateMatchesIndexedHearing)
   throw Error('Original official Minutes binary/text/date drift');
  headingProof(d.text);
  const candidates=extractSupplementalNamedSenateRollCandidates(d.text);
  const offsets=pin.provisionalNamedRollSourceBlocks;
  const ownSpecs=[...QUESTIONS,...HELD].filter(x=>x.date===d.date);
  if(offsets.length!==ownSpecs.length||ownSpecs.some(x=>
      offsets.filter(y=>y.sourceTextOffset===x.offset&&y.explicitNamedYea=== (x.yea??QUESTIONS.find(q=>q.offset===x.offset&&q.date===x.date)?.yea??-1)&&y.explicitNamedNay=== (x.nay??QUESTIONS.find(q=>q.offset===x.offset&&q.date===x.date)?.nay??-1)).length!==1 &&
      QUESTIONS.some(q=>q.offset===x.offset&&q.date===x.date)))
   throw Error('Original extracted roll offsets/counts changed');
  for(const q of QUESTIONS.filter(x=>x.date===d.date)){
   const c=candidates.filter(x=>x.sourceOffset===q.offset&&x.pattern==='opposing_named_lists'&&x.numericTallyMatchesExplicitNamedList===true);
   if(c.length!==1||c[0].namedYeaCount!==q.yea||c[0].namedNayCount!==q.nay)
    throw Error('Independent source-tally recognizer does not certify selected question');
   const votes=originalNames(d.text,q.offset,q);
   const actual=votes.map(v=>sha(v.choice+':'+normalizeMemberName(v.name))).sort();
   if(JSON.stringify(actual)!==JSON.stringify(c[0].choiceIdentitySha256))
    throw Error('Two source name/side parsers disagree');
   const near=d.text.slice(Math.max(0,q.offset-650),q.offset);
   if(!new RegExp('\\b'+q.mover+'\\b','i').test(near))
    throw Error('Exact original mover missing before recorded vote');
   selected.push({...q,sourceUrl:d.url,sourceSha:d.rawSha,choices:votes,
    key:'senate-committee-source-v1:'+sha(JSON.stringify([d.rawSha,d.date,q.bill,q.question]))});
  }
 }
 if(selected.length!==9||new Set(selected.map(x=>x.key)).size!==9)throw Error('Selected verified roll identity collision');
 return selected.sort((a,b)=>a.date.localeCompare(b.date)||a.question.localeCompare(b.question));
}
const anchor=(q,e)=>{
 const txt=norm(e.motion_text);
 if(e.metadata?.sourceQuestion===q.question&&e.source_document_id)return true;
 if(q.ref)return new RegExp('\\ba\\s*'+q.ref.slice(1)+'\\b').test(txt)||
   norm(e.amendment_ref)===norm(q.ref);
 if(q.question.includes('lay on table'))return /\b(?:lay|laid)\b.*\btable\b/.test(txt);
 return /\b(?:recommend|pass|refer|committee report)\b/.test(txt);
};
const ref=x=>norm(x).replace(/\s/g,'').replace(/^a-/, 'a');
const one=(rows,reason)=>{if(rows.length!==1)throw Error(reason);return rows[0]};
function historicMember(s,name,date){
 const approved=one(allNames.filter(x=>x.name===official.get(name)),'Original given/family proof');
 const rows=s.roster.filter(r=>r.session_slug==='2025-2026'&&r.starts_on&&r.ends_on&&r.starts_on<=date&&r.ends_on>=date&&
   [r.name,r.normalized_name,...(r.aliases||[])].some(n=>approved.keys.has(norm(n))));
 return one(rows,'Historical exact full name/alias and service session unresolved');
}
function selectedSourceDocument(s,q){
 return one(s.docs.filter(d=>d.source_url===q.sourceUrl&&d.content_sha256===q.sourceSha&&
    d.meeting_date===q.date&&d.committee_name==='Elections'), 'Authenticated stored original document absent or duplicated');
}
function equivalentChoice(actual,expected){
 return actual.length===expected.length&&expected.every(v=>
   actual.filter(x=>x.membership_id===v.membershipId&&x.choice===v.choice).length===1);
}
function conflictsPotentially(same,q,doc){
 return same.some(e=>{
   if(e.bill_identifier&&e.bill_identifier!==q.bill)return false;
   if(e.yea_count!==q.yea||e.nay_count!==q.nay)return false;
   // A different source-document representation is a potential duplicate, not proof of absence.
   if(e.source_document_id&&e.source_document_id!==doc.id)return true;
   if(e.bill_identifier===q.bill&&e.amendment_ref&&q.ref&&ref(e.amendment_ref)!==ref(q.ref)&&
      new RegExp('\\b'+ref(e.amendment_ref)+'\\b').test(norm(e.motion_text)))return false;
   return true;
 });
}
/** Candidate planning never treats identical slates or event positions as identity. */
export function recoveryPlan(proof,s){
 const add=[],addChoices=[],exact=[],holds=[],updates=[];
 const identities=new Set();
 for(const q of proof){
  const doc=selectedSourceDocument(s,q);
  const b=one(s.bills.filter(x=>x.identifier===q.bill&&x.session_slug==='2025-2026'&&
    x.session_id===doc.session_id&&x.chamber_id===doc.chamber_id),
    'Exact historical bill/session/chamber context absent');
  let votes;
  try{
   votes=q.choices.map(v=>{
    const p=historicMember(s,v.name,q.date);
    return {...v,membershipId:p.membership_id,normalizedName:normalizeMemberName(v.name)};
   });
   if(new Set(votes.map(x=>x.membershipId)).size!==votes.length)throw Error('Duplicated active historical person');
  }catch{holds.push({date:q.date,question:q.question,reason:'unresolved_historical_full_name_or_session'});continue;}
  const same=s.events.filter(e=>e.occurred_on===q.date&&
    (e.source_document_id===doc.id||['Elections','Committee on Elections'].includes(e.metadata?.committeeName)||
     e.metadata?.committeeVote===true&&e.bill_identifier===q.bill));
  const anchors=same.filter(e=>e.bill_identifier===q.bill&&anchor(q,e));
  if(anchors.length>1){holds.push({date:q.date,question:q.question,reason:'multiple_existing_parliamentary_anchors'});continue;}
  if(anchors.length===1){
   const e=anchors[0],actual=s.choices.filter(v=>v.vote_event_id===e.id);
   const pre=actual.every(x=>votes.some(v=>v.membershipId===x.membership_id&&v.choice===x.choice))&&
      new Set(actual.map(x=>x.membership_id)).size===actual.length;
   if(e.source_document_id!==doc.id||e.session_id!==b.session_id||
     e.chamber_id!==b.chamber_id||e.bill_id!==b.id||e.yea_count!==q.yea||e.nay_count!==q.nay||
     e.is_passage!==false||e.metadata?.committeeVote!==true||!pre||
     e.external_key!==q.key && e.metadata?.sourceQuestion===q.question && e.source_document_id!==doc.id){
    holds.push({date:q.date,question:q.question,reason:'conflicting_existing_event_or_named_sides'});continue;
   }
   if(identities.has(e.id))throw Error('Existing event assigned twice');
   identities.add(e.id);
   const missing=votes.filter(v=>!actual.some(x=>x.membership_id===v.membershipId));
   if(e.vote_kind!==q.kind||ref(e.amendment_ref)!==ref(q.ref)||e.passed!==q.passed)
     updates.push({event:e,proof:q,bill:b,kind:q.kind,ref:q.ref,passed:q.passed});
   if(!missing.length&&!updates.some(x=>x.event.id===e.id))exact.push(q);
   addChoices.push(...missing.map(v=>({eventId:e.id,q,v})));
   continue;
  }
  if(conflictsPotentially(same,q,doc)){
   holds.push({date:q.date,question:q.question,reason:'ambiguous_preexisting_same_question_or_tally'});continue;
  }
  add.push({q,doc,b,votes});
 }
 if(add.length+exact.length+new Set(addChoices.map(x=>x.q.key)).size+
   new Set(updates.map(x=>x.proof.key)).size+holds.length<proof.length)
   throw Error('Unaccounted original question');
 return {add,addChoices,updates,exact,holds};
}
export function meta(q){
 return {committeeVote:true,committeeName:'Elections',individualVotesAvailable:true,
  finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,
  ...senateCommitteeHearingTiming(q.date).metadata,
  issue864ProductionRepair:VERSION,originalPdfSha256:q.sourceSha,
  sourceQuestion:q.question,originalSourceIsNamedRoll:true};
}
