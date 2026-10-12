/**
 * #864: independent ORIGINAL electronically archived 2022-04-07 Minnesota
 * Senate Finance committee minutes. Verify seven distinct named roll paragraphs
 * without treating 2022 print minutes as enumerated, electronic data as a
 * statewide denominator, or names/attendance as database member_vote rows.
 *
 * Only original text-derived digest commitments leave the ephemeral runner.
 */
import {createHash} from 'node:crypto';
export const FINANCE_APR07_2022={
 issue:864,
 hearingDate:'2022-04-07',
 committee:'Finance',
 officialUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2022/Fin/20220407/Fin_20220407_minutes.pdf',
 originalReference:'docs/evaluation/source-proof/senate-2022-finance-apr07-electronic-seven-rolls-discovery.json',
 sourceType:'2022 official ELECTRONIC minutes; print collection not compared',
 expectedNamedRollPassages:7,
 expectedNamedYeaNayTokens:67,
 motions:[
  {bill:'SF3510',mover:'Marty',label:'A17',printedYea:3,printedNay:6,printedAbsent:1,disposition:'FAILED',ambiguous:false,
   intro:/Senator Marty moved the A17 Amendment\b/i},
  {bill:'SF3510',mover:'Lopez Franzen',label:'A16',printedYea:4,printedNay:6,printedAbsent:0,disposition:'FAILED',ambiguous:false,
   intro:/Senator Lopez Franzen moved the A16 Amendment\b/i},
  {bill:'SF3510',mover:'Kent',label:'A15',printedYea:4,printedNay:6,printedAbsent:0,disposition:'FAILED',ambiguous:false,
   intro:/Senator Kent moved the A15 Amendment\b/i},
  {bill:'SF4269',mover:'Marty',label:'A15',printedYea:4,printedNay:6,printedAbsent:0,disposition:'FAILED',ambiguous:false,
   intro:/Senator Marty moved the A15 Amendment\b/i},
  {bill:'SF4269',mover:'Marty',label:'ORAL_TO_A16',printedYea:4,printedNay:6,printedAbsent:0,disposition:'FAILED',ambiguous:true,
   intro:/Senator Marty moved an oral amendment to the A16 Amendment\b/i},
  {bill:'SF4269',mover:'Kent',label:'A17',printedYea:4,printedNay:6,printedAbsent:null,disposition:'FAILED',ambiguous:false,
   intro:/Senator Kent moved the A17 Amendment\b/i},
  {bill:'SF4091',mover:'Pratt',label:'COMMITTEE_RECOMMENDATION',printedYea:5,printedNay:3,printedAbsent:2,disposition:'PREVAILED',ambiguous:false,
   intro:/Senator Pratt moved that S\.?\s*F\.?\s*4091, as amended, be recommended to pass\b/i}
 ] as const
} as const;

