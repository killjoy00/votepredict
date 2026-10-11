/**
 * #864 Official 2021 Senate Journal MISCELLANEOUS INDEX original PDF:
 * find Rule 12.10 Committee Vote Report references. These are INDEXED
 * PUBLICATION REFERENCES, not historical committee roll denominators.
 * Requires original bytes for actual counts; no guessed statewide claims.
 */
import {createHash} from 'node:crypto';
export const SENATE_2021_RULE1210_INDEX_VERSION=
 'senate-2021-official-misc-journal-rule1210-publication-reference-discovery-v1' as const;
export const SENATE_2021_MISC_JOURNAL_PDF=
 'https://www.senate.mn/journals/2021-2022/2021misc.pdf' as const;
const sha=(t:string)=>createHash('sha256').update(t).digest('hex');
const norm=(t:string)=>t.replace(/\u0000/g,' ')
 .replace(/[ \t\r\n]+/g,' ').trim();
export function find2021SenateJournalRule1210IndexReferences(
 originalExtractedText:string
){
 if(originalExtractedText.length<500||originalExtractedText.length>3_000_000)
  throw Error('2021 original journal miscellaneous index extracted text outside bounded range');
 const flat=norm(originalExtractedText);
 if(!/\bMISCELLANEOUS\s+INDEX\b/i.test(flat))
  throw Error('Not official Senate Journal MISCELLANEOUS INDEX source');
 const rule12=[...flat.matchAll(/\bRule\s*#?\s*12\.10\b/gi)];
 if(rule12.length!==1||rule12[0]!.index===undefined)
  throw Error('Original 2021 Journal index Rule #12.10 heading not uniquely present');
 const at=rule12[0]!.index!;
 // DO NOT incorporate following Rule #14.1 references (or other later rules),
 // and DO NOT accidentally treat all journal references as committee votes.
 const post=flat.slice(at);
 const follow=post.match(/\bRule\s*#?\s*14\.1\b/i);
 if(!follow||follow.index===undefined||follow.index<70||follow.index>18_000)
  throw Error('Original index Rule12.10 section not bounded by later Rule14.1 section');
 const section=post.slice(0,follow.index);
 const refs=[...section.matchAll(
  /\bS\.?\s*F\.?\s*(\d{1,5})\s*\.{2,}\s*(\d{1,5})\b/gi
 )].map(x=>({bill:'SF'+Number(x[1]),journalPrintedPage:Number(x[2])}));
 if(refs.length<3||refs.length>150||
  new Set(refs.map(x=>x.bill+':'+x.journalPrintedPage)).size!==refs.length)
  throw Error('Rule12.10 source indexed bill-page references missing/duplicated or implausible');
 if(refs.some(x=>x.journalPrintedPage<1||x.journalPrintedPage>10_000))
  throw Error('Indexed Journal page outside historical print-page bounds');
 return {
  referenceScope:'ONLY_OFFICIAL_2021_SENATE_JOURNAL_MISC_INDEX_RULE1210',
  sourceSpecificRuleHeadingCount:rule12.length,
  foundUniqueBoundedRule12BeforeRule14Section:true,
  sectionSourceStartNormalizedTextOffset:at,
  sectionSourceEndNormalizedTextOffset:at+follow.index,
  candidateIndexedRule1210BillPageReferences:refs,
  candidateReferencePairsFound:refs.length,
  candidateIndexedUniqueSFNumbers:[...new Set(refs.map(x=>x.bill))].sort(),
  indexSectionSHA256:sha(section),
  boundedVisibleSourcePreviewForResearch:section.slice(0,5600),
  potentialIndexExtractionMissesPossible:true,
  notVerifiedFull2021JournalRule1210Census:true,
  rule1210IndexNotAllSenateCommitteeVotes:true,
  rule1210IndexReferencesNotNamedRollSourceObservations:true,
  noCommitteeMemberVoteSideAssignments:true,
  noFloorVotesOrStatewideCoverageInferred:true,
  not2021OfficialPrintedLRLCommitteeMinuteVolume:true,
  noProductionPrivateDatabaseReadsWrites:true,
  issue864MustRemainOpen:true
 };
}
