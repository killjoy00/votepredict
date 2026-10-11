/**
 * #864: three additional 2021 Minnesota Senate JOURNAL reports of COMMITTEE
 * Rule 12.10 named rolls. Never infer a Senate FLOOR vote or hearing action date
 * from the Journal report date. Exactly one SF2 committee report on the same
 * original Feb 8 Journal PDF previously SHA verified for SF173 (distinct bill).
 *
 * No readable authentic name-by-side lists committed, only salted side-name SHA
 * digests. Public webpage may show names, original Actions artifacts store
 * SHA identifiers only. Fictional fixture lists accepted only by mock inspector.
 */
import {createHash} from 'node:crypto';

export const RULE1210_2021_THREE_VERSION =
 'senate-2021-committee-rule1210-sf2-sf566-sf1457-original-3-roll-v1' as const;
export const THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS = [
 {
  bill:'SF2',journalDate:'2021-02-08',journalDay:11,journalPage:268,
  committee:'State Government Finance and Policy and Elections',
  committeeReporter:'Kiffmeyer',
  journalPdfURL:'https://www.senate.mn/journals/2021-2022/20210208011.pdf',
  revisorURL:'https://www.revisor.mn.gov/bills/92/2021/0/SF/2/?body=Senate',
  amended:true,reReferralInRecordedMotion:true,yea:5,nay:3,
  expectedYeaIdentityDigest:'e6753e6f7aa5a0e348cc370fc2e0f79a775a8003a80382d50c6c42861e6ef238',
  expectedNayIdentityDigest:'dd25cad1d1b0995360122b8e04709c0b1fb470cf03c95977380349f77d063c85',
  previouslySHAAuthenticatedOriginalJournalPDF:
   'e4abf92f914c719dc440e947a683ed870b6ed9bdcddad3e3454d1b6b85794f4a',
  priorOriginalSF173SourceRunId:38160752446,
  independentSenateCommitteeBillLogMeetingDateLead:'2021-02-03'
 },
 {
  bill:'SF566',journalDate:'2021-02-17',journalDay:15,journalPage:417,
  committee:'Agriculture and Rural Development Finance and Policy',
  committeeReporter:'Westrom',
  journalPdfURL:'https://www.senate.mn/journals/2021-2022/20210217015.pdf',
  revisorURL:'https://www.revisor.mn.gov/bills/92/2021/0/SF/566/?body=Senate',
  amended:true,reReferralInRecordedMotion:false,yea:7,nay:1,
  expectedYeaIdentityDigest:'6292ce361845962c070381faf313fd9b21d8012e3181d5a47ae7a3adcfbfbe9a',
  expectedNayIdentityDigest:'fc88ea27906bc8fd8255ed2b937aa91541db8c92b5cdaf704c5d1a7b6ed2021f',
  previouslySHAAuthenticatedOriginalJournalPDF:null,
  priorOriginalSF173SourceRunId:null,
  independentSenateCommitteeBillLogMeetingDateLead:null
 },
 {
  bill:'SF1457',journalDate:'2021-03-10',journalDay:23,journalPage:764,
  committee:'Judiciary and Public Safety Finance and Policy',
  committeeReporter:'Limmer',
  journalPdfURL:'https://www.senate.mn/journals/2021-2022/20210310023.pdf',
  revisorURL:'https://www.revisor.mn.gov/bills/92/2021/0/SF/1457/?body=Senate',
  amended:false,reReferralInRecordedMotion:true,yea:7,nay:2,
  expectedYeaIdentityDigest:'515c7a2170f44727ea32ff192caacf14093ea6fd5c3083482fc71e355990ba4a',
  expectedNayIdentityDigest:'65b432dda9f62bea3cbe3e67f836cbcc214fa8396ecc22a0f0cbeebdb1e86ee2',
  previouslySHAAuthenticatedOriginalJournalPDF:null,
  priorOriginalSF173SourceRunId:null,
  independentSenateCommitteeBillLogMeetingDateLead:'2021-03-08'
 }
] as const;

