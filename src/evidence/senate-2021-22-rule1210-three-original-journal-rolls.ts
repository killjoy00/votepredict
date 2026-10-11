/**
 * #864 — exact official Minnesota Senate JOURNAL Rule 12.10 COMMITTEE rolls.
 * Three distinct original committee motions (including a SPECIAL SESSION
 * amendment motion, never an SF9 passage vote). Dates are JOURNAL REPORT dates,
 * not independently established committee motion times.
 * The repository contains SHA-256 commitments, not printed real member-side lists.
 */
import {createHash} from 'node:crypto';

export const MN_ORIGINAL_RULE1210_THREE={
 sf1:{
  bill:'SF1',billNo:1,session:'2021 regular',journalPage:297,
  reportDay:'2021-02-11',printedDay:'THURSDAY, FEBRUARY 11, 2021',
  committee:'State Government Finance and Policy and Elections',reporter:'Kiffmeyer',
  url:'https://www.senate.mn/journals/2021-2022/20210211013.pdf',
  revisor:'https://www.revisor.mn.gov/bills/92/2021/0/SF/1/?body=Senate',
  motion:'SF1 as amended recommended to pass',outcome:'motion prevailed',
  yea:5,nay:3,
  yeaDigest:'e6753e6f7aa5a0e348cc370fc2e0f79a775a8003a80382d50c6c42861e6ef238',
  nayDigest:'dd25cad1d1b0995360122b8e04709c0b1fb470cf03c95977380349f77d063c85',
  distinctMotionWithIdenticalNames:['SF2','SF450']
 },
 sf2909:{
  bill:'SF2909',billNo:2909,session:'2022 regular',journalPage:5098,
  reportDay:'2022-02-24',printedDay:'THURSDAY, FEBRUARY 24, 2022',
  committee:'Civil Law and Data Practices Policy',reporter:'Mathews',
  url:'https://www.senate.mn/journals/2021-2022/20220224070.pdf',
  revisor:'https://www.revisor.mn.gov/bills/92/2022/0/SF/2909/?body=Senate',
  motion:'SF2909 recommended to pass',outcome:'motion prevailed',
  yea:5,nay:3,
  yeaDigest:'1f063e65cfdeebf1574d8346d2fd2e192ff87a608a85317a1d9873c28c0babe1',
  nayDigest:'415484049a170ac7fa05ecc94db2e7dda7665fdc5d46d2b8a7866ee2c10f0298',
  distinctMotionWithIdenticalNames:[]
 },
 sf9ss1:{
  bill:'SF9',billNo:9,session:'2021 First Special Session',journalPage:156,
  reportDay:'2021-06-21',printedDay:'MONDAY, JUNE 21, 2021',
  committee:'Finance',reporter:'Rosen',
  url:'https://www.senate.mn/journals/2021-2022/2021062107_ss1.pdf',
  revisor:'https://www.revisor.mn.gov/bills/92/2021/1/SF/9/?body=Senate',
  motion:'second portion of Marty division of Pratt amendment to SF9',
  outcome:'amendment adopted',yea:6,nay:4,
  yeaDigest:'aa9426caa585f254d47426b84fda970938e91ad0b0bb1c6d5b88cf6ad847b2aa',
  nayDigest:'0484d46fe68371e7314e0b9c148f9d199bcc04edc22ca1ff41ee7cefa440e9f2',
  distinctMotionWithIdenticalNames:[]
 }
} as const;
export type ThreeRule1210Target=keyof typeof MN_ORIGINAL_RULE1210_THREE;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const normalized=(s:string)=>s.replace(/\u0000/g,' ')
 .replace(/--\s*\d+\s+of\s+\d+\s*--/g,' ')
 .replace(/\s+/g,' ').trim();
const splitNames=(s:string)=>s.replace(/,\s+and\s+/gi,', ')
 .replace(/\s+and\s+/gi,', ').split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
const digest=(side:'yea'|'nay',list:readonly string[])=>
 sha(list.map(n=>sha(side+':'+n.toLowerCase())).sort().join('|'));
