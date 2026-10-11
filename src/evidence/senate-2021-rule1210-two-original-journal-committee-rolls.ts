/**
 * #864: two actual 2021 MN SENATE COMMITTEE named rolls printed in OFFICIAL
 * Senate Journal as Rule 12.10 committee reports, NOT Senate floor votes.
 * The Journal report date is NOT independently verified committee meeting date.
 * Strictly prevent rebranding Journal publication as LRL printed minutes.
 */
import {createHash} from 'node:crypto';

export const RULE1210_2021_VERSION=
 'senate-2021-committee-rule12-10-two-original-journal-rolls-v1' as const;
export const ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS=[
 {
  bill:'SF173',reportDate:'2021-02-08',committee:'Transportation Finance and Policy',
  document:'https://www.senate.mn/journals/2021-2022/20210208011.pdf',
  journalDay:11,journalPage:272,
  revisor:'https://www.revisor.mn.gov/bills/92/2021/0/SF/173/?body=Senate',
  amended:false,yea:5,nay:4,
  realYea:['Coleman','Jasinski','Kiffmeyer','Newman','Osmek'],
  realNay:['Carlson','Dibble','Johnson Stewart','McEwen']
 },{
  bill:'SF1470',reportDate:'2021-03-04',committee:'Housing Finance and Policy',
  document:'https://www.senate.mn/journals/2021-2022/20210304020.pdf',
  journalDay:20,journalPage:666,
  revisor:'https://www.revisor.mn.gov/bills/92/2021/0/SF/1470/?body=Senate',
  amended:true,yea:4,nay:3,
  realYea:['Dahms','Draheim','Duckworth','Rosen'],
  realNay:['Dziedzic','Port','Rest']
 }
] as const;
const hash=(x:string)=>createHash('sha256').update(x).digest('hex');
const flatten=(x:string)=>x.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const parseNames=(s:string)=>s.replace(/,\s+and\s+/gi,', ')
 .replace(/\s+and\s+/gi,', ').split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);

