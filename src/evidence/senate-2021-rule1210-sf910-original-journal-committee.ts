/**
 * #864 Minnesota Senate JOURNAL Rule12.10 COMMITTEE named roll, SF910.
 * March 8, 2021 is a Journal REPORT date, not independently verified
 * original committee hearing/roll clock. Distinct from SF1470 despite
 * matching all named YES/NO side identities and its identical 4/3 tally.
 * No senator-name-by-side source lists are committed.
 */
import {createHash} from 'node:crypto';
export const SF910_2021_COMMITTEE_SOURCE={
 version:'senate-2021-rule1210-sf910-original-journal-committee-4-3-v1',
 journalReportDate:'2021-03-08',journalDay:21,journalPage:714,
 committee:'Housing Finance and Policy',bill:'SF910',committeeReporter:'Draheim',
 originalJournalURL:'https://www.senate.mn/journals/2021-2022/20210308021.pdf',
 revisorStatus:'https://www.revisor.mn.gov/bills/92/2021/0/SF/910/?body=Senate',
 originalMotion:'as amended recommend pass and re-refer',
 yesCount:4,noCount:3,absentPrinted:null,
 expectedYeaIdentitySHA256:'f2750046130a7dbab650f71bad840c49066fe0c322df76fc1c13607a972c60a5',
 expectedNayIdentitySHA256:'898d90853fbf1e2063a6917256d0498327994b08278b53cb9b05560e6d5eaa9f',
 previouslyVerifiedDifferentBillWithSameSideIdentities:'SF1470',
 previouslyVerifiedDifferentBillJournalPage:666,
 originalJournalPageSourceTextVerifiedViaOfficialSenatePDF:true,
 originalPdfBinaryShaAuthenticatedByNewWorker:false
} as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const norm=(s:string)=>s.replace(/\u0000/g,' ')
 // pdf-parse can insert page delimiters between a roll label and its names.
 .replace(/--\s*\d+\s+of\s+\d+\s*--/g,' ')
 .replace(/\s+/g,' ').trim();
const names=(s:string)=>s.replace(/,\s+and\s+/gi,', ').replace(/\s+and\s+/gi,', ')
 .split(/\s*,\s*/).map(s=>s.trim()).filter(Boolean);
const commitment=(side:'yea'|'nay',names:readonly string[])=>
 sha(names.map(n=>sha(side+':'+n.toLowerCase())).sort().join('|'));
