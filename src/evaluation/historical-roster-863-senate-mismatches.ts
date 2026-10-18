/**
 * #863: classify (without editing) the 50 Senate internal-tally inconsistencies.
 * Missing named roll-call observations and missing official votes are NOT synonyms.
 * Never infer an official source tally from an internal DB tally.
 */
import {createHash} from 'node:crypto';

export const SENATE863_MISMATCH_MARKER='ROSTER_863_SENATE_50_ORIGINAL_AUDIT_V1_20261018';
export const SENATE863_MISMATCH_SQL=[
 'SELECT q.* FROM (',
 'SELECT s.slug AS session,c.slug AS chamber,ve.id::text AS event_id,',
 've.occurred_on::text AS occurred_on,coalesce(b.identifier,\'NO_BILL\') AS bill,',
 've.vote_kind,ve.is_passage,ve.yea_count AS declared_yeas,',
 've.nay_count AS declared_nays,ve.other_count AS declared_other,',
 'sd.source_kind,sd.source_url,sd.content_sha256 AS stored_source_sha256,',
 'sd.fetched_at::text AS stored_source_fetched_at,',
 '(ve.metadata->>\'committeeVote\'=\'true\') AS committee_vote,',
 't.named_yeas,t.named_nays,t.named_other,t.total_named,t.unresolved',
 'FROM vote_events ve JOIN legislative_sessions s ON s.id=ve.session_id',
 'JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug=\'us-mn\'',
 'JOIN chambers c ON c.id=ve.chamber_id',
 'LEFT JOIN bills b ON b.id=ve.bill_id',
 'JOIN source_documents sd ON sd.id=ve.source_document_id',
 'LEFT JOIN LATERAL (SELECT',
 'count(*) FILTER (WHERE mv.choice=\'yea\')::int AS named_yeas,',
 'count(*) FILTER (WHERE mv.choice=\'nay\')::int AS named_nays,',
 'count(*) FILTER (WHERE mv.choice=\'other\')::int AS named_other,',
 'count(mv.id)::int AS total_named,',
 'count(*) FILTER (WHERE mv.id IS NOT NULL AND mv.membership_id IS NULL)::int AS unresolved',
 'FROM member_votes mv WHERE mv.vote_event_id=ve.id) t ON true',
 'WHERE c.slug=\'senate\' AND s.slug IN (\'2021-2022\',\'2023-2024\',\'2025-2026\')',
 ') q',
 'WHERE q.declared_yeas<>q.named_yeas OR q.declared_nays<>q.named_nays',
 'ORDER BY q.session,q.occurred_on,q.event_id LIMIT 101'
].join(' ');

