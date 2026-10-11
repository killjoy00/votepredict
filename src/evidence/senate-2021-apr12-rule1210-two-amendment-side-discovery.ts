/**
 * #864: original April 12 2021 MN Senate Journal Rule 12.10 COMMITTEE
 * amendments to TWO DISTINCT bills. Discovery of identity commitments only.
 * The names-by-voting-side are NEVER emitted; the returned SHA digests must
 * undergo a separate strict expected-digest original-PDF authentication.
 *
 * Original 11MB April 12 binary SHA and 450-char motion-window SHA values
 * were independently observed from original source workflow artifacts.
 * Do not infer meeting date, committee-vote census, private DB rows, or floor.
 */
import {createHash} from 'node:crypto';

export const APR12_TWO_AMENDMENTS={
 sourceVersion:'senate-2021-apr12-rule1210-two-distinct-amendments-provisional-sha-v1',
 originalURL:'https://www.senate.mn/journals/2021-2022/20210412036.pdf',
 originalPDFSHA256:'8dd34868badade8d3d4cd77ce11c6a632705bdd99a59509a5e4d23544f2d3d75',
 originalEmbeddedTextSHA256:'dda780e4fc076f56ff9f271303ba81897b69813acfece416b7741aea64c41214',
 originalNormalizedTextSHA256:'11def4e1a01ea4851f59d9a4ff255a13d295fe7843f4c032de27284a0504f54a',
 reportDate:'2021-04-12',
 printedDate:'MONDAY, APRIL 12, 2021',
 sf1159:{
  bill:'SF1159',number:1159,journalPage:2086,
  indexedCommittee:'Transportation Finance and Policy',
  printedYea:4,printedNay:6,outcome:'amendment not adopted',
  original450CharMotionWindowSHA256:'678c5dbbd685e0bd6325575c95e3660ce92f0941db4b1f08aa71805e99f92db1'
 },
 sf970:{
  bill:'SF970',number:970,journalPage:2147,
  indexedCommittee:'Judiciary and Public Safety Finance and Policy',
  printedYea:3,printedNay:6,outcome:'amendment not adopted',
  original450CharMotionWindowSHA256:'f49a310ef86800ec970ffd65d48c0dcd0a206cfcaca8ae6ce85ec2fa7d9f5353'
 }
} as const;
export type April12Bill='sf1159'|'sf970';
const keys=['sf1159','sf970'] as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const norm=(s:string)=>s.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const names=(s:string)=>s.replace(/,\s+and\s+/gi,', ').replace(/\s+and\s+/gi,', ')
 .split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
const sideDigest=(side:'yea'|'nay',entries:readonly string[])=>
 sha(entries.map(n=>sha(side+':'+n.toLowerCase())).sort().join('|'));
