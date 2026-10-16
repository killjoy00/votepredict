/** #864: source-only, 2021 April 12 original COMMITTEE Rule12.10 leads.
 * This is NOT authenticated historical named-side vote evidence until a
 * second independent source pass pins member-side SHA commitments.
 */
import {createHash} from 'node:crypto';
export const APR12_2021_RULE1210={
 originalURL:'https://www.senate.mn/journals/2021-2022/20210412036.pdf',
 reportDate:'2021-04-12',printedDay:'MONDAY, APRIL 12, 2021',
 leads:[
  {bill:'SF1159',number:1159,reporter:'Newman',committee:'Transportation Finance and Policy',journalPage:2086},
  {bill:'SF970',number:970,reporter:'Limmer',committee:'Judiciary and Public Safety Finance and Policy',journalPage:2147}
 ] as const
};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const norm=(s:string)=>s.replace(/\u0000/g,' ')
 .replace(/--\s*\d+\s+of\s+\d+\s*--/g,' ').replace(/\s+/g,' ').trim();
const separate=(s:string)=>s.replace(/,\s+and\s+/gi,', ').replace(/\s+and\s+/gi,', ')
 .split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
const digest=(s:'yea'|'nay',ns:string[])=>
 sha(ns.map(n=>sha(s+':'+n.toLowerCase())).sort().join('|'));
export function discoverOriginalApril12Rule1210Leads(original:string){
 if(original.length<8000||original.length>5_000_000)
  throw Error('Original daily Journal extracted text length invalid');
 const text=norm(original);
 if(!text.includes('JOURNAL OF THE SENATE')||!text.includes(APR12_2021_RULE1210.printedDay))
  throw Error('Not exact original 2021 April 12 Senate Journal');
 const reported=[];
 for(const target of APR12_2021_RULE1210.leads){
  const marker='REPORT OF VOTE IN COMMITTEE';
  const re=/Pursuant\s+to\s+Rule\s+12\.10,\s+upon\s+the\s+request\s+of\s+three\s+members,\s+a\s+roll\s+call\s+was\s+taken\s+on\s+/gi;
  const matches=[...text.matchAll(re)].filter(m=>m.index!==undefined&&
   new RegExp('S\\.F\\.\\s+No\\.\\s+'+target.number+'\\b','i').test(
     text.slice(m.index,m.index+450)));
  const row:{
   bill:string;committee:string;journalPage:number;journalReportDate:string;
   motionContextValid:boolean;sourceMotionTextSHA256:string|null;
   motionNormalizedOffset:number|null;motionDescription:string|null;
   printedYea:number|null;printedNay:number|null;printedAbsent:null;outcome:string|null;
   provisionalSideCommitment:{yea:string;nay:string}|null;
   provisionalOnlyNotIndependentCertified:true
  }={
   bill:target.bill,committee:target.committee,journalPage:target.journalPage,
   journalReportDate:APR12_2021_RULE1210.reportDate,motionContextValid:false,
   sourceMotionTextSHA256:null,motionNormalizedOffset:null,motionDescription:null,
   printedYea:null,printedNay:null,printedAbsent:null,outcome:null,
   provisionalSideCommitment:null,provisionalOnlyNotIndependentCertified:true
  };
  if(matches.length!==1){reported.push(row);continue}
  const m=matches[0]!,i=m.index!;
  const earlier=text.slice(Math.max(0,i-300000),i);
  const heading=earlier.lastIndexOf(marker),bill=earlier.lastIndexOf('S.F. No. '+target.number+':');
  const reporter=earlier.lastIndexOf('Senator '+target.reporter+' from the Committee on '+target.committee);
  if(heading<0||earlier.length-heading>165||bill<0||reporter<0||reporter>bill||
    bill-reporter>650||earlier.length-bill>290000){reported.push(row);continue}
  row.motionContextValid=true;
  const after=text.slice(i,i+1550);
  const end=after.search(/There\s+were\s+yeas\s+\d+\s+and\s+nays\s+\d+,\s+as\s+follows:/i);
  if(end<0||end>550){reported.push(row);continue}
  const motion=after.slice(0,end).trim();
  row.motionDescription=motion;row.sourceMotionTextSHA256=sha(motion);row.motionNormalizedOffset=i;
  const cleaned=after.slice(end).replace(/\b\d{3,4}\s*JOURNAL\s+OF\s+THE\s+SENATE\s*\[?\s*36TH\s+DAY\s*\]?/gi,' ')
   .replace(/\b36TH\s+DAY\s*\]?\s*MONDAY,\s*APRIL\s+12,\s+2021\s*\d{3,4}/gi,' ')
   .replace(/\s+/g,' ');
  const roll=cleaned.match(/^There\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),\s+as\s+follows:\s*Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:\s*Senators?\s+([A-Za-z ,.'-]+?)\.\s*Those\s+who\s+voted\s+in\s+the\s+negative\s+were:\s*Senators?\s+([A-Za-z ,.'-]+?)\.\s*The\s+motion\s+(prevailed|failed)\./i);
  if(roll){
   const yea=Number(roll[1]),nay=Number(roll[2]);
   const yn=separate(roll[3]!),nn=separate(roll[4]!);
   if(yea>0&&nay>=0&&yea+nay<=30&&yea===yn.length&&nay===nn.length&&
      new Set([...yn,...nn].map(x=>x.toLowerCase())).size===yea+nay){
    row.printedYea=yea;row.printedNay=nay;row.outcome='motion '+roll[5]!.toLowerCase();
    row.provisionalSideCommitment={yea:digest('yea',yn),nay:digest('nay',nn)};
   }
  }
  reported.push(row);
 }
 return {version:'senate-2021-apr12-two-original-rule1210-leads-v1',
  sourceOriginalURL:APR12_2021_RULE1210.originalURL,
  sourceJournalReportDate:APR12_2021_RULE1210.reportDate,
  originalNormalizedTextSHA256:sha(text),
  committeeLeads:reported,
  noOriginalNamesEmitted:true,
  originalReporterDayNotMotionHearingDay:true,
  sourceProvisionalSideSHAIsNotSecondPassCertified:true,
  noDatabaseFloorForecastChanges:true,issue864RemainsOpen:true
 };
}