const MOTION_LEAD='Pursuant\\s+to\\s+Rule\\s+12\\.10,\\s+upon\\s+the\\s+request\\s+of\\s+three\\s+members,\\s+a\\s+roll\\s+call\\s+was\\s+taken\\s+on\\s+';
const MOTIONS={
 sf1:'the\\s+motion\\s+that\\s+S\\.F\\.\\s+No\\.\\s+1,\\s+as\\s+amended,\\s+be\\s+recommended\\s+to\\s+pass\\.',
 sf2909:'the\\s+motion\\s+that\\s+S\\.F\\.\\s+No\\.\\s+2909,\\s+be\\s+recommended\\s+to\\s+pass\\.',
 sf9ss1:'the\\s+second\\s+portion\\s+of\\s+the\\s+Marty\\s+division\\s+of\\s+the\\s+Pratt\\s+amendment\\s+to\\s+S\\.F\\.\\s+No\\.\\s+9\\.'
} as const;
function inspect(key:ThreeRule1210Target,text:string,override?:{yea:string;nay:string}){
 const src=MN_ORIGINAL_RULE1210_THREE[key];
 if(text.length<1000||text.length>3_000_000)throw Error('Journal text length not plausible');
 const flat=normalized(text);
 if(!flat.includes('JOURNAL OF THE SENATE')||!flat.includes(src.printedDay))
  throw Error('Original Senate Journal edition/date missing');
 const matches=[...flat.matchAll(new RegExp(MOTION_LEAD+MOTIONS[key],'gi'))];
 if(matches.length!==1||matches[0]!.index===undefined)
  throw Error('Original exact Rule 12.10 committee motion missing or duplicated');
 const m=matches[0]!,pos=m.index!;
 const before=flat.slice(Math.max(0,pos-20000),pos);
 const heading='REPORT OF VOTE IN COMMITTEE',head=before.lastIndexOf(heading);
 if(head<0||before.length-head>160)
  throw Error('Rule12.10 section not under immediate committee report heading');
 const billAt=before.lastIndexOf('S.F. No. '+src.billNo+':');
 const reporterAt=before.lastIndexOf('Senator '+src.reporter+' from the Committee on '+src.committee);
 if(reporterAt<0||billAt<0||billAt<reporterAt||
    billAt-reporterAt>440||before.length-billAt>14000)
  throw Error('Incorrect exact senator reporter or committee bill introduction');
 const remaining=flat.slice(pos+m[0].length,pos+m[0].length+1100);
 // The SF9 named vote spans Senate Journal pages 156–157, unlike a whole-bill vote.
 const seam=key==='sf9ss1'
   ? '(?:156\\s*JOURNAL\\s+OF\\s+THE\\s+SENATE\\s*\\[?\\s*7TH\\s+DAY\\s*\\]?\\s*)?'
   : '';
 const outcome=key==='sf9ss1' ? 'amendment\\s+was\\s+adopted' : 'motion\\s+prevailed';
 const re=new RegExp(
   '^\\s*There\\s+were\\s+yeas\\s+'+src.yea+'\\s+and\\s+nays\\s+'+src.nay+
   ',\\s+as\\s+follows:\\s*'+seam+
   'Those\\s+who\\s+voted\\s+in\\s+the\\s+affirmative\\s+were:\\s*Senators?\\s+([A-Za-z ,.\x27]+?)\\.\\s*'+
   'Those\\s+who\\s+voted\\s+in\\s+the\\s+negative\\s+were:\\s*Senators?\\s+([A-Za-z ,.\x27]+?)\\.\\s*'+
   'The\\s+'+outcome+'\\.', 'i');
 const found=remaining.match(re);
 if(!found)throw Error('Strict adjacent source tally/real-named vote/result not proven');
 const yes=splitNames(found[1]!),no=splitNames(found[2]!);
 if(yes.length!==src.yea||no.length!==src.nay||
   new Set([...yes,...no].map(x=>x.toLowerCase())).size!==src.yea+src.nay)
  throw Error('Named voters must be unique and agree with printed tallies');
 const y=digest('yea',yes),n=digest('nay',no);
 if(y!==(override?.yea??src.yeaDigest)||n!==(override?.nay??src.nayDigest))
  throw Error('The original individual senator-side SHA commitment failed');
 return {
  originalSourceType:'OFFICIAL_MN_SENATE_JOURNAL_RULE_12_10_COMMITTEE_NOT_FLOOR',
  bill:src.bill,committee:src.committee,session:src.session,
  sourceJournalReportDate:src.reportDay,sourceJournalPage:src.journalPage,
  exactRecordedMotion:src.motion,exactRecordedOutcome:src.outcome,
  printedYea:yes.length,printedNay:no.length,printedAbsent:null,
  motionNormalizedTextOffset:pos,resultNormalizedTextOffset:pos+m[0].length+(found.index??0),
  motionContextSHA256:sha(flat.slice(Math.max(0,pos-220),
    Math.min(flat.length,pos+m[0].length+found[0].length+120))),
  individualOriginalNamesSHA256Only:{yea:y,nay:n},
  noHearingActionTimeOrFirstPublicDateProven:true,
  distinctOriginalBillAndMotionDespiteIdenticalSides:true,
  sourceIsSpecialSessionOutsideRegularIndex:key==='sf9ss1',
  recordedActionIsAmendmentNotPassage:key==='sf9ss1',
  noPrintedAbsentFieldSoNull:true,
  noOriginalLRLPrintCommitteeMinutesComparison:true,
  noPrivateDatabaseReadOrReconciliation:true,
  noMemberVoteImport:true,noStatewideCommitteeDenominator:true,
  noFloorOrForecastOr2027Changes:true,issue864RemainsOpen:true
 };
}
export function inspectOriginalThreeRule1210CommitteeRoll(key:ThreeRule1210Target,text:string){
 return inspect(key,text);
}
export function inspectFictionalThreeRule1210CommitteeRoll(
 key:ThreeRule1210Target,text:string,yes:readonly string[],no:readonly string[]
){
 const src=MN_ORIGINAL_RULE1210_THREE[key];
 if(yes.length!==src.yea||no.length!==src.nay||
  [...yes,...no].some(x=>!/^Fictional[A-Z][a-z]{2,15}$/.test(x)))
  throw Error('Fictional-only roster required for tests');
 return inspect(key,text,{yea:digest('yea',yes),nay:digest('nay',no)});
}
