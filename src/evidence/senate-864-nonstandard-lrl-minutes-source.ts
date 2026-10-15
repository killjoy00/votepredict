/**
 * #864 alternate authenticated official 2022–25 Senate Minutes PDFs
 * overlooked by /YYYYMMDD/ and _minutes.pdf strict legacy path selector.
 * Source-only inventory for the exact 29 government-indexed no-minute dates.
 */
import {createHash} from 'node:crypto';
export type HeldSenateMeeting={
 year:number;committeeName:string;hearingDate:string;sourceClass:string;
 originalClerkSha256:string|null;independentOrphanOfficialLrlPdfSource?:unknown;
};
export type CandidateMinutePdf={
 year:2022|2023|2024|2025;committeeName:string;meetingDate:string;
 sourceUrl:string;sourceArchiveDateDirectory:string;
 recoveredFromNonstandardArchivePath:boolean;
};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const htmlPlain=(s:string)=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
 .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
export function check29HeldOriginalMeetings(rows:readonly HeldSenateMeeting[]){
 if(rows.length!==29)throw Error('Exact 29 indexed original no-written-minute date cohort required');
 const seen=new Set<string>(),counts={2022:0,2023:0,2024:0,2025:0};
 for(const m of rows){
  if(![2022,2023,2024,2025].includes(m.year)||
   !m.hearingDate.startsWith(m.year+'-')||
   !/^202[2-5]-\d\d-\d\d$/.test(m.hearingDate)||
   !m.committeeName||m.sourceClass!=='no_written_minutes_authenticated_through_independent_routes'||
   m.originalClerkSha256!==null||m.independentOrphanOfficialLrlPdfSource)
   throw Error('Unverified indexed government meeting replaced by inferred absent vote');
  const key=[m.year,m.committeeName,m.hearingDate].join('|');
  if(seen.has(key))throw Error('Duplicate missing original Senate hearing');
  seen.add(key);counts[m.year as keyof typeof counts]++;
 }
 if([counts[2022],counts[2023],counts[2024],counts[2025]].join(',')!=='4,6,14,5')
  throw Error('Known original year/meeting gap denominator drift');
 return rows;
}
export function inspectOtherOriginalLrlCommitteePdfUrls(input:{
 year:2022|2023|2024|2025;committeeName:string;meetingDate:string;
 lrlCommitteePageUrl:string;html:string;
}):CandidateMinutePdf[]{
 const {year,committeeName,meetingDate,html,lrlCommitteePageUrl}=input;
 const page=new URL(lrlCommitteePageUrl);
 if(page.protocol!=='https:'||!['www.lrl.mn.gov','lrl.mn.gov'].includes(page.hostname)||
  !/^\/minutes\/comm(?:\.aspx)?$/.test(page.pathname)||
  page.searchParams.get('year')!==String(year)||
  !/^202[2-5]-\d\d-\d\d$/.test(meetingDate)||!meetingDate.startsWith(String(year)))
  throw Error('Not a Senate archived committee-year official index URL');
 const officialTitle=(committeeName+' - Senate - '+year).toLowerCase();
 if(html.length<3000||html.length>2_000_000||
  !htmlPlain(html).toLowerCase().includes(officialTitle))
  throw Error('Original government HTML committee, chamber and year unproven');
 const day=meetingDate.replaceAll('-','');
 const seen=new Set<string>(),out:CandidateMinutePdf[]=[];
 for(const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi)){
  let url:URL;
  try{url=new URL(m[2]!.replace(/&amp;/g,'&'),lrlCommitteePageUrl)}catch{continue}
  if(url.protocol!=='https:'||!['www.lrl.mn.gov','lrl.mn.gov'].includes(url.hostname)||
   url.search||url.hash||url.username||url.password)continue;
  const path=url.pathname;
  const p=path.match(/^\/archive\/minutes\/senate\/(202[2-5])\/[^/]+\/(20\d{6})([a-z0-9_-]{0,24})\/([^/]+\.pdf)$/i);
  if(!p||Number(p[1])!==year||p[2]!==day||
   !/minutes/i.test(p[4]!)||seen.has(url.toString()))continue;
  seen.add(url.toString());
  out.push({year,committeeName,meetingDate,sourceUrl:url.toString(),
   sourceArchiveDateDirectory:p[2]!+p[3]!,
   recoveredFromNonstandardArchivePath:!/_minutes\.pdf$/i.test(path)||p[3]!==''});
 }
 return out.sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
}
export function validateOriginalAlternatePdfText(input:{
 year:2022|2023|2024|2025;committeeName:string;
 meetingDate:string;originalText:string;
}){
 const {year,committeeName,meetingDate,originalText}=input;
 if(originalText.length<75||originalText.length>900_000)
  throw Error('Original alternate PDF has insufficient or excessive extracted text');
 const text=originalText.replace(/\s+/g,' '),normalized=text.toLowerCase();
 const date=new Date(meetingDate+'T12:00:00Z');
 if(date.toISOString().slice(0,10)!==meetingDate||date.getUTCFullYear()!==year)
  throw Error('Unverified original PDF meeting date');
 const day=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',
  weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date);
 const name=committeeName.toLowerCase();
 if(!normalized.includes(name+' committee')&&!normalized.includes('committee on '+name))
  throw Error('Original alternate minute PDF named a different Senate committee');
 if(!normalized.includes(day.toLowerCase()))
  throw Error('Original alternate minute PDF printed a different hearing date');
 if(!/\bMinutes\b/i.test(text)||!/Senator/i.test(text))
  throw Error('Alternate PDF not proven to be formal official Senate Minutes');
 return {officialExactCommitteeAndDayPrinted:true,
  originalNormalizedTextSha256:sha(text),
  originalDocumentDay:meetingDate};
}