function inspect(input:string,override?:{yea:string;nay:string}){
 if(input.length<1000||input.length>2_000_000)
  throw Error('SF910 original source text bounds invalid');
 const flat=norm(input);
 if(!/MONDAY,\s+MARCH\s+8,\s+2021/i.test(flat)||
  !/JOURNAL\s+OF\s+THE\s+SENATE/i.test(flat))
  throw Error('Not the original March8 2021 official Senate Journal');
 const marker='REPORT OF VOTE IN COMMITTEE';
 const pattern=/\bPursuant\s+to\s+Rule\s+12\.10,\s+upon\s+the\s+request\s+of\s+three\s+members,\s+a\s+roll\s+call\s+was\s+taken\s+on\s+the\s+motion\s+that\s+S\.F\.\s+No\.\s+910,\s+as\s+amended,\s+be\s+recommended\s+to\s+pass\s+and\s+be\s+re-referred\./gi;
 const matches=[...flat.matchAll(pattern)];
 if(matches.length!==1||matches[0]!.index===undefined)
  throw Error('Original SF910 Rule12.10 as amended pass/referral motion not uniquely found');
 const start=matches[0]!.index!;
 const preceding=flat.slice(Math.max(0,start-1800),start);
 const heading=preceding.lastIndexOf(marker);
 if(heading<0||preceding.length-heading>160)
  throw Error('The SF910 recorded roll not under committee report heading');
 const billIntro=preceding.lastIndexOf('S.F. No. 910:');
 if(billIntro<0||billIntro>heading||
  !preceding.slice(Math.max(0,billIntro-290),billIntro).includes(
   'Senator Draheim from the Committee on Housing Finance and Policy'))
  throw Error('Wrong 2021 committee reporter/original SF910 bill report context');
 const after=flat.slice(start+matches[0]![0].length,
  Math.min(flat.length,start+matches[0]![0].length+680));
 const match=after.match(
  /\bThere\s+were\s+yeas\s+4\s+and\s+nays\s+3,\s+as\s+follows:\s+Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:\s+(?:(?:714\s*JOURNAL\s+OF\s+THE\s+SENATE\s*\[?\s*21ST\s+DAY\s*\]?|21ST\s+DAY\s*\]?\s*MONDAY,\s*MARCH\s+8,\s+2021\s*715)\s*)?Senators?\s+([A-Za-z ,.']+?)\.\s+Those\s+who\s+voted\s+in\s+the\s+negative\s+were:\s+Senators?\s+([A-Za-z ,.']+?)\.\s+The\s+motion\s+prevailed\b/i
 );
 if(!match||match.index===undefined||match.index>18)
  throw Error('Original SF910 exact printed committee 4/3 YEA/NAY must immediately follow its own motion and prevail');
 const yea=names(match[1]!),nay=names(match[2]!);
 if(yea.length!==4||nay.length!==3||new Set([...yea,...nay]).size!==7)
  throw Error('SF910 named member choices not exactly seven distinct senators');
 const y=commitment('yea',yea),n=commitment('nay',nay);
 if(y!==(override?.yea??SF910_2021_COMMITTEE_SOURCE.expectedYeaIdentitySHA256)||
  n!==(override?.nay??SF910_2021_COMMITTEE_SOURCE.expectedNayIdentitySHA256))
  throw Error('SF910 authentic individually printed senator-side identity digest mismatch');
 const finish=start+matches[0]![0].length+match.index!;
 return {
  originalSourceType:'OFFICIAL_SENATE_JOURNAL_2021_COMMITTEE_RULE1210_NOT_FLOOR',
  hearingDateEstablishedByOriginalCommitteeMinutes:false,
  senateJournalReportDate:SF910_2021_COMMITTEE_SOURCE.journalReportDate,
  bill:'SF910',committee:SF910_2021_COMMITTEE_SOURCE.committee,
  recordedMotion:'as amended recommend pass and re-refer',
  sourcePrintedYea:yea.length,sourcePrintedNay:nay.length,
  sourcePrintedAbsent:null,
  sourceMotionPrevailed:true,
  originalMotionNormalizedTextOffset:start,
  originalResultNormalizedTextOffset:finish,
  sourceMotionNeighborhoodSHA256:sha(flat.slice(
   Math.max(0,start-300),Math.min(flat.length,finish+match[0].length+125))),
  sourceNamesIdentitySHA256Only:{yea:y,nay:n},
  previousSF1470HasSameSideIdentitiesButDifferentBillAndMotion:true,
  noSecondVoteInferredFromAmendmentsAdoptedBillReportRecap:true,
  journalReportDateNotProvenMotionDate:true,
  sourceNotLRL2021OriginalPrintedCommitteeMinutes:true,
  originalAbsentRowMissingNotZero:true,
  sourceSidesNotPublishedInRepository:true,
  noDatabaseMemberVoteImport:true,
  noStatewideCommitteeDenominator:true,
  noFloorVotesOr2027:true,
  issue864MustRemainOpen:true
 };
}
export const inspectOriginalSF9102021JournalCommitteeRoll=(text:string)=>inspect(text);
export function inspectFictionalSF9102021JournalCommitteeRoll(
 text:string,fictionalYea:readonly string[],fictionalNay:readonly string[]
){
 if(fictionalYea.length!==4||fictionalNay.length!==3||
  [...fictionalYea,...fictionalNay].some(x=>!/^Fictional[A-Z][a-z]{2,15}$/.test(x)))
  throw Error('SF910 test roster must contain seven fictitious test-only identities');
 return inspect(text,{yea:commitment('yea',fictionalYea),nay:commitment('nay',fictionalNay)});
}
