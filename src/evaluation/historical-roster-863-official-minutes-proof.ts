/**
 * #863: original official PDF public-source corroboration, not historical model
 * features. An original PDF numeric tally is NOT proof of individual names.
 * No historical target vote outcomes or DB access.
 */
import {createHash} from 'node:crypto';
import type {SenateCommitteeVoteObservation} from '../evidence/minnesota-senate-committee-minutes.js';

export const SENATE863_ORIGINAL_MARKER='ROSTER_863_FIFTY_PUBLIC_ORIGINALS_V1_20261018';
export type OfficialSourceTarget863={
 publicEventReference:string;session:string;occurredOn:string;bill:string;
 voteKind:string;committeeVote:boolean;
 declared:{yea:number;nay:number;other:number};
 named:{yea:number;nay:number;other:number};
 sourceUrl:string;internalMismatchClass:string;
};
export function assertSenate863OfficialSourceUrl(url:string):true{
 let parsed:URL;
 try{parsed=new URL(url)}catch{throw Error('Malformed original source URL')}
 if(parsed.protocol!=='https:'||parsed.hostname!=='www.lrl.mn.gov'||
    parsed.username||parsed.password||parsed.search||parsed.hash||
    !/^\/archive\/minutes\/senate\/20(22|23|24|25)\/[A-Za-z]+\/20\d{6}\/[A-Za-z0-9_-]+\.pdf$/.test(parsed.pathname))
    throw Error('Unallowlisted official source URL');
 return true;
}
export function validateSenate863SourceTargets(targets:readonly OfficialSourceTarget863[]):true{
 if(targets.length!==50||new Set(targets.map(x=>x.publicEventReference)).size!==50||
  new Set(targets.map(x=>x.sourceUrl)).size!==30)
   throw Error('50-event / 30-source original frozen scope changed');
 for(const t of targets){
  assertSenate863OfficialSourceUrl(t.sourceUrl);
  if(!/^[a-f0-9]{20}$/.test(t.publicEventReference)||
   !['2021-2022','2023-2024','2025-2026'].includes(t.session)||
   !/^\d{4}-\d{2}-\d{2}$/.test(t.occurredOn)||
   !['amendment','motion'].includes(t.voteKind)||t.committeeVote!==true||
   t.declared.yea===t.named.yea&&t.declared.nay===t.named.nay||
   [t.declared.yea,t.declared.nay,t.declared.other,
    t.named.yea,t.named.nay,t.named.other].some(x=>!Number.isSafeInteger(x)||x<0)||
   !t.sourceUrl.includes(t.occurredOn.replace(/-/g,'')))
   throw Error('Noncanonical or altered public original target');
 }
 return true;
}
export function analyzeSenate863Original(
 t:OfficialSourceTarget863,observations:readonly SenateCommitteeVoteObservation[],
):{
 publicEventReference:string;session:string;bill:string;occurredOn:string;
 declared:{yea:number;nay:number};storedNamed:{yea:number;nay:number};
 exactBillTallyCandidates:number;countOnlyMatches:number;
 fullNamedRollMatches:number;originalTallyClass:string;
 parserProofNotWholeEventIdentity:true;
}{
 const candidates=observations.filter(o=>o.yeaCount===t.declared.yea &&
   o.nayCount===t.declared.nay &&
   (t.bill==='NO_BILL'||o.billIdentifier===t.bill));
 const named=candidates.filter(o=>o.individualVotesAvailable===true &&
   o.memberVotes.length===t.declared.yea+t.declared.nay);
 const counts=candidates.filter(o=>!o.individualVotesAvailable);
 const cls=candidates.length===0?'no_exact_bill_tally_in_parser':
  candidates.length>1?'ambiguous_multiple_original_tally_candidates':
  named.length===1?'original_exact_tally_with_complete_printed_named_roll':
  'original_exact_count_only_tally';
 return {
  publicEventReference:t.publicEventReference,session:t.session,bill:t.bill,
  occurredOn:t.occurredOn,
  declared:{yea:t.declared.yea,nay:t.declared.nay},
  storedNamed:{yea:t.named.yea,nay:t.named.nay},
  exactBillTallyCandidates:candidates.length,
  countOnlyMatches:counts.length,fullNamedRollMatches:named.length,
  originalTallyClass:cls,
  parserProofNotWholeEventIdentity:true,
 };
}
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export function summarizeSenate863OriginalProof(rows:readonly ReturnType<typeof analyzeSenate863Original>[],
 docs:readonly{sourceUrl:string;bytes:number;sha256:string;extractionMethod:string;status:string}[]) {
 if(rows.length!==50||docs.length!==30||
  new Set(rows.map(x=>x.publicEventReference)).size!==50||
  new Set(docs.map(x=>x.sourceUrl)).size!==30)
  throw Error('Original public audit is not a complete 50-event/30-source census');
 const keys=[...new Set(rows.map(x=>x.originalTallyClass))].sort();
 const summary=Object.fromEntries(keys.map(k=>[k,rows.filter(x=>x.originalTallyClass===k).length]));
 const content={
  schemaVersion:'historical-roster-863-50-independent-public-source-audit-v1',
  source:'exact_30_official_lrl_pdf_urls_from_protected_neon_readonly_census',
  sourceFetchObservationIs2026NotHistoricalPublicByProof:true,
  independentOriginalPdfBytesAndShaRetained:true,
  originalSourceCount:docs.length,sourceFetchSucceeded:docs.filter(x=>x.status==='verified_pdf').length,
  mismatchedCommitteeEvents:50,finalPassageEvents:0,
  classificationCounts:summary,
  outsideOriginalTallyStillUnverified:true,
  namesMustNotBeInferredFromAggregateCounts:true,
  exactMotionIdentityAndOriginalSourceVersionRequireSeparateProof:true,
  storedVoteRecordsModified:false,
  frozenForecastOrModelTouched:false,
  docs,rows,
 };
 return {...content,contentSha256:sha(JSON.stringify(content))};
}