export type New2021JournalBill=(typeof THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS)[number]['bill'];
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const normalized=(x:string)=>x.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const names=(x:string)=>x.replace(/,\s+and\s+/gi,', ')
 .replace(/\s+and\s+/gi,', ').split(/\s*,\s*/).map(y=>y.trim()).filter(Boolean);
const sideHashes=(side:'yea'|'nay',memberNames:readonly string[])=>
 memberNames.map(x=>sha(side+':'+x.toLowerCase())).sort();
const sideDigest=(members:readonly string[])=>sha([...members].sort().join('|'));

type Spec=(typeof THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS)[number];
function inspectOriginalJournalCommitteeRoll(text:string,spec:Spec,overrides?:{
  fakeYeaDigest:string;fakeNayDigest:string;
}){
 if(text.length<600||text.length>2_000_000)
  throw Error('Journal original embedded text outside strict bounded size');
 const flat=normalized(text);
 const dateWords=spec.journalDate==='2021-02-08'
  ?'FEBRUARY 8, 2021':spec.journalDate==='2021-02-17'
  ?'FEBRUARY 17, 2021':'MARCH 10, 2021';
 if(!flat.toUpperCase().includes(dateWords)||
    !flat.includes('JOURNAL OF THE SENATE'))
  throw Error('Wrong original official 2021 Journal publication/date');
 const n=spec.bill.slice(2);
 const phrasing=spec.amended?'as\\s+amended,\\s+':'';
 const motionTail=spec.reReferralInRecordedMotion
  ?'\\s+and\\s+be\\s+re-referred\\.':'\\.';
 const introPattern=new RegExp(
  '\\bPursuant\\s+to\\s+Rule\\s+12\\.10,\\s+upon\\s+the\\s+request\\s+of\\s+three\\s+members,\\s+a\\s+roll\\s+call\\s+was\\s+taken\\s+on\\s+the\\s+motion\\s+that\\s+S\\.F\\.\\s+No\\.\\s+'+
  n+',\\s+'+phrasing+'be\\s+recommended\\s+to\\s+pass'+motionTail,
  'gi'
 );
 const starts=[...flat.matchAll(introPattern)];
 if(starts.length!==1||starts[0]!.index===undefined)
  throw Error('Rule12.10 journal motion wrong SF/version/referral or appears multiple times');
 const begin=starts[0]!.index!;
 const pre=flat.slice(Math.max(0,begin-2600),begin);
 const heading=pre.lastIndexOf('REPORT OF VOTE IN COMMITTEE');
 if(heading<0||pre.length-heading>180)
  throw Error('Exact journal paragraph not immediately under REPORT OF VOTE IN COMMITTEE');
 // The separate adjacent bill report uniquely associates this Rule12.10 named
 // committee vote with the proper committee, NOT Senate floor action.
 const b=pre.lastIndexOf('S.F. No. '+n+':');
 if(b<0||b>heading||heading-b>2100||
    !pre.slice(Math.max(0,b-350),b).includes('Committee on '+spec.committee)||
    !pre.slice(Math.max(0,b-350),b).includes('Senator '+spec.committeeReporter))
  throw Error('Original Rule12.10 report not adjacent to expected committee and SF');
 const after=flat.slice(begin+starts[0]![0].length,
  Math.min(flat.length,begin+starts[0]![0].length+980));
 const match=after.match(
  /\bThere\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),\s+as\s+follows:\s+Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:\s+Senators?\s+([A-Za-z ,.']+?)\.\s+Those\s+who\s+voted\s+in\s+the\s+negative\s+were:\s+Senators?\s+([A-Za-z ,.']+?)\.\s+The\s+motion\s+prevailed\b/i
 );
 if(!match||match.index===undefined||!match[0])
  throw Error('Named Rule12.10 committee YES/NO lists and carried outcome missing');
 const yea=names(match[3]!),nay=names(match[4]!);
 if(Number(match[1])!==spec.yea||Number(match[2])!==spec.nay||
    yea.length!==spec.yea||nay.length!==spec.nay||
    new Set([...yea,...nay]).size!==spec.yea+spec.nay)
  throw Error('2021 printed Rule12.10 named partition/tally does not match source');
 const yHashes=sideHashes('yea',yea),nHashes=sideHashes('nay',nay);
 const yDigest=sideDigest(yHashes),nDigest=sideDigest(nHashes);
 if(yDigest!==(overrides?.fakeYeaDigest??spec.expectedYeaIdentityDigest)||
  nDigest!==(overrides?.fakeNayDigest??spec.expectedNayIdentityDigest))
  throw Error('Unexpected historical individual YES/NO choice side identity');
 const motionAt=begin;
 const resultAt=begin+starts[0]![0].length+match.index;
 return {
  originalType:'OFFICIAL_SENATE_JOURNAL_RULE_12_10_COMMITTEE_NOT_FLOOR',
  bill:spec.bill,senateJournalReportDate:spec.journalDate,
  originalJournalPage:spec.journalPage,originalJournalDay:spec.journalDay,
  namedSourceCommittee:spec.committee,
  exactRecordedMotionSubject:(spec.amended?'as amended ':'')+
    'recommend pass'+(spec.reReferralInRecordedMotion?' and re-refer':''),
  printedYeaCount:yea.length,printedNayCount:nay.length,printedAbsentCount:null,
  passed:true,originalRule1210SingleCommitteeRollVerified:true,
  originalMotionTextOffset:motionAt,originalResultTextOffset:resultAt,
  originalMotionNeighborhoodSHA256:sha(flat.slice(
   Math.max(0,motionAt-260),Math.min(flat.length,resultAt+match[0].length+130))),
  sourceMemberSideHashesOnly:{yea:yHashes,nay:nHashes},
  originalPerSideIdentityDigest:{yea:yDigest,nay:nDigest},
  sourceOnlyJournalReportDateNotCommitteeMeetingDate:true,
  namedCommitteeRollNotSenateFloorVote:true,
  notAnOfficial2021PrintedCommitteeMinutesComparison:true,
  noSourceToDatabaseMemberVoteReconciliation:true,
  noFullReadableMemberSideListsCommitted:true,
  noStatewide2021to2025CommitteeVoteDenominator:true,
  noIndividualVoteImport:true,
  noSameDayForecastDateWithoutExactClock:true
 };
}
export function inspectAuthenticNew2021JournalCommitteeRoll(text:string,bill:New2021JournalBill){
 const s=THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.find(x=>x.bill===bill);
 if(!s)throw Error('Unexpected original 2021 committee bill');
 return inspectOriginalJournalCommitteeRoll(text,s);
}
/** For tests only: impossible to accidentally use historical name sides as fixtures. */
export function inspectFictionalNew2021JournalCommitteeRoll(
 text:string,bill:New2021JournalBill,
 fakeYea:readonly string[],fakeNay:readonly string[]
){
 const s=THREE_ORIGINAL_RULE1210_2021_JOURNAL_REPORTS.find(x=>x.bill===bill);
 if(!s||!fakeYea.length||!fakeNay.length||
  !fakeYea.every(x=>/^Fictional[A-Z][a-z]{2,15}$/.test(x))||
  !fakeNay.every(x=>/^Fictional[A-Z][a-z]{2,15}$/.test(x)))
  throw Error('All source fixture identities must use fictional test-only prefix');
 return inspectOriginalJournalCommitteeRoll(text,s,{
  fakeYeaDigest:sideDigest(sideHashes('yea',fakeYea)),
  fakeNayDigest:sideDigest(sideHashes('nay',fakeNay))
 });
}