type Motion=(typeof FINANCE_APR07_2022.motions)[number];
export const sha256=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export function normalizeFinanceMinutes(value:string){
 return value.replace(/\u0000/g,' ').replace(/\u00a0/g,' ').replace(/\r/g,' ')
  .replace(/\s+/g,' ').trim();
}
const rollIntro=/A roll call(?: vote)? was requested\.?(?: The results were as follows:)?/ig;
const billHead=/\b([SH])\.?\s*F\.?\s*(\d{1,4})\s*:/ig;
const resultStart=/On a vote of\s+(\d+)\s+AYES\s*(?:,|and)\s*(\d+)\s+NAYS\b/ig;
const nameList=(value:string)=>{
 const names=value.split(/,|\s+and\s+/i).map(s=>s.trim()).filter(Boolean);
 if(names.some(s=>!/^[-' .\p{L}\p{M}]+$/u.test(s)||s==='-'))
  throw Error('original PDF roll side has unparseable senator name token');
 if(names.length!==new Set(names.map(x=>x.toLowerCase())).size)
  throw Error('original PDF roll side repeated senator name');
 return names;
};
function sideDigest(side:'yea'|'nay'|'absent',names:string[]){
 return sha256(names.map(n=>sha256(side+':'+n.toLowerCase())).sort().join('|'));
}
function findAt(pattern:RegExp,text:string,from:number){
 const flags=pattern.flags.includes('g')?pattern.flags:pattern.flags+'g';
 const re=new RegExp(pattern.source,flags);re.lastIndex=from;
 return re.exec(text);
}
function activeBillAt(heads:Array<{index:number;bill:string}>,position:number){
 let last:string|null=null;
 for(const x of heads){if(x.index>position)break;last=x.bill;}
 return last;
}
export function inspect2022FinanceApr07OriginalMinutes(text:string){
 const flat=normalizeFinanceMinutes(text);
 if(flat.length<1700||flat.length>120000)
  throw Error('original 2022 official minutes extracted text bounds mismatch');
 if(!/Minnesota State Senate\s+Finance Committee\s+Thursday, April 7, 2022/i.test(flat)||
    !/called the meeting to order at 8:44 A\.M\., on April 7, 2022/i.test(flat))
  throw Error('original source missing exact 2022 Finance hearing identity/date');
 const heads=[...flat.matchAll(billHead)].map(m=>({
  index:m.index??0,bill:m[1]==='H'?'HF'+m[2]:'SF'+m[2]
 }));
 const rollCalls=[...flat.matchAll(rollIntro)];
 const closings=[...flat.matchAll(resultStart)];
 if(rollCalls.length!==7||closings.length!==7)
  throw Error('original source has different distinct roll-call introductions or tally closings');
 const allMotions=FINANCE_APR07_2022.motions;
 const rows=[];let prevIntroEnd=0;
 for(const [index,spec] of allMotions.entries()){
  const intro=findAt(spec.intro,flat,prevIntroEnd);
  if(!intro||intro.index===undefined)
   throw Error('original motion mover/bill context missing or out of order');
  const sourceIndex=intro.index;
  if(activeBillAt(heads,sourceIndex)!==spec.bill)
   throw Error('original committee roll context assigned to wrong bill');
  const roll=rollCalls[index]!;
  const ending=closings[index]!;
  const closingAt=ending.index??-1;
  if(closingAt<0)throw Error('original tally closing missing source index');
  if((roll.index??-1)<=sourceIndex+(intro[0]?.length??0)-1||
     (roll.index??0)-sourceIndex>650||
     closingAt<=(roll.index??0)||
     closingAt-(roll.index??0)>1300)
   throw Error('original roll call or tally not adjacent to expected distinct motion');
  const nextIntro=index+1<allMotions.length
   ?findAt(allMotions[index+1]!.intro,flat,sourceIndex+intro[0].length)
   :null;
  if(nextIntro&&closingAt>=(nextIntro.index??-1))
   throw Error('original tally crosses into next distinct motion');
  const segment=flat.slice((roll.index??0)+roll[0].length,closingAt);
  const ayeStart=segment.search(/\bAYES\s*:/i),nayStart=segment.search(/\bNAYS\s*:/i);
  const absentMatch=/\bABSENT\s*:/i.exec(segment);
  const absentStart=absentMatch?.index??-1;
  if(ayeStart<0||nayStart<ayeStart||absentStart>=0&&absentStart<nayStart)
   throw Error('original YEA NAY ABSENT partition order inconsistent');
  const ayeLabel=/\bAYES\s*:/i.exec(segment.slice(ayeStart))![0];
  const nayLabel=/\bNAYS\s*:/i.exec(segment.slice(nayStart))![0];
  const namesYea=nameList(segment.slice(ayeStart+ayeLabel.length,nayStart));
  const namesNay=nameList(segment.slice(nayStart+nayLabel.length,absentStart<0?segment.length:absentStart));
  let namesAbsent:string[]|null=null;
  if(absentStart>=0){
   const raw=segment.slice(absentStart+absentMatch![0].length).trim();
   namesAbsent=raw==='-'?[]:nameList(raw);
  }
  const counts=[namesYea.length,namesNay.length,namesAbsent?.length??null];
  const reported=[Number(ending[1]),Number(ending[2]),counts[2]];
  if(counts[0]!==reported[0]||counts[1]!==reported[1]||
     counts[0]!==spec.printedYea||counts[1]!==spec.printedNay||
     counts[2]!==spec.printedAbsent)
   throw Error('original printed roll tally, names or explicitly absent list changed');
  const distinct=[...namesYea,...namesNay,...(namesAbsent??[])].map(x=>x.toLowerCase());
  if(new Set(distinct).size!==distinct.length)
   throw Error('original senator appears on incompatible YEA/NAY/ABSENT sides');
  const post=flat.slice(closingAt,(nextIntro?.index??Math.min(flat.length,closingAt+320)));
  const failed=/the motion (?:did|does) not prevail/i.test(post);
  const prevailed=/\bTHE MOTION PREVAILED\b/i.test(post);
  if((spec.disposition==='FAILED'&&!failed)||(spec.disposition==='PREVAILED'&&!prevailed))
   throw Error('original motion disposition differs from explicit minute language');
  const context=flat.slice(sourceIndex,Math.min(flat.length,closingAt+180));
  const isOral=spec.label==='ORAL_TO_A16';
  if(isOral&&!/oral amendment to the A16/i.test(context))
   throw Error('original oral-versus-base A16 amendment context not preserved');
  if(isOral&&!/A16 Amendment was not adopted/i.test(post))
   throw Error('original oral A16 and base A16 closing-label conflict not present');
  rows.push({
   motionOrdinal:index+1,bill:spec.bill,mover:spec.mover,label:spec.label,
   sourceIntroNormalizedOffset:sourceIndex,sourceRollNormalizedOffset:roll.index,
   sourceTallyNormalizedOffset:closingAt,
   sourceMotionAndResultNeighborhoodSHA256:sha256(context),
   officialPrintedYea:namesYea.length,officialPrintedNay:namesNay.length,
   officialPrintedAbsent:namesAbsent===null?null:namesAbsent.length,
   originalNamesSHA256Only:{
    yea:sideDigest('yea',namesYea),
    nay:sideDigest('nay',namesNay),
    absent:namesAbsent===null?null:sideDigest('absent',namesAbsent)
   },
   reportedOutcome:spec.disposition,
   distinctBillAndMotionIdentityPreserved:true,
   oralA16VsClosingBaseA16OnHold:isOral,
   openingAttendanceNotTransposedIntoVoteAbsentList:true,
   actualOfficialCommitteeMeetingDay:'2022-04-07',
   availableOnHistoricalHearingDayOnlyForOfficialMinuteActions:'2022-04-07',
   sameDayForecastEligible:false,individualNamedVoteImported:false,
   noSeparatePrintMinuteParityCertificate:true
  });
  prevIntroEnd=sourceIndex+intro[0].length;
 }
 if(!/Senator Pratt withdrew the A21 Amendment/i.test(flat))
  throw Error('withdrawn A21 motion incorrectly omitted from original context');
 if(!/On a voice vote/i.test(flat))
  throw Error('voice motions not found in original official electronic text');
 if(rows.reduce((a,r)=>a+r.officialPrintedYea+r.officialPrintedNay,0)!==67)
  throw Error('original 67 named YEA/NAY source tokens changed');
 if(rows.filter(x=>x.oralA16VsClosingBaseA16OnHold).length!==1||
  rows.filter(x=>x.officialPrintedAbsent===null).length!==1)
  throw Error('original SF4269 oral label or unprinted absent holds changed');
 return {
  originalOfficialSourceMeetingDay:'2022-04-07',
  electronicallyPrintedNamedRollParagraphCount:7,
  electronicallyPrintedNamedYeaNayCount:67,
  electronicallyExplicitlyNamedAbsentCount:3,
  distinctBills:[...new Set(rows.map(x=>x.bill))],
  sourceNormalizationSHA256:sha256(flat),
  originalRollSourceProofs:rows,
  withdrawnAmendmentNotARecordedVote:true,
  voiceVotesDoNotCreateNamedMemberChoices:true,
  oralAmendmentClosingLabelConflictKeptUnresolved:true,
  absentRowMissingRemainsNull:true,
  separatelyCollected2022PrintMinutesReviewed:false,
  original2021PrintDenominator:null,
  onlyThisOneElectronicMeetingAudited:true,
  noFullRollNamesOrOriginalPdfTextCommitted:true,
  sourceToExistingPrivateVoteRowsNotReconciled:true,
  issue864MustStayOpen:true
 };
}
