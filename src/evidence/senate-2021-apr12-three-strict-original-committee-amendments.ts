/**
 * #864 original official Minnesota Senate Rule12.10 COMMITTEE amendments,
 * April12 2021. Independently pinned SECOND original source acquisition.
 *
 * The same 4/6 named sides on separate SF1159 amendment motions MUST NOT
 * coalesce into one event. No actual readable senator-by-side lists committed.
 * Journal report day is not an independently proved meeting/publication cutoff.
 */
import {createHash} from 'node:crypto';

export const APR12_THREE_STRICT_ORIGINAL={
 version:'mn-2021-04-12-three-strict-original-rule1210-committee-amendments-v1',
 sourceURL:'https://www.senate.mn/journals/2021-2022/20210412036.pdf',
 journalReportDay:'2021-04-12',
 originalPDFBytes:11063699,
 originalPDFSHA256:'8dd34868badade8d3d4cd77ce11c6a632705bdd99a59509a5e4d23544f2d3d75',
 originalEmbeddedTextSHA256:'dda780e4fc076f56ff9f271303ba81897b69813acfece416b7741aea64c41214',
 originalNormalizedTextSHA256:'e3a5ec1d843e7168355a62e24fbe4d85eb8af161f7026c65d8b22abc5d9e751b',
 motions:[
  {
   bill:'SF1159',committee:'Transportation Finance and Policy',
   mover:'Dibble',amendmentOrdinal:1,journalPage:2086,
   printedYea:4,printedNay:6,printedAbsent:null,
   originalMotionNormalizedOffset:1380048,
   originalResultNormalizedOffset:1380170,
   originalMotionNeighborhoodSHA256:'162cf848407798e95f051fa910e78736aca0a2015be310e16600c66897bf47c4',
   originalYeaNamesSHA256:'5c3ccbac5d302497035fcd4634b3539fcefbe3f269f900e065c0a080441bdc83',
   originalNayNamesSHA256:'43abc6a115890592bc70e406491bfdc9c25d8707584364eeefb02226943f5dfc'
  },
  {
   bill:'SF1159',committee:'Transportation Finance and Policy',
   mover:'McEwen',amendmentOrdinal:2,journalPage:2086,
   printedYea:4,printedNay:6,printedAbsent:null,
   originalMotionNormalizedOffset:1380442,
   originalResultNormalizedOffset:1380564,
   originalMotionNeighborhoodSHA256:'41f86b874e6f2c9e86fdf8901465f9aa3fe69fff4036b78ee7aed3cfbe441f37',
   originalYeaNamesSHA256:'5c3ccbac5d302497035fcd4634b3539fcefbe3f269f900e065c0a080441bdc83',
   originalNayNamesSHA256:'43abc6a115890592bc70e406491bfdc9c25d8707584364eeefb02226943f5dfc'
  },
  {
   bill:'SF970',committee:'Judiciary and Public Safety Finance and Policy',
   mover:'Pappas',amendmentOrdinal:1,journalPage:2147,
   printedYea:3,printedNay:6,printedAbsent:null,
   originalMotionNormalizedOffset:1531950,
   originalResultNormalizedOffset:1532071,
   originalMotionNeighborhoodSHA256:'a604cfab351ab92003b0aa3d46194d22d5d63fe575d19728e53f64dd816cc0ed',
   originalYeaNamesSHA256:'8e209fef83110a3bdda0d988830c014f6f47688c1baabf516b3d0c60e1da3858',
   originalNayNamesSHA256:'57dbdf6228cc241dc72bd0a23ae60d939e6ee19c2ac6042188a7ef12b459a314'
  }
 ] as const
} as const;

type MotionSpec={
 bill:string;committee:string;mover:string;amendmentOrdinal:number;journalPage:number;
 printedYea:number;printedNay:number;
 originalMotionNormalizedOffset?:number;originalResultNormalizedOffset?:number;
 originalMotionNeighborhoodSHA256?:string;
 originalYeaNamesSHA256:string;originalNayNamesSHA256:string
};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const normalize=(s:string)=>s.replace(/\u0000/g,' ')
 .replace(/--\s*\d+\s+of\s+\d+\s*--/g,' ')
 .replace(/\s+/g,' ').trim();