const motion=/Pursuant\s+to\s+Rule\s+12\.10,\s+upon\s+the\s+request\s+of\s+three\s+members,\s+a\s+roll\s+call\s+was\s+taken\s+on\s+the\s+([A-Za-z][A-Za-z'-]{1,45})\s+amendment\s+to\s+S\.F\.\s+No\.\s+(1159|970)\./gi;

/** Does NOT independently certify side identities; output is source-bound
 * provisional hashes for a later validator with literal expected commitments.
 */
export function discoverOriginalApril12AmendmentSideCommitments(
 input:string, options?:{fictionalSourceWindowSHA256?:Partial<Record<April12Bill,string>>}
){
 if(input.length<8000||input.length>5_000_000)
  throw Error('Original April12 Journal PDF extracted-text length is not plausible');
 const flat=norm(input);
 if(!flat.includes('JOURNAL OF THE SENATE')||!flat.includes(APR12_TWO_AMENDMENTS.printedDate))
  throw Error('Not the official April 12 2021 original Senate Journal edition');
 const windows=[...flat.matchAll(motion)].filter(x=>x.index!==undefined);
 const findings=[] as Array<{
  bill:string;indexedCommittee:string;journalReportDate:string;printedIndexJournalPage:number;
  exactMotion:string;amendmentSponsorLabel:string;printedYea:number;printedNay:number;
  printedAbsent:null;printedOutcome:string;originalMotionNormalizedTextOffset:number;
  sourceMotionSHA256:string;source450CharMotionWindowSHA256:string;
  originalNamedSideSHA256ProvisionalOnly:{yea:string;nay:string};
  sourcePrintedNamesPresentButNotEmitted:true;
  differentBillsAndAmendmentMotionsNotDeduplicated:true;
  originalNamedRollStrictlyIndependentlyAuthenticated:false;
  noCommitteeHearingTimestampEstablished:true;noPrivateDBOrFloorChange:true;
 }>;
 for(const key of keys){
  const src=APR12_TWO_AMENDMENTS[key];
  // The published PDF extraction repeats an SF1159 amendment-roll paragraph
  // without repeating the formal COMMITTEE heading. This is not a second motion.
  // Scope uniqueness to bill-exact motions immediately under their own heading.
  const heading='REPORT OF VOTE IN COMMITTEE';
  const exactBillOccurrences=windows.filter(x=>Number(x[2])===src.number);
  const matches=exactBillOccurrences.filter(x=>{
   const preceding=flat.slice(Math.max(0,x.index!-250),x.index!);
   const at=preceding.lastIndexOf(heading);
   return at>=0&&preceding.length-at<=160;
  });
  if(matches.length!==1)
   throw Error('April12 '+src.bill+' exactly one under-heading committee amendment motion not established');
  const m=matches[0]!,pos=m.index!;
  const before=flat.slice(Math.max(0,pos-250),pos);
  const headAt=before.lastIndexOf(heading);
  if(headAt<0||before.length-headAt>160)
   throw Error(src.bill+' Rule 12.10 is not beneath the immediate COMMITTEE heading');
  const sourceWindowSHA256=sha(flat.slice(pos,pos+450));
  if(sourceWindowSHA256!==(
     options?.fictionalSourceWindowSHA256?.[key]??src.original450CharMotionWindowSHA256))
   throw Error(src.bill+' authentic motion-and-voter window SHA mismatch');
  const after=flat.slice(pos+m[0].length,Math.min(flat.length,pos+m[0].length+750));
  // No intervening motion or unrelated bill may lend this amendment its roll.
  const re=new RegExp(
   '^\\s*There\\s+were\\s+yeas\\s+'+src.printedYea+'\\s+and\\s+nays\\s+'+src.printedNay+
   ',\\s+as\\s+follows:\\s*Those\\s+who\\s+voted\\s+in\\s+the\\s+affirmative\\s+were:\\s*Senators?\\s+([A-Za-z ,.\x27-]+?)\\.\\s*'+
   'Those\\s+who\\s+voted\\s+in\\s+the\\s+negative\\s+were:\\s*Senators?\\s+([A-Za-z ,.\x27-]+?)\\.\\s*'+
   'The\\s+amendment\\s+was\\s+not\\s+adopted\\.', 'i');
  const roll=after.match(re);
  if(!roll)throw Error(src.bill+' matching original named committee roll not adjacent');
  const yes=names(roll[1]!),no=names(roll[2]!);
  if(yes.length!==src.printedYea||no.length!==src.printedNay||
     new Set([...yes,...no].map(s=>s.toLowerCase())).size!==yes.length+no.length)
   throw Error(src.bill+' voter side membership not unique or mismatches the printed count');
  const mover=m[1]!;
  findings.push({
   bill:src.bill,indexedCommittee:src.indexedCommittee,
   journalReportDate:APR12_TWO_AMENDMENTS.reportDate,
   printedIndexJournalPage:src.journalPage,
   exactMotion:'the '+mover+' amendment to S.F. No. '+src.number,
   amendmentSponsorLabel:mover,
   printedYea:yes.length,printedNay:no.length,printedAbsent:null,
   printedOutcome:'amendment not adopted',
   originalMotionNormalizedTextOffset:pos,
   sourceMotionSHA256:sha(m[0]),
   source450CharMotionWindowSHA256:sourceWindowSHA256,
   originalNamedSideSHA256ProvisionalOnly:{yea:sideDigest('yea',yes),nay:sideDigest('nay',no)},
   sourcePrintedNamesPresentButNotEmitted:true,
   differentBillsAndAmendmentMotionsNotDeduplicated:true,
   originalNamedRollStrictlyIndependentlyAuthenticated:false,
   noCommitteeHearingTimestampEstablished:true,noPrivateDBOrFloorChange:true
  });
 }
 return {
  schemaVersion:APR12_TWO_AMENDMENTS.sourceVersion,
  originalJournalURL:APR12_TWO_AMENDMENTS.originalURL,
  journalReportDate:APR12_TWO_AMENDMENTS.reportDate,
  originalNormalizedTextSHA256:sha(flat),
  originalCommitteeAmendmentSideCommitmentDiscoveryOnly:findings,
  noReadableOriginalMemberBySideNamesEmitted:true,
  pendingIndependentExpectedSideSHAAuthentication:true,
  journalReportDayDoesNotEstablishOriginalCommitteeActionDayOrPublicByTime:true,
  noInferredUnprintedAbsentZero:true,
  originalLRL2021PrintMinutesNotCompared:true,
  journalSelectiveIndexNotStatewideCommitteeVoteCensus:true,
  noPrivateStoredVoteComparisonOrImport:true,
  noFloorOrModelsForecastOr2027:true,
  issue864MustRemainOpen:true
 };
}
