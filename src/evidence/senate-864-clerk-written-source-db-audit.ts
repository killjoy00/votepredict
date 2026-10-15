/**
 * #864: Bounded **read-only** comparison of original independently verified
 * 2022–25 Clerk / unlinked-PDF written-minute receipts to existing
 * source_documents and their current recorded event/choice COUNTS.
 *
 * This is NOT a motion-level or member-level exact-match result: an existing
 * row's tally/name count alone never certifies an individual recorded vote.
 * No raw DB rows, person names, IDs, source hashes or URLs leave the caller.
 */
export type OriginalWrittenMeeting={
 year:number;committeeName:string;hearingDate:string;
 originalClerkSha256:string|null;originalSenateHearingId:number|null;
 sourceClass:string;
 independentOrphanOfficialLrlPdfSource?:{
  originalPdfSha256:string;governmentOfficialSourceUrl:string;
 };
};
export type StoredDocument={
 id:string;source_url:string;content_sha256:string;
 meeting_date:string|null;committee_name:string|null;
};
export type StoredAggregate={
 source_document_id:string;recorded_events:number;
 recorded_member_choices:number;choices_with_membership:number;
};
export type YearMetric={
 year:2022|2023|2024|2025;
 expectedClerkBodies:number;expectedOrphanPdfs:number;
 exactlyOneOriginalStoredDocument:number;
 bodyFoundWithAlternateOfficialUrl:number;missingOriginalBodies:number;
 wrongShaOrMetadataOrDuplicate:number;
 storedCommitteeEventRowsOnExactSource:number;
 storedIndividualChoiceRowsOnExactSource:number;
 storedResolvedChoiceRowsOnExactSource:number;
};
const isSha=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const clerkUrl=(y:number,id:number)=>{
 if(![2022,2023,2024,2025].includes(y)||!Number.isSafeInteger(id)||
  id<15000||id>19999)throw Error('Original exact government Senate hearing ID invalid');
 return 'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id='+
  id+'&ls='+(y===2022?92:y===2025?94:93)+'&type=minutes';
};
const normalize=(value:string)=>{
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port)
  throw Error('Original source URL must be official HTTPS');
 if(url.hostname==='www.senate.mn'&&url.pathname==='/schedule/hearing_minutes.html'){
  const p=url.searchParams;
  if(p.size<2||p.size>5||p.get('hearing_id')===null||
   !/^\d{5}$/.test(p.get('hearing_id')??'')||!['92','93','94'].includes(p.get('ls')??''))
   throw Error('Original Senate source URL query not pinned');
  return 'senate:'+p.get('hearing_id')+':'+p.get('ls');
 }
 if(url.hostname==='www.lrl.mn.gov'&&
  url.pathname==='/archive/minutes/senate/2022/Finhousing/20220324/FinHousing_20220324_Minutes032422.pdf'&&
  !url.search)return 'lrl:2022-housing-20220324';
 throw Error('Unknown external source document route');
};
export function compareSenate864OriginalClerkDocumentsToStored(
 meetings:readonly OriginalWrittenMeeting[],
 stored:readonly StoredDocument[],
 aggregate:readonly StoredAggregate[],
){
 if(meetings.length!==141||stored.length>3000||aggregate.length>3000)
  throw Error('Strict original government 141/linked source coverage or SQL query bound');
 const keySeen=new Set<string>();
 const sourceExpected=new Map<string,{source:string;year:number;meeting:string;committee:string}>();
 const byYear=new Map<number,YearMetric>();
 for(const y of [2022,2023,2024,2025] as const)byYear.set(y,{
  year:y,expectedClerkBodies:0,expectedOrphanPdfs:0,
  exactlyOneOriginalStoredDocument:0,bodyFoundWithAlternateOfficialUrl:0,
  missingOriginalBodies:0,wrongShaOrMetadataOrDuplicate:0,
  storedCommitteeEventRowsOnExactSource:0,
  storedIndividualChoiceRowsOnExactSource:0,
  storedResolvedChoiceRowsOnExactSource:0
 });
 for(const x of meetings){
  const k=x.year+'|'+x.committeeName+'|'+x.hearingDate;
  if(keySeen.has(k)||![2022,2023,2024,2025].includes(x.year)||
   !x.hearingDate.startsWith(x.year+'-'))
   throw Error('Not an exact original indexed 2022-25 meeting');
  keySeen.add(k);
  const year=byYear.get(x.year)!;
  let docSha:string|null=null,sourceUrl:string|null=null;
  if(x.originalClerkSha256){
   if(!isSha(x.originalClerkSha256)||x.originalSenateHearingId===null)
    throw Error('Official original Clerk source SHA/ID absent');
   sourceUrl=clerkUrl(x.year,x.originalSenateHearingId);
   docSha=x.originalClerkSha256;
   year.expectedClerkBodies++;
  }else if(x.independentOrphanOfficialLrlPdfSource){
   sourceUrl=x.independentOrphanOfficialLrlPdfSource.governmentOfficialSourceUrl;
   docSha=x.independentOrphanOfficialLrlPdfSource.originalPdfSha256;
   if(!isSha(docSha))throw Error('Original independent LRL PDF SHA absent');
   year.expectedOrphanPdfs++;
  }
  if(docSha&&sourceUrl){
   const orig=normalize(sourceUrl);
   if(sourceExpected.has(orig))throw Error('Duplicate original government hearing URL');
   sourceExpected.set(orig,{source:docSha,year:x.year,meeting:x.hearingDate,committee:x.committeeName});
  }
 }
 if(sourceExpected.size!==112||keySeen.size!==141||
  [2022,2023,2024,2025].map(y=>byYear.get(y)!.expectedClerkBodies).join(',')!=='7,58,28,18')
  throw Error('Exact original 111 Clerk plus unlinked original PDF universe drift');
 const storedByOrigin=new Map<string,StoredDocument[]>();
 const ids=new Set<string>();
 for(const d of stored){
  if(!d.id||ids.has(d.id)||!isSha(d.content_sha256))
   throw Error('Bounded stored source document identifier/SHA missing or duplicate');
  ids.add(d.id);
  // Do not require every historical stored source in the audit to be a Clerk.
  let origin:string;
  try{origin=normalize(d.source_url)}
  catch{continue}
  storedByOrigin.set(origin,[...(storedByOrigin.get(origin)??[]),d]);
 }
 const sums=new Map<string,StoredAggregate>();
 for(const a of aggregate){
  if(sums.has(a.source_document_id)||![a.recorded_events,a.recorded_member_choices,
   a.choices_with_membership].every(n=>Number.isSafeInteger(n)&&n>=0&&n<50000)||
   a.choices_with_membership>a.recorded_member_choices)
   throw Error('Stored bounded source/event/choice aggregate invalid');
  sums.set(a.source_document_id,a);
 }
 for(const [origin,x] of sourceExpected){
  const y=byYear.get(x.year)!;
  const originals=storedByOrigin.get(origin)??[];
  const exact=originals.filter(a=>a.content_sha256===x.source&&
   a.meeting_date===x.meeting&&a.committee_name===x.committee);
  if(exact.length===1&&originals.length===1){
   y.exactlyOneOriginalStoredDocument++;
   const found=sums.get(exact[0]!.id);
   if(found){
    y.storedCommitteeEventRowsOnExactSource+=found.recorded_events;
    y.storedIndividualChoiceRowsOnExactSource+=found.recorded_member_choices;
    y.storedResolvedChoiceRowsOnExactSource+=found.choices_with_membership;
   }
  }else if(originals.length===0){
   // Original same content under another official URL still requires review:
   // body may have been stored but the exact Senate calendar ID not linked.
   const shaAliases=stored.filter(d=>d.content_sha256===x.source);
   if(shaAliases.length===1)y.bodyFoundWithAlternateOfficialUrl++;
   else if(shaAliases.length>1)y.wrongShaOrMetadataOrDuplicate++;
   else y.missingOriginalBodies++;
  }else y.wrongShaOrMetadataOrDuplicate++;
 }
 const yearly=Array.from(byYear.values());
 const sum=(k:keyof YearMetric)=>yearly.reduce((n,x)=>n+Number(x[k]),0);
 if(sum('expectedClerkBodies')!==111||sum('expectedOrphanPdfs')!==1||
  sum('exactlyOneOriginalStoredDocument')+sum('bodyFoundWithAlternateOfficialUrl')+
  sum('missingOriginalBodies')+sum('wrongShaOrMetadataOrDuplicate')!==112)
  throw Error('Read-only exact source body parity did not reconcile');
 return {
  schemaVersion:'senate-864-original-clerk-pdf-exact-stored-document-coverage-v1' as const,
  scopeYears:[2022,2023,2024,2025] as const,
  independentlyAuthenticatedAlternateOriginalSourceDocuments:112,
  alternateOriginalClerkHtmlBodies:111,otherOriginalLrlPdfs:1,
  oneExactStoredSourceMetadataMatch:sum('exactlyOneOriginalStoredDocument'),
  bodyOnlyStoredUnderOtherSourceUrl:sum('bodyFoundWithAlternateOfficialUrl'),
  originalSourceNotFound:sum('missingOriginalBodies'),
  duplicatedOrMismatchedSourceRecord:sum('wrongShaOrMetadataOrDuplicate'),
  storedCommitteeEventsOnExactMatchingSource:sum('storedCommitteeEventRowsOnExactSource'),
  storedMemberChoicesOnExactMatchingSource:sum('storedIndividualChoiceRowsOnExactSource'),
  storedResolvedMemberChoicesOnExactMatchingSource:sum('storedResolvedChoiceRowsOnExactSource'),
  2021ExcludedFromAllOriginalSourceMembershipAndVotes:true as const,
  positionalBackfillNotAuthorized:true as const,
  exactOriginalActionsToStoredMemberVotesNotCompared:true as const,
  deployedProductionNeonBranchBindingNotAsserted:true as const,
  noDatabaseWrites:true as const,
  noSourceNamesUrlsHashesOrPrivateIdsExported:true as const,
  byYear:yearly
 };
}