const roster=(s:string)=>s.replace(/,\s+and\s+/gi,', ')
 .replace(/\s+and\s+/gi,', ').split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
const sideSHA=(side:'yea'|'nay',list:string[])=>
 sha(list.map(x=>sha(side+':'+x.toLowerCase())).sort().join('|'));
const introduction=/Pursuant\s+to\s+Rule\s+12\.10,\s+upon\s+the\s+request\s+of\s+three\s+members,\s+a\s+roll\s+call\s+was\s+taken\s+on\s+the\s+([\p{L}\p{M} .'-]+?)\s+amendment\s+to\s+S\.F\.\s+No\.\s+(1159|970)\./giu;
const adjacentRoll=/^\s*There\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),\s+as\s+follows:\s*Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:\s*Senators?\s+([\p{L}\p{M} ,.'-]+?)\.\s*Those\s+who\s+voted\s+in\s+the\s+negative\s+were:\s*Senators?\s+([\p{L}\p{M} ,.'-]+?)\.\s*The\s+amendment\s+was\s+not\s+adopted\./iu;
function inspect(text:string,specs:readonly MotionSpec[],enforceOriginalOffsets:boolean){
 if(text.length<8000||text.length>5_000_000)
  throw Error('Strict April12 original journal text bounds violated');
 const flat=normalize(text);
 if(!flat.includes('JOURNAL OF THE SENATE')||!flat.includes('MONDAY, APRIL 12, 2021'))
  throw Error('Not the original Minnesota Senate April12 2021 daily Journal edition');
 const sourceTextSha=sha(text);
 const normalSHA=sha(flat);
 if(enforceOriginalOffsets&&
  (sourceTextSha!==APR12_THREE_STRICT_ORIGINAL.originalEmbeddedTextSHA256||
   normalSHA!==APR12_THREE_STRICT_ORIGINAL.originalNormalizedTextSHA256))
  throw Error('Original daily Journal extracted/normalized text SHA commitment mismatch');
 const intros=[...flat.matchAll(introduction)];
 if(intros.length!==3||specs.length!==3)
  throw Error('Original Journal must contain exactly three distinct targeted committee amendment roll introductions');
 const motions=[];
 for(let i=0;i<3;i++){
  const spec=specs[i]!,m=intros[i]!;
  if(m.index===undefined||m[1]!==spec.mover||'SF'+m[2]!==spec.bill)
   throw Error('Original Rule12.10 bill + precise proposer/order identity mismatch');
  const at=m.index,next=intros[i+1]?.index??flat.length;
  const heading=flat.slice(Math.max(0,at-650),at).lastIndexOf('REPORT OF VOTE IN COMMITTEE');
  if(heading<0)throw Error('Original amendment not under nearby Report of Vote in Committee heading');
  const after=flat.slice(at+m[0].length,Math.min(next,at+m[0].length+1400));
  const vote=after.match(adjacentRoll);
  if(!vote)throw Error('Original named 4/6 or 3/6 division or failed amendment result not adjacent');
  const yes=roster(vote[3]!),no=roster(vote[4]!);
  const yc=Number(vote[1]),nc=Number(vote[2]);
  if(yc!==spec.printedYea||nc!==spec.printedNay||yes.length!==yc||
    no.length!==nc||new Set([...yes,...no].map(x=>x.toLowerCase())).size!==yc+nc)
    throw Error('Strict original printed tally/unique senator roster disagreement');
  const y=sideSHA('yea',yes),n=sideSHA('nay',no);
  if(y!==spec.originalYeaNamesSHA256||n!==spec.originalNayNamesSHA256)
   throw Error('Pinned exact original committee senator-side SHA digest mismatch');
  const resultAt=at+m[0].length+(vote.index??0);
  const neighborhood=sha(flat.slice(Math.max(0,at-160),
   Math.min(flat.length,resultAt+vote[0].length+100)));
  if(enforceOriginalOffsets&&(
    at!==spec.originalMotionNormalizedOffset||
    resultAt!==spec.originalResultNormalizedOffset||
    neighborhood!==spec.originalMotionNeighborhoodSHA256))
   throw Error('Original source motion/result offsets/context hash drifted');
  motions.push({
   bill:spec.bill,committee:spec.committee,mover:spec.mover,
   amendmentOrdinal:spec.amendmentOrdinal,
   originalJournalPage:spec.journalPage,
   originalMotionType:'Rule12.10 COMMITTEE amendment, not floor or bill passage',
   outcome:'amendment not adopted',
   originalPrintedYea:yc,originalPrintedNay:nc,originalPrintedAbsent:null,
   originalMotionNormalizedTextOffset:at,
   originalResultNormalizedTextOffset:resultAt,
   originalMotionNeighborhoodSHA256:neighborhood,
   originalIndividualSenatorSideSHA256Only:{yea:y,nay:n},
   committeeRollOriginalPublishedTextAuthenticated:enforceOriginalOffsets,
   journalReportDateNotOriginalCommitteeMeetingTime:true,
   sameVoterSidesDoNotDeduplicateSeparateAmendments:true,
   noMemberVotesOrProductionDatabaseChanged:true
  });
 }
 if(motions[0]!.bill!=='SF1159'||motions[1]!.bill!=='SF1159'||
    motions[0]!.mover===motions[1]!.mover||motions[0]!.originalMotionNormalizedTextOffset===
    motions[1]!.originalMotionNormalizedTextOffset)
  throw Error('Two separate original SF1159 amendments cannot be coalesced');
 return {
  version:APR12_THREE_STRICT_ORIGINAL.version,
  sourceOriginalJournalURL:APR12_THREE_STRICT_ORIGINAL.sourceURL,
  originalSenateJournalReportDate:APR12_THREE_STRICT_ORIGINAL.journalReportDay,
  originalExtractedTextSHA256:sourceTextSha,
  originalNormalizedTextSHA256:normalSHA,
  independentlyPinnedExactOriginalCommitteeNamedRolls:enforceOriginalOffsets?3:0,
  distinctOriginalCommitteeAmendmentMotions:motions,
  missingAbsentFieldIsNull:true,
  sameNameSidesOnSeparateBillsOrAmendmentsAreNotDuplicates:true,
  noOriginalHearingTimeOrPublicFirstDateProven:true,
  noOriginalReadableSenatorSideRosterCommitted:true,
  noPrivateStoredVotesReconciliation:true,
  noStatewideCommitteeVoteCensus:true,
  noSenateFloorOrModelsOrForecastOr2027:true,issue864RemainsOpen:true
 };
}
export function verifyThreeOriginalApril12CommitteeAmendmentRolls(text:string){
 return inspect(text,APR12_THREE_STRICT_ORIGINAL.motions,true);
}
/** Deliberately synthetic regression only: no actual historic member-side names. */
export function inspectFictionalThreeApril12CommitteeAmendments(
 text:string,
 fixtures:readonly {
  mover:string;bill:'SF1159'|'SF970';yes:readonly string[];no:readonly string[]
 }[]
){
 if(fixtures.length!==3||fixtures.some(f=>
  !/^Fictional[A-Za-z]{3,20}$/.test(f.mover)||
  [...f.yes,...f.no].some(n=>!/^Fictional[A-Za-z]{3,20}$/.test(n))))
  throw Error('Only fictional regression senator identities are permitted');
 const specs:MotionSpec[]=APR12_THREE_STRICT_ORIGINAL.motions.map((real,i)=>({
  bill:fixtures[i]!.bill,mover:fixtures[i]!.mover,committee:real.committee,
  amendmentOrdinal:real.amendmentOrdinal,journalPage:real.journalPage,
  printedYea:real.printedYea,printedNay:real.printedNay,
  originalYeaNamesSHA256:sideSHA('yea',[...fixtures[i]!.yes]),
  originalNayNamesSHA256:sideSHA('nay',[...fixtures[i]!.no])
 }));
 return inspect(text,specs,false);
}
