/**
 * #863 one original-only exact named 2024 committee roll vs already linked
 * protected Neon member_votes. No reclassification, vote fixes or model reads.
 */
import {createHash} from 'node:crypto';
import {normalizeMemberName} from '../sources/minnesota/house-votes';
import type {SenateCommitteeVoteObservation} from '../evidence/minnesota-senate-committee-minutes';

export const SF3534_863_MARKER='ROSTER_863_SF3534_ORIGINAL_NAMED_VS_STORED_V1_20261018';
export const SF3534_863_SOURCE_URL=
 'https://www.lrl.mn.gov/archive/minutes/senate/2024/jud/20240221/Jud_20240221_minutes.pdf';
export const SF3534_863_SOURCE_PDF_SHA256=
 'a109e8cbdd2edacc705c4494c35bc096052e9ceb69e16fbbc296b36506dbfa5d';
export const SF3534_863_EVENT_ID_PUBLIC_SHA='be31812a75bc9afa2416';

export const SF3534_863_SQL=[
 'SELECT ve.id::text AS event_id,ve.occurred_on::text AS occurred_on,',
 'b.identifier AS bill,c.slug AS chamber,s.slug AS session,ve.vote_kind,',
 've.yea_count,ve.nay_count,sd.source_url,sd.content_sha256 AS stored_source_sha256,',
 'mv.id::text AS member_vote_id,mv.choice,mv.source_member_name,',
 'l.name AS legislator_name,m.starts_on::text AS membership_starts_on,',
 'm.ends_on::text AS membership_ends_on',
 'FROM vote_events ve JOIN legislative_sessions s ON s.id=ve.session_id',
 'JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug=\'us-mn\'',
 'JOIN chambers c ON c.id=ve.chamber_id JOIN bills b ON b.id=ve.bill_id',
 'JOIN source_documents sd ON sd.id=ve.source_document_id',
 'LEFT JOIN member_votes mv ON mv.vote_event_id=ve.id',
 'LEFT JOIN memberships m ON m.id=mv.membership_id',
 'LEFT JOIN legislators l ON l.id=m.legislator_id',
 'WHERE s.slug=\'2023-2024\' AND c.slug=\'senate\'',
 'AND ve.occurred_on=\'2024-02-21\'::date AND b.identifier=\'SF3534\'',
 'AND ve.vote_kind=\'amendment\' AND ve.yea_count=6 AND ve.nay_count=4',
 'AND sd.source_url=\'https://www.lrl.mn.gov/archive/minutes/senate/2024/jud/20240221/Jud_20240221_minutes.pdf\'',
 'ORDER BY ve.id,mv.id LIMIT 101',
].join(' ');
export function validateSF3534_863Static():true{
 if(!SF3534_863_SQL.startsWith('SELECT ')||
  !SF3534_863_SQL.endsWith(' LIMIT 101')||
  /;|--|\/\*|\*\/|\b(?:UPDATE|DELETE|INSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE|COPY|EXECUTE|GRANT|REVOKE|pg_sleep|dblink)\b/i.test(SF3534_863_SQL)||
  !/^[a-f0-9]{64}$/.test(SF3534_863_SOURCE_PDF_SHA256)||
  !/^[a-f0-9]{20}$/.test(SF3534_863_EVENT_ID_PUBLIC_SHA))
  throw Error('Changed protected original SF3534 source/SQL scope');
 return true;
}
export interface StoredSF3534Named {
 event_id:string;occurred_on:string;bill:string;chamber:string;session:string;
 vote_kind:string;yea_count:number;nay_count:number;source_url:string;
 stored_source_sha256:string;member_vote_id:string|null;
 choice:'yea'|'nay'|'other'|null;source_member_name:string|null;
 legislator_name:string|null;membership_starts_on:string|null;
 membership_ends_on:string|null;
}
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
export function classifySF3534_863NamedOriginal(
 original:readonly SenateCommitteeVoteObservation[],
 stored:readonly StoredSF3534Named[],
){
 validateSF3534_863Static();
 if(stored.length===0||stored.length>100)throw Error('Bounded SF3534 source rows unavailable');
 const selected=stored.filter(r=>sha(r.event_id).slice(0,20)===SF3534_863_EVENT_ID_PUBLIC_SHA);
 if(selected.length!==9||
  new Set(selected.map(r=>r.member_vote_id)).size!==9||
  selected.some(r=>r.bill!=='SF3534'||r.chamber!=='senate'||
   r.session!=='2023-2024'||r.vote_kind!=='amendment'||
   r.occurred_on!=='2024-02-21'||r.yea_count!==6||r.nay_count!==4||
   r.source_url!==SF3534_863_SOURCE_URL||
   !r.member_vote_id||!['yea','nay'].includes(r.choice??'')||
   (r.membership_starts_on!==null&&r.membership_starts_on>'2024-02-21')||
   (r.membership_ends_on!==null&&r.membership_ends_on<'2024-02-21')))
  throw Error('Protected SF3534 event identities or 9 stored choices changed');
 const entries=original.filter(o=>
  o.billIdentifier==='SF3534' && o.yeaCount===6 && o.nayCount===4 &&
  o.individualVotesAvailable===true && o.memberVotes.length===10);
 if(entries.length!==1)throw Error('Original PDF has no unique complete source roll');
 const official=entries[0]!.memberVotes;
 if(official.filter(x=>x.choice==='yea').length!==6||
    official.filter(x=>x.choice==='nay').length!==4||
    selected.filter(x=>x.choice==='yea').length!==5||
    selected.filter(x=>x.choice==='nay').length!==4)
   throw Error('Original or stored vote counts differ from protected finding');
 const officialKeys=official.map(o=>o.choice+'|'+normalizeMemberName(o.sourceName));
 if(new Set(officialKeys).size!==10)throw Error('Original roll contains nonunique source-side identities');
 const storedChoiceKeys=selected.map(r=>({
  choice:r.choice as 'yea'|'nay',
  keys:[r.source_member_name,r.legislator_name].filter((x):x is string=>
   typeof x==='string'&&!!x.trim()).map(normalizeMemberName),
 }));
 const claimedRows=new Set<number>();
 const exactMatches:number[]=[];
 const missingPublicSourceNames:string[]=[];
 const unmatchedOfficialVoteSides:string[]=[];
 for(const o of official){
  const name=normalizeMemberName(o.sourceName);
  const candidates=storedChoiceKeys
    .map((r,i)=>({r,i}))
    .filter(x=>x.r.choice===o.choice&&!claimedRows.has(x.i)&&
      x.r.keys.includes(name));
  if(candidates.length===1){
   const i=candidates[0]!.i;claimedRows.add(i);exactMatches.push(i);
  }else {
   missingPublicSourceNames.push(o.sourceName);
   unmatchedOfficialVoteSides.push(o.choice);
  }
 }
 const unmatchedStoredCount=storedChoiceKeys.length-claimedRows.size;
 const allMatching=missingPublicSourceNames.length===1 &&
   unmatchedStoredCount===0 && unmatchedOfficialVoteSides[0]==='yea';
 const report={
  marker:SF3534_863_MARKER,
  officialSourceUrl:SF3534_863_SOURCE_URL,
  originalPdfSha256:SF3534_863_SOURCE_PDF_SHA256,
  originalSourcePublicNamesCount:10,
  originalSourceYeas:6,originalSourceNays:4,
  storedIndividualCount:9,storedYeas:5,storedNays:4,
  exactNormalizedNameAndSideMatches:exactMatches.length,
  unmatchedPublicOfficialNameCount:missingPublicSourceNames.length,
  unmatchedStoredCount,unmatchedOfficialVoteSides,
  // Source names are public (official Senate committee PDF), never database names.
  unrecordedOriginalPublicSenatorName:allMatching?missingPublicSourceNames[0]:null,
  classification:allMatching?'exact_one_official_yea_absent_from_stored_named_votes':
   'name_or_event_identity_match_requires_manual_review',
  sourcePdfComparedToStoredDatabaseHash:
   selected[0]!.stored_source_sha256===SF3534_863_SOURCE_PDF_SHA256,
  sourceOriginalFetchIsNot2024PublicationProof:true,
  cannotInferWhyTheOriginalPersonWasNotStored:true,
  underlyingMemberVoteRecordsUpdated:false,
  forecastOrFrozenModelUpdated:false,
 };
 return report;
}
