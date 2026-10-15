/**
 * #864 2022-25 official LRL alternate written-minute PDF: WHY did an earlier
 * linked original fail printed committee/day verification?
 *
 * A PDF referenced on the hearing's official index page can be a PREVIOUS
 * meeting's Minutes circulated at a later hearing, not the later minutes.
 * Byte SHA + URL directory alone cannot prove hearing-day action identity.
 * Strictly source-only; no individual vote or committee outcome inference.
 */
export interface HeldMinutePdfLink {
 year:number;committeeName:string;hearingDate:string;
 originalSourceUrl:string;originalPdfSha256:null;
 status:string;
}
export interface HeldMeetingSource {
 year:number;committeeName:string;hearingDate:string;
 sourceStatus:string;originalMinutePdfCandidatesFound:number;
 originalMinutePdfsAuthenticated:number;originalPdfDocuments:HeldMinutePdfLink[];
}
const MONTHS='January February March April May June July August September October November December'.split(' ');
export const LRL_HELD_PDF_SOURCE_YEAR_COUNTS={2023:2,2024:13,2025:4} as const;
export const HELD_LRL_PDF_SOURCE_CANDIDATE_COUNT=30 as const;
function normalized(value:string){
 return value.toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ').trim();
}
export function select19OfficialUnverifiedLrlPdfMeetingSources(
 rows:readonly HeldMeetingSource[],
 year:2023|2024|2025,
){
 if(rows.length!==29||![2023,2024,2025].includes(year))
  throw Error('Expected all 29 originally held meeting dates and exact active year');
 const holds=rows.filter(r=>r.sourceStatus==='linked_original_lrl_pdf_unverified');
 if(holds.length!==19||[2023,2024,2025].some(y=>
  holds.filter(r=>r.year===y).length!==LRL_HELD_PDF_SOURCE_YEAR_COUNTS[y as 2023|2024|2025]))
  throw Error('Government index linked-but-unverified Minutes 19-day universe drift');
 const seen=new Set<string>(),byYear:HeldMinutePdfLink[]=[];
 for(const m of holds){
  const day=m.hearingDate.replaceAll('-','');
  if(m.originalMinutePdfsAuthenticated!==0||
   m.originalPdfDocuments.length!==m.originalMinutePdfCandidatesFound||
   !/^202[3-5]-\d\d-\d\d$/.test(m.hearingDate)||
   m.originalPdfDocuments.length<1||m.originalPdfDocuments.length>3)
   throw Error('Unsupported alternate official LRL indexed meeting identity');
  const exactDay=m.year===Number(m.hearingDate.slice(0,4));
  if(!exactDay||!m.committeeName||m.committeeName.length>150)
   throw Error('Original indexed committee/day mismatch');
  for(const x of m.originalPdfDocuments){
   const u=new URL(x.originalSourceUrl);
   if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||
    u.search||u.hash||u.username||u.password||
    !u.pathname.startsWith('/archive/minutes/senate/'+m.year+'/')||
    !u.pathname.includes('/'+day+'/')||
    !/minutes[^/]*\.pdf$/i.test(u.pathname)||
    x.originalPdfSha256!==null||
    x.status!=='original_lrl_link_exists_but_pdf_transport_or_printed_identity_HOLD'||
    seen.has(x.originalSourceUrl))
    throw Error('Original official government index PDF identity or hold drift');
   seen.add(x.originalSourceUrl);
   if(m.year===year)byYear.push(x);
  }
 }
 if(seen.size!==HELD_LRL_PDF_SOURCE_CANDIDATE_COUNT)
  throw Error('Unexpected independently indexed unverified original PDF URL total');
 return byYear.sort((a,b)=>a.originalSourceUrl.localeCompare(b.originalSourceUrl));
}
export type OriginalPdfPrintFinding={
 exactOriginalPrintedMeetingDay:boolean;
 printedCommitteeHeaderFound:boolean;
 printedMinutesDocumentType:boolean;
 firstPrintedDateFromOriginalHeader:string|null;
 sourceTextHasTargetMeetingDay:boolean;
 printableOriginalExcerptNotPublished:true;
 status:'likely_same_day_original_requires_review'|
 'different_meeting_day_likely_prior_minutes_attachment'|
 'printed_minutes_header_or_day_missing'|
 'committee_heading_mismatch';
};
export function inspectHeldOfficialMinuteOriginalText(input:{
 text:string;hearingDate:string;committeeName:string;originalSourceUrl:string;
}):OriginalPdfPrintFinding {
 const {text,hearingDate,committeeName,originalSourceUrl}=input;
 if(text.length<70||text.length>900000||
  !/^202[3-5]-\d\d-\d\d$/.test(hearingDate)||
  !committeeName.trim()||
  !originalSourceUrl.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'))
  throw Error('Bounded original written-minute text identity invalid');
 const head=text.replace(/\s+/g,' ').slice(0,3600);
 const normHead=normalized(head);
 const name=normalized(committeeName);
 const printedCommitteeHeaderFound=normHead.includes(name);
 const printedMinutesDocumentType=/\bminutes\b/i.test(head);
 const dateRegex=new RegExp('\\b('+MONTHS.join('|')+')\\s+([0-3]?\\d)(?:st|nd|rd|th)?\\s*,?\\s*(202[3-5])\\b','ig');
 const dateCaptures=Array.from(head.matchAll(dateRegex)).map(m=>{
  const mon=MONTHS.findIndex(x=>x.toLowerCase()===m[1]!.toLowerCase())+1;
  const day=Number(m[2]),year=Number(m[3]);
  const iso=year+'-'+String(mon).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const d=new Date(iso+'T00:00:00Z');
  return d.toISOString().slice(0,10)===iso?iso:null;
 }).filter((x):x is string=>x!==null);
 const slashDates=[...head.matchAll(/\b(0?[1-9]|1[012])\/(0?[1-9]|[12]\d|3[01])\/(202[3-5])\b/g)]
  .map(m=>m[3]+'-'+m[1]!.padStart(2,'0')+'-'+m[2]!.padStart(2,'0'));
 const firstPrintedDateFromOriginalHeader=dateCaptures[0]??slashDates[0]??null;
 const sourceTextHasTargetMeetingDay=
  [...dateCaptures,...slashDates].includes(hearingDate);
 const exactOriginalPrintedMeetingDay=
  firstPrintedDateFromOriginalHeader===hearingDate;
 let status:OriginalPdfPrintFinding['status'];
 if(!printedCommitteeHeaderFound)status='committee_heading_mismatch';
 else if(!printedMinutesDocumentType||!firstPrintedDateFromOriginalHeader)
  status='printed_minutes_header_or_day_missing';
 else if(!exactOriginalPrintedMeetingDay)
  status='different_meeting_day_likely_prior_minutes_attachment';
 else status='likely_same_day_original_requires_review';
 return {exactOriginalPrintedMeetingDay,printedCommitteeHeaderFound,
  printedMinutesDocumentType,firstPrintedDateFromOriginalHeader,
  sourceTextHasTargetMeetingDay,printableOriginalExcerptNotPublished:true,
  status};
}
