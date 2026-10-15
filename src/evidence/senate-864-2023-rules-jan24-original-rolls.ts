/**
 * #864 -- 2023-01-24 Rules & Administration ORIGINAL-PDF named roll audit.
 *
 * The frozen parser-v2 source ledger counted zero actions; parser v3 still
 * does not handle the printed "Members voting AYE / Members voting NO" list
 * followed by "On a vote of N AYE, and M NO". The exact original PDF and
 * original SHA are independently pinned. No DB connection, member identities,
 * original source text, choice hashes, or source names are exported.
 *
 * This module is NEVER imported by live backfill, serving or predictions.
 */
export const RULES_2023_JAN24_ORIGINAL={
 year:2023,hearingDate:'2023-01-24',
 committeeName:'Rules and Administration',
 sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf',
 originalPdfSha256:'a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379',
 firstIndependentSourceAuditRun:38680095705,
 reverifiedDetailedSourceAuditRun:38748138967,
} as const;
type RollStatus='named_lists_exact_and_uniquely_counted'|'source_roll_printed_names_grammar_hold';
type SafeMotion={
 sourceMotion:'SF1_oral_committee_report_amendment'|'SF1_judiciary_committee_report_adoption';
 hearingDate:'2023-01-24';
 sourceReportedYeas:4|6;sourceReportedNays:4|6;
 originalMotionDisposition:'failed'|'adopted';
 originalSideListsPresent:true;
 originalSideNamesCountVerified:boolean;
 sourceNamedMemberChoices:number|null;
 originalActionPosition:number;
 sourcePersonNamesNotExported:true;
 noStoredEventMembershipOrAsOfReconstruction:true;
};
type ParsedNames={names:string[];status:'parsed'}|{names:null;status:'hold'};
const sanitize=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
const CAP=150_000;
function namesFromSenatorLabeledList(part:string):ParsedNames{
 const compact=sanitize(part.replace(/--\s*\d+\s+of\s+\d+\s*--/gi,' '));
 // A side must be an explicit list of people, not a attendance block.
 // One source senator per "Senator <name>" prefix. Avoid surname inference,
 // party/sponsor inference or splitting on arbitrary whitespace.
 if(!compact||compact.length>1100||
  !/\bSenator\b/i.test(compact)||/\b(?:Ayes|Nays|Absent|Present)\s*:/i.test(compact))
  return {names:null,status:'hold'};
 const parts=compact.split(/\b(?:Senator|Sen\.)\s+/i).map(s=>s.trim()).filter(Boolean);
 // Nothing other than punctuation may precede the first "Senator".
 if(parts.length<1)return {names:null,status:'hold'};
 const normalized:string[]=[];
 for(const [i,p] of parts.entries()){
  if(i===0&&!/\b(?:Senator|Sen\.)\s+/i.test(compact.slice(0,20))&&
    !/^[,:;.-]*$/.test(p))return {names:null,status:'hold'};
  const clean=p.replace(/^[,;:\s.]+|[,;:\s.]+$/g,'').trim();
  if(!clean)continue;
  if(!/^[\p{L}\p{M}][\p{L}\p{M}.'-]*(?: [\p{L}\p{M}][\p{L}\p{M}.'-]*){0,3}$/u.test(clean)||
   /\b(?:motion|committee|report|voting|ayes?|no|nays?|yes|amendment)\b/i.test(clean))
   return {names:null,status:'hold'};
  normalized.push(clean.toLocaleLowerCase('en-US'));
 }
 if(!normalized.length||new Set(normalized).size!==normalized.length)
  return {names:null,status:'hold'};
 return {names:normalized,status:'parsed'};
}
export function inspect2023RulesJanuary24OriginalNamedRolls(input:{
 text:string;originalPdfSha256:string;hearingDate:string;committeeName:string;
}){
 const pin=RULES_2023_JAN24_ORIGINAL;
 if(input.originalPdfSha256!==pin.originalPdfSha256||
  input.hearingDate!==pin.hearingDate||input.committeeName!==pin.committeeName||
  input.text.length<500||input.text.length>CAP)
  throw Error('Exact 2023 Rules original PDF identity or source text not independently pinned');
 const flat=sanitize(input.text);
 const pattern=/Members\s+voting\s+AYE\s*:\s*([\s\S]{1,1400}?)\s+Members\s+voting\s+NO\s*:\s*([\s\S]{1,1400}?)\s+On\s+a\s+vote\s+of\s+(\d{1,2})\s+AYE\s*,?\s*and\s+(\d{1,2})\s+NO\b/giu;
 const hits=[...flat.matchAll(pattern)];
 if(hits.length!==2)
  throw Error('The original Rules source did not show two independently labeled AYE and NO recorded divisions');
 const motions:SafeMotion[]=[];
 let previousEnd=0;
 for(let i=0;i<hits.length;i++){
  const m=hits[i]!,at=m.index??-1,yea=Number(m[3]),nay=Number(m[4]);
  const expected=i===0?[4,6]:[6,4];
  if(at<0||at<previousEnd||yea!==expected[0]||nay!==expected[1])
   throw Error('Original Rules printed two distinct 4-6 / 6-4 votes with mismatched totals');
  const preceding=flat.slice(Math.max(previousEnd,at-950),at);
  const trailing=flat.slice(at+m[0].length,at+m[0].length+190);
  const request=/requested\s+(?:a\s+)?roll\s+call/i.test(preceding);
  const motion=i===0?
   /offered\s+an\s+oral\s+amendment|moved\s+to\s+amend\s+the\s+committee\s+report/i.test(preceding):
   /moved\s+to\s+adopt[\s\S]{0,200}committee\s+report\s+for\s+Senate\s+File\s+1/i.test(preceding);
  const resolved=i===0?
   /\bTHE\s+AMENDMENT\s+WAS\s+NOT\s+ADOPTED\b/i.test(trailing):
   /\bcommittee\s+report\s+was\s+adopted\b/i.test(trailing);
  if(!request||!motion||!resolved)
   throw Error('Original Rules motion, roll-call request, or outcome independently ambiguous');
  const ayes=namesFromSenatorLabeledList(m[1]!);
  const noes=namesFromSenatorLabeledList(m[2]!);
  const namesValid=ayes.names!==null&&noes.names!==null&&
   ayes.names.length===yea&&noes.names.length===nay&&
   new Set([...ayes.names,...noes.names]).size===yea+nay;
  motions.push({
   sourceMotion:i===0?'SF1_oral_committee_report_amendment':'SF1_judiciary_committee_report_adoption',
   hearingDate:'2023-01-24',
   sourceReportedYeas:yea as 4|6,sourceReportedNays:nay as 4|6,
   originalMotionDisposition:i===0?'failed':'adopted',
   originalSideListsPresent:true,
   originalSideNamesCountVerified:namesValid,
   sourceNamedMemberChoices:namesValid?yea+nay:null,
   originalActionPosition:i,
   sourcePersonNamesNotExported:true,
   noStoredEventMembershipOrAsOfReconstruction:true,
  });
  previousEnd=at+m[0].length;
 }
 const confirmed=motions.filter(x=>x.originalSideNamesCountVerified);
 const status:RollStatus=confirmed.length===2?
  'named_lists_exact_and_uniquely_counted':'source_roll_printed_names_grammar_hold';
 return {
  schemaVersion:'senate-864-2023-jan24-Rules-original-member-labeled-rolls-v1' as const,
  issue:864 as const,
  originalSourceYear:2023 as const,
  originalSourceUrl:pin.sourceUrl,originalPdfSha256:pin.originalPdfSha256,
  originalIndexedHearingDay:pin.hearingDate,
  exactOriginalSourceAndCommitteeVerified:true as const,
  originalSourceOfficialMotionCount:2 as const,
  originalIndependentlyPrintedTallyLabels:[{yea:4,nay:6},{yea:6,nay:4}] as const,
  exactNamedChoicesSourceVerified:confirmed.reduce((n,x)=>n+(x.sourceNamedMemberChoices??0),0),
  originalNamedRollCandidatesVerified:confirmed.length,
  status,
  noAdditionalNamedVotesInferredFromAttendanceOrParty:true as const,
  notYetComparedToHistoricalSenateMembershipOrStoredEvents:true as const,
  notSafeToReplayOldPositionalImporter:true as const,
  noSourcePersonsRawLinesOrHashesExported:true as const,
  databaseWrites:false as const,
  actionRows:motions,
 };
}