type JournalSpec=(typeof ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS)[number];
function parseJournal(text:string,spec:JournalSpec,yeaNames:readonly string[],nayNames:readonly string[]){
 if(text.length<600||text.length>2_000_000)
  throw Error('2021 original Senate Journal extracted PDF text outside bounded length');
 if(yeaNames.length!==spec.yea||nayNames.length!==spec.nay||
  new Set([...yeaNames,...nayNames]).size!==spec.yea+spec.nay)
  throw Error('2021 Rule12.10 expected independently exact roster invalid');
 const flat=flatten(text);
 const longDate=spec.reportDate==='2021-02-08'?'FEBRUARY 8, 2021':'MARCH 4, 2021';
 if(!flat.toUpperCase().includes(longDate)||
  !flat.includes('JOURNAL OF THE SENATE')||
  !flat.includes('REPORT OF VOTE IN COMMITTEE'))
  throw Error('2021 original journal report date/source type absent');
 // Distinct 2021 Rule 12.10 printed committee vote; never accept unqualified
 // "the roll was called" because the surrounding journal ALSO contains floor votes.
 const wanted=spec.bill.slice(2);
 const startPattern=new RegExp(
  '\\bPursuant\\s+to\\s+Rule\\s+12\\.10,\\s+upon\\s+the\\s+request\\s+of\\s+three\\s+members,\\s+a\\s+roll\\s+call\\s+was\\s+taken\\s+on\\s+the\\s+motion\\s+that\\s+S\\.F\\.\\s+No\\.\\s+'+wanted+',\\s+'+
  (spec.amended?'as\\s+amended,\\s+':'')+
  'be\\s+recommended\\s+to\\s+pass\\s+and\\s+be\\s+re-referred\\.',
  'gi'
 );
 const starts=[...flat.matchAll(startPattern)];
 if(starts.length!==1||starts[0]!.index===undefined)
  throw Error('Exact 2021 Rule12.10 original bill amendment referral motion not unique');
 const start=starts[0]!.index!;
 const prior=flat.slice(Math.max(0,start-300),start);
 if(!prior.includes('REPORT OF VOTE IN COMMITTEE'))
  throw Error('Rule12.10 record is not in journal committee-vote report');
 const after=flat.slice(start+starts[0]![0].length,
  Math.min(flat.length,start+starts[0]![0].length+840));
 const match=after.match(
  /\bThere\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),\s+as\s+follows:\s+Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:\s+Senators?\s+([A-Za-z ,.']+?)\.\s+Those\s+who\s+voted\s+in\s+the\s+negative\s+were:\s+Senators?\s+([A-Za-z ,.']+?)\.\s+The\s+motion\s+prevailed\b/i
 );
 if(!match||!match[0]||match.index===undefined)
  throw Error('Exact committee roll reported names and outcome missing, or floor-vote style');
 const yea=parseNames(match[3]!),nay=parseNames(match[4]!);
 if(Number(match[1])!==spec.yea||Number(match[2])!==spec.nay||
  yea.length!==spec.yea||nay.length!==spec.nay||
  new Set([...yea,...nay]).size!==yea.length+nay.length||
  yea.some(x=>!yeaNames.includes(x))||nay.some(x=>!nayNames.includes(x)))
  throw Error('Named 2021 Rule12.10 YEA/NAY partition does not match printed committee roster');
 const resultAt=start+starts[0]![0].length+match.index;
 return {
  sourceType:'OFFICIAL_SENATE_JOURNAL_COMMITTEE_RULE12_10_REPORT',
  bill:spec.bill,originalCommittee:spec.committee,
  senateJournalReportDate:spec.reportDate,printedJournalDay:spec.journalDay,
  printedJournalPage:spec.journalPage,
  originalReportedMotion:spec.amended
   ?'As amended recommend pass and re-refer'
   :'Recommend pass and re-refer',
  sourceMotionReportedPassed:true,
  yes:yea.length,no:nay.length,absentPrinted:null,
  actualCommitteeHearingDateIndependentlyEstablished:false,
  officialLRL2021PrintedCommitteeMinutesCompared:false,
  selectedOnlyOnRule1210ThreeMemberRequest:true,
  onlyOriginalNamedChoicesNotFullCommitteeVoteCensus:true,
  exactBillSpecificRollFoundOnce:starts.length===1,
  originalSourceMotionTextOffset:start,
  originalResultTextOffset:resultAt,
  sourceNearbyTextSHA256:hash(flat.slice(Math.max(0,start-240),Math.min(flat.length,resultAt+match[0].length+80))),
  sourceSideMemberHashesOnly:{
   yea:yea.map(x=>hash('yea:'+x.toLowerCase())).sort(),
   nay:nay.map(x=>hash('nay:'+x.toLowerCase())).sort()
  },
  noFullNamedSidesListCommitted:true,
  noMemberVoteImportOrPrivateDatabaseRead:true,
  noStatewide2021To2025RecordedVoteDenominatorCertified:true,
  senateFloorRollVoteExcluded:true
 };
}
export function inspectAuthentic2021SenateJournalCommitteeRoll(
 text:string,bill:'SF173'|'SF1470'
){
 const spec=ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS.find(x=>x.bill===bill);
 if(!spec)throw Error('Unsupported original journal committee bill');
 return parseJournal(text,spec,spec.realYea,spec.realNay);
}
/** Only fictional test names, never a real source certified original. */
export function inspectSynthetic2021SenateJournalCommitteeRoll(
 text:string,bill:'SF173'|'SF1470',
 mockYea:readonly string[],mockNay:readonly string[]
){
 const spec=ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS.find(x=>x.bill===bill);
 const real=new Set<string>(ORIGINAL_2021_JOURNAL_COMMITTEE_ROLL_SPECS.flatMap(s=>
  [...s.realYea,...s.realNay]));
 if(!spec||mockYea.some(x=>real.has(x))||mockNay.some(x=>real.has(x)))
  throw Error('Synthetic mock roster must be purely fictional');
 return parseJournal(text,spec,mockYea,mockNay);
}
