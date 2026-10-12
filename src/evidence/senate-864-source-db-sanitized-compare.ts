/**
 * #864. All comparisons happen on trusted caller-supplied rows IN MEMORY.
 * Return only fixed, bounded numeric aggregates. Never log original URLs,
 * PDF fingerprints, individual names, vote choices or private row IDs.
 * Recognized source parser actions are candidates, not an official census.
 */
import {createHash} from 'node:crypto';
import {
 reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport,
 type OriginalSenateCommitteeYearAudit,
 type PersistedSenateCommitteeSourceExport,
} from './senate-committee-source-to-db-reconciliation.js';

export interface CommitteeStoredDoc {
 id:string; source_url:string; source_sha:string|null;
 meeting_date:string|null; committee_name:string|null;
}
export interface CommitteeStoredEvent {
 id:string; source_document_id:string|null; external_key:string|null;
 occurred_on:string; yea_count:number|null; nay_count:number|null;
}
export interface CommitteeStoredChoice {
 vote_event_id:string; normalized_member_name:string;
 choice:string; membership_id:string|null;
}
type YearCounts={
 year:number; originalPdfUrls:number; parsedOriginalPdfs:number;
 originalUnparsedPdfs:number; storedSourceRows:number;
 exactUrlOneToOne:number; originalParsedRawShaMatches:number;
 originalParsedRawShaMismatches:number; parsedMetadataMatches:number;
 parsedMetadataMismatches:number; unparsedUrlLocated:number;
 unparsedMeetingDateMatches:number; missingOriginalUrls:number;
 duplicateStoredOriginalUrls:number; storedRowsOutsideOriginalUrlSet:number;
 recognizedOriginalRollCalls:number; matchedRecognizedRollCalls:number;
 originalNamedChoiceTokens:number; matchedNamedChoiceTokens:number;
 storedCommitteeEvents:number; storedCommitteeMemberChoices:number;
 issues:Record<string,number>;
};
const COUNT_KEYS=[
 'official_original_pdf_not_retrieved','original_source_not_in_export',
 'original_pdf_hash_mismatch','duplicate_persisted_source',
 'source_meeting_or_committee_mismatch','missing_original_roll_call_event',
 'duplicate_persisted_roll_call','persisted_event_date_mismatch',
 'persisted_roll_call_tally_mismatch','unexpected_individual_choices_on_count_only',
 'original_named_choices_mismatch','unresolved_persisted_member_identity',
 'persisted_vote_event_not_matched_to_source',
] as const;
function yearOf(url:string):number|null{
 const m=url.match(/^https:\/\/(?:www\.)?lrl\.mn\.gov\/archive\/minutes\/senate\/(202[2-5])\//);
 return m?Number(m[1]):null;
}
function digest(choice:string,name:string):string{
 return createHash('sha256').update(choice+':'+name).digest('hex');
}
export function compareOriginalSenateCommitteeToStored(
 reports:readonly OriginalSenateCommitteeYearAudit[],
 stored:{
  documents:readonly CommitteeStoredDoc[];
  events:readonly CommitteeStoredEvent[];
  choices:readonly CommitteeStoredChoice[];
 },
){
 if(reports.length<1||reports.length>4 ||stored.documents.length>2200
   ||stored.events.length>600||stored.choices.length>4000)
  throw Error('Committee reconciliation source or stored row bound exceeded');
 const originalUrls=new Set<string>();
 const yearMap=new Map<number,YearCounts>();
 for(const r of reports){
  const y=r.auditedYear;
  if(![2022,2023,2024,2025].includes(y)||yearMap.has(y)
    ||r.documentProofs.length!==r.originalPdfsFetchedAndParsed
    ||r.unresolvedOriginalDocuments.length!==r.originalPdfsFailedOrUnparsed
    ||r.independentlyDiscoveredOriginalMinutesPdfLinks!==
      r.originalPdfsFetchedAndParsed+r.originalPdfsFailedOrUnparsed)
   throw Error('Source proof years or counts invalid');
  yearMap.set(y,{
   year:y,originalPdfUrls:r.independentlyDiscoveredOriginalMinutesPdfLinks,
   parsedOriginalPdfs:r.originalPdfsFetchedAndParsed,
   originalUnparsedPdfs:r.originalPdfsFailedOrUnparsed,storedSourceRows:0,
   exactUrlOneToOne:0,originalParsedRawShaMatches:0,
   originalParsedRawShaMismatches:0,parsedMetadataMatches:0,
   parsedMetadataMismatches:0,unparsedUrlLocated:0,
   unparsedMeetingDateMatches:0,missingOriginalUrls:0,
   duplicateStoredOriginalUrls:0,storedRowsOutsideOriginalUrlSet:0,
   recognizedOriginalRollCalls:0,matchedRecognizedRollCalls:0,
   originalNamedChoiceTokens:0,matchedNamedChoiceTokens:0,
   storedCommitteeEvents:0,storedCommitteeMemberChoices:0,issues:{},
  });
  for(const item of [...r.documentProofs.map(p=>p.document),...r.unresolvedOriginalDocuments]){
   if(typeof item.sourceUrl!=='string' ||yearOf(item.sourceUrl)!==y
     ||originalUrls.has(item.sourceUrl))
    throw Error('Original Senate source URL outside bounded year or duplicated');
   originalUrls.add(item.sourceUrl);
  }
 }
 const byUrl=new Map<string,CommitteeStoredDoc[]>();
 const byId=new Map<string,CommitteeStoredDoc>();
 for(const d of stored.documents){
  if(!d.id||typeof d.source_url!=='string'||byId.has(d.id))
   throw Error('Stored source document identity collision');
  byId.set(d.id,d);
  byUrl.set(d.source_url,[...(byUrl.get(d.source_url)??[]),d]);
  const y=yearOf(d.source_url);
  if(y!==null &&yearMap.has(y)){
   const a=yearMap.get(y)!;a.storedSourceRows++;
   if(!originalUrls.has(d.source_url))a.storedRowsOutsideOriginalUrlSet++;
  }
 }
 const memberByEvent=new Map<string,CommitteeStoredChoice[]>();
 for(const row of stored.choices){
  if(!row.vote_event_id||typeof row.normalized_member_name!=='string'
    ||typeof row.choice!=='string'||!['yea','nay'].includes(row.choice))
   throw Error('Malformed stored member choice in protected memory');
  memberByEvent.set(row.vote_event_id,[...(memberByEvent.get(row.vote_event_id)??[]),row]);
 }
 const eventsByDoc=new Map<string,PersistedSenateCommitteeSourceExport['voteEvents']>();
 const rawEventsByDoc=new Map<string,CommitteeStoredEvent[]>();
 const eventIds=new Set<string>();
 let orphanedStoredCommitteeEvents=0,orphanedStoredCommitteeMemberChoices=0;
 for(const row of stored.events){
  if(!row.id||eventIds.has(row.id))throw Error('Duplicate stored vote event identity');
  eventIds.add(row.id);
  const doc=row.source_document_id?byId.get(row.source_document_id):undefined;
  const y=doc?yearOf(doc.source_url):null;
  if(!doc||y===null||!yearMap.has(y)){
   orphanedStoredCommitteeEvents++;continue;
  }
  yearMap.get(y)!.storedCommitteeEvents++;
  rawEventsByDoc.set(doc.id,[...(rawEventsByDoc.get(doc.id)??[]),row]);
  eventsByDoc.set(doc.id,[...(eventsByDoc.get(doc.id)??[]),{
   eventId:row.id,externalKey:row.external_key??'',
   occurredOn:row.occurred_on,yeaCount:row.yea_count as number,
   nayCount:row.nay_count as number,
   memberVotes:(memberByEvent.get(row.id)??[]).map(m=>({
    normalizedName:m.normalized_member_name,choice:m.choice,membershipId:m.membership_id,
   })),
  }]);
 }
 for(const c of stored.choices){
  const event=stored.events.find(e=>e.id===c.vote_event_id);
  if(!event){orphanedStoredCommitteeMemberChoices++;continue}
  const d=event.source_document_id?byId.get(event.source_document_id):undefined;
  const y=d?yearOf(d.source_url):null;
  if(y!==null&&yearMap.has(y))yearMap.get(y)!.storedCommitteeMemberChoices++;
  else orphanedStoredCommitteeMemberChoices++;
 }
 const exported:PersistedSenateCommitteeSourceExport[]=stored.documents.map(d=>({
  sourceDocumentId:d.id,sourceUrl:d.source_url,
  sourceSha256:d.source_sha??'',metadataMeetingDate:d.meeting_date,
  metadataCommitteeName:d.committee_name,
  voteEvents:eventsByDoc.get(d.id)??[],contextActions:[],
 }));
 // Context actions are DELIBERATELY NOT fed into the existing comparator:
 // they need a distinct bounded query, not a fabricated missing=zero result.
 const votesOnly=reports.map(r=>({
  ...r,documentProofs:r.documentProofs.map(p=>({...p,contextOnlyActions:[]})),
 }));
 const comparison=reconcileSenateCommitteeOriginalActionsAgainstReadonlyExport(votesOnly,exported);
 const errors=Object.fromEntries(COUNT_KEYS.map(key=>[key,0])) as Record<string,number>;
 for(const row of comparison.originalPdfToDatabaseRows){
  const y=yearMap.get(row.year)!;
  y.recognizedOriginalRollCalls+=row.observedRollCalls;
  y.matchedRecognizedRollCalls+=row.categoryCounts.matchedRollCallEvents;
  for(const kind of row.issues){
   if(!COUNT_KEYS.includes(kind as typeof COUNT_KEYS[number]))continue;
   y.issues[kind]=(y.issues[kind]??0)+1;
   errors[kind]=(errors[kind]??0)+1;
  }
 }
 for(const report of reports){
  const y=yearMap.get(report.auditedYear)!;
  for(const proof of report.documentProofs){
   const d=proof.document,found=byUrl.get(d.sourceUrl)??[];
   y.originalNamedChoiceTokens+=proof.voteObservations.reduce((n,v)=>n+v.namedMemberChoicesInPdf,0);
   if(found.length===0)y.missingOriginalUrls++;
   if(found.length>1)y.duplicateStoredOriginalUrls++;
   if(found.length!==1)continue;
   y.exactUrlOneToOne++;
   const doc=found[0]!;
   if(doc.source_sha===d.originalRawPdfSha256)y.originalParsedRawShaMatches++;
   else y.originalParsedRawShaMismatches++;
   const metadataMatch=doc.meeting_date===d.meetingDate
       && doc.committee_name===d.committeeName;
   if(metadataMatch)y.parsedMetadataMatches++;
   else y.parsedMetadataMismatches++;
   if(!metadataMatch||doc.source_sha!==d.originalRawPdfSha256)continue;
   const byKey=new Map<string,CommitteeStoredEvent[]>();
   for(const event of rawEventsByDoc.get(doc.id)??[])
    byKey.set(event.external_key??'',[...(byKey.get(event.external_key??'')??[]),event]);
   for(const v of proof.voteObservations){
    if(!v.individualVotesAvailable)continue;
    const list=byKey.get(v.externalKey)??[];
    if(list.length!==1)continue;
    const e=list[0]!,choices=memberByEvent.get(e.id)??[];
    if(e.occurred_on!==d.meetingDate||e.yea_count!==v.yeaCount||e.nay_count!==v.nayCount
      ||choices.length!==v.namedMemberChoicesInPdf
      ||choices.some(c=>!c.membership_id))continue;
    const hashes=choices.map(c=>digest(c.choice,c.normalized_member_name)).sort();
    if(JSON.stringify(hashes)===JSON.stringify(v.choiceIdentitySha256))
     y.matchedNamedChoiceTokens+=v.namedMemberChoicesInPdf;
   }
  }
  for(const unresolved of report.unresolvedOriginalDocuments){
   const found=byUrl.get(unresolved.sourceUrl)??[];
   if(found.length===0)y.missingOriginalUrls++;
   if(found.length>1)y.duplicateStoredOriginalUrls++;
   if(found.length!==1)continue;
   y.exactUrlOneToOne++;y.unparsedUrlLocated++;
   if(found[0]!.meeting_date===unresolved.meetingDate)y.unparsedMeetingDateMatches++;
  }
 }
 const yearResults=[...yearMap.values()].sort((a,b)=>a.year-b.year);
 return {
  schemaVersion:'mn-864-senate-committee-original-vs-neon-sanitized-v1',
  issue:864,scopeYears:yearResults.map(r=>r.year),
  sourceOriginalPdfUrlReferences:yearResults.reduce((n,r)=>n+r.originalPdfUrls,0),
  originalPdfsWithIndependentRawPdfSha:yearResults.reduce((n,r)=>n+r.parsedOriginalPdfs,0),
  originalPdfsWithoutIndependentRawPdfSha:yearResults.reduce((n,r)=>n+r.originalUnparsedPdfs,0),
  storedCommitteeSourceRows:stored.documents.length,
  sourceExactUrlOneToOne:yearResults.reduce((n,r)=>n+r.exactUrlOneToOne,0),
  sourceParsedRawPdfShaMatches:yearResults.reduce((n,r)=>n+r.originalParsedRawShaMatches,0),
  sourceParsedRawPdfShaMismatches:yearResults.reduce((n,r)=>n+r.originalParsedRawShaMismatches,0),
  originalUrlsAbsentFromStoredRecords:yearResults.reduce((n,r)=>n+r.missingOriginalUrls,0),
  duplicateStoredUrlsForOriginals:yearResults.reduce((n,r)=>n+r.duplicateStoredOriginalUrls,0),
  storedRowsOutsideOriginalUrlSet:stored.documents.filter(d=>!originalUrls.has(d.source_url)).length,
  sourceCandidateRollCallEvents:comparison.summary.sourceCandidateRollCalls,
  matchedCandidateRollCallEvents:comparison.summary.exactSourceToDatabaseMatchedRollCalls,
  sourceCandidateNamedChoiceTokens:yearResults.reduce((n,r)=>n+r.originalNamedChoiceTokens,0),
  matchingCandidateNamedChoiceTokensWithNonNullMembership:
   yearResults.reduce((n,r)=>n+r.matchedNamedChoiceTokens,0),
  persistedCommitteeVoteEvents:stored.events.length,
  persistedCommitteeMemberVoteRows:stored.choices.length,
  orphanedStoredCommitteeEvents,orphanedStoredCommitteeMemberChoices,
  mismatchDocumentCountsByCategory:errors,byYear:yearResults,
  sourceContextActionsReconciled:false,
  committeeMemberDateServiceIdentityReconciled:false,
  observedCandidateVoteDenominatorIsNotAllOfficialActions:true,
  year2021PrintAnd2022PrintElectronicCompletenessUnknown:true,
  neverEligibleForPredictionFromThisAudit:true,
  fullHistoricalReconciliationCertified:false,
  noRawDatabaseRowsOrSourceNamesEmitted:true,
 };
}