export function checkSenate863SQL():true {
 if(!SENATE863_MISMATCH_SQL.startsWith('SELECT ')||
    !SENATE863_MISMATCH_SQL.endsWith(' LIMIT 101')||
    /;|--|\/\*|\*\/|\b(?:UPDATE|DELETE|INSERT|CREATE|ALTER|DROP|TRUNCATE|COPY|EXECUTE|GRANT|REVOKE|pg_sleep|dblink)\b/i.test(SENATE863_MISMATCH_SQL)) {
   throw Error('Unbounded or mutable SQL for #863 mismatches');
 }
 return true;
}
export type Mismatch863SourceRow={
 session:string;chamber:string;event_id:string;occurred_on:string;bill:string;
 vote_kind:string;is_passage:boolean;declared_yeas:number;declared_nays:number;
 declared_other:number;source_kind:string;source_url:string;
 stored_source_sha256:string;stored_source_fetched_at:string;
 committee_vote:boolean;named_yeas:number;named_nays:number;named_other:number;
 total_named:number;unresolved:number;
};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const OFFICIAL=new Set([
 'senate.mn','www.senate.mn','lrl.mn.gov','www.lrl.mn.gov',
 'leg.mn.gov','www.leg.mn.gov','revisor.mn.gov','www.revisor.mn.gov',
 'house.mn.gov','www.house.mn.gov',
]);
export function senate863OfficialSource(url:string){
 let parsed:URL;
 try{parsed=new URL(url)}catch{return {official:false,publicUrl:null,host:'invalid'} as const}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||!OFFICIAL.has(parsed.hostname))
   return {official:false,publicUrl:null,host:'outside_allowlist'} as const;
 return {official:true,publicUrl:parsed.href,host:parsed.hostname};
}
export function senate863MismatchType(r:Mismatch863SourceRow){
 const y=r.declared_yeas-r.named_yeas,n=r.declared_nays-r.named_nays;
 if(r.total_named===0) return 'declared_tally_without_named_roll';
 if(y>0&&n>=0 || n>0&&y>=0) return 'declared_exceeds_named_choices';
 if(y<0&&n<=0 || n<0&&y<=0) return 'named_choices_exceed_declared';
 return 'cross_side_tally_inconsistency';
}
/** Pure, bounded public metadata result. NEVER marks unproven votes lost. */
export function summarizeSenate863Mismatches(rows:readonly Mismatch863SourceRow[]){
 checkSenate863SQL();
 if(!Array.isArray(rows)||rows.length>=101)throw Error('Mismatch SQL truncated at cap');
 const fingerprints=new Set<string>();
 const events=rows.map(r=>{
   if(!/^(2021-2022|2023-2024|2025-2026)$/.test(r.session)||
     r.chamber!=='senate'||
     !/^\d{4}-\d{2}-\d{2}$/.test(r.occurred_on)||
     typeof r.event_id!=='string'||!r.event_id.trim()||
     !/^[a-f0-9]{64}$/.test(r.stored_source_sha256)||
     !['passage','amendment','motion','procedural','other'].includes(r.vote_kind)||
     [r.declared_yeas,r.declared_nays,r.declared_other,r.named_yeas,
      r.named_nays,r.named_other,r.total_named,r.unresolved]
       .some(x=>!Number.isSafeInteger(x)||x<0)||
     (r.declared_yeas===r.named_yeas&&r.declared_nays===r.named_nays)) {
      throw Error('Unexpected or non-mismatch Senate event');
   }
   const eventRef=hash(r.event_id).slice(0,20);
   if(fingerprints.has(eventRef))throw Error('Duplicate event in mismatch scope');
   fingerprints.add(eventRef);
   const source=senate863OfficialSource(r.source_url);
   return {
     publicEventReference:eventRef,session:r.session,occurredOn:r.occurred_on,
     bill:r.bill,voteKind:r.vote_kind,isPassage:r.is_passage,
     committeeVote:r.committee_vote,storedSourceKind:r.source_kind,
     officialSourceUrl:source.publicUrl,
     sourceHost:source.host,officialSourceHostVerified:source.official,
     originalSourceBytesIndependentlyMatched:false,
     declared:{yea:r.declared_yeas,nay:r.declared_nays,other:r.declared_other},
     memberVotes:{yea:r.named_yeas,nay:r.named_nays,other:r.named_other},
     delta:{yea:r.declared_yeas-r.named_yeas,
       nay:r.declared_nays-r.named_nays},
     classification:senate863MismatchType(r),
     unresolvedMembershipCount:r.unresolved,
     externalOfficialTallyIndependentlyVerified:false,
   };
 });
 const count=(test:(e:typeof events[number])=>boolean)=>events.filter(test).length;
 const sessions=['2021-2022','2023-2024','2025-2026'];
 const classifications=[...new Set(events.map(x=>x.classification))].sort();
 return {
  marker:SENATE863_MISMATCH_MARKER,
  scope:'Minnesota Senate 2021-2026 internal stored-record tally parity',
  storedEventMismatches:events.length,
  matchesPreviousAggregateOf50:events.length===50,
  eventCountBySession:Object.fromEntries(sessions.map(s=>[s,count(x=>x.session===s)])),
  eventCountByVoteKind:Object.fromEntries(
    ['passage','amendment','motion','procedural','other'].map(k=>
      [k,count(x=>x.voteKind===k)])),
  mismatchClassificationCounts:Object.fromEntries(classifications.map(k=>
    [k,count(x=>x.classification===k)])),
  committeeVoteEvents:count(x=>x.committeeVote),
  officialHostProvenance:count(x=>x.officialSourceHostVerified),
  unrecognizedOfficialSourceHost:count(x=>!x.officialSourceHostVerified),
  originalOfficialBytesAuthenticated:0,
  externalOfficialTalliesAuthenticated:0,
  changesToVoteRecords:false,
  missingVotesProvenByThisAudit:false,
  auditStatus:events.length===50?'internal_mismatches_identified_source_review_pending':
    'count_drift_requires_review',
  events,
 };
}
