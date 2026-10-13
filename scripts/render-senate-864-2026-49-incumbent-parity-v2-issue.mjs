/**
 * KEYLESS public issue rendering only. Operates exclusively on a sanitized
 * protected snapshot and the reviewed, PUBLIC 49-person source manifest.
 * Neither private database rows, credentials, hashes, URLs nor source bodies
 * are read by or provided to this renderer. Independent of protected script.
 */
import publicManifest from '../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json' with {type:'json'};

const EXPECTED=[1,2,3,4,6,7,8,9,10,11,12,14,16,17,18,19,23,25,27,28,29,30,31,32,33,34,35,36,38,39,40,41,42,45,46,47,48,55,56,57,58,59,60,61,62,63,64,66,67];
const STATUS={
 matched_exact_url_with_named_senator_evidence:'Exact URL + linked evidence',
 matched_url_alias_with_named_senator_evidence:'URL spelling + linked evidence',
 source_url_present_but_no_named_senator_evidence:'URL only, no senator evidence',
 source_url_not_observed_in_bounded_lookup:'Selected URL not observed',
 senator_membership_identity_unresolved:'Membership HOLD'
};
const HOLD=new Set(['none',
 'no_active_membership_in_stored_2025_26_session',
 'active_district_membership_name_does_not_match_public_incumbent',
 'multiple_active_current_senate_membership_identity_candidates']);
const NUM=[
 'currentMembershipCampaignIssueRows','currentMembershipCampaignDistinctDocuments',
 'currentMembershipCampaignIssueRowsRecorded2026','currentMembershipCampaignIssueRowsRecordedPre2026',
 'currentMembershipCampaignIssueRowsUndated','currentMembershipAllSourceIssueRowsRecorded2026'
];
const BOOL=[
 'selectedSourceEvidenceLinked','selectedSourceIssuePositionLinked',
 'selectedSourceCampaignSiteIssuePositionLinked','selectedSourceIssuePositionRecorded2026'
];
const FIELDS=['district','selectedSourceStatus','membershipHoldReason',...NUM,...BOOL].sort();
const PRIVATE=/(?:https?:\/\/|neon\.tech|postgres:|sourceDocumentId|membershipId|sourceEvidenceId|sourceContentSha256|rawWholeHtmlSha256|NEON_API_KEY|password|excerptBody)/i;
const FAILURE_STAGE=new Set([
 'owner_comment_and_ci_approved',
 'verified_existing_default_votepredict_database',
 'tables_and_readonly_transaction_verified',
 'bounded_2026_memberships_in_memory',
 'bounded_53_public_source_url_rows_in_memory',
 'bounded_campaign_source_aggregates_in_memory',
 'readonly_transaction_explicitly_rolled_back',
 'not_reported'
]);
function compactV2Snapshot(encoded){
 if(typeof encoded!=='string'||! /^[a-zA-Z0-9+/=]{200,64000}$/.test(encoded))
  throw Error('Missing or oversized base64 sanitized per-district source result');
 let r;
 try{r=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'))}
 catch{throw Error('Unparseable bounded source results')}
 if(r.schema!=='mn-864-2026-49-incumbent-protected-url-and-evidence-parity-v2'
  ||r.issue!==864||r.researchCandidateCount!==49||r.olderSelectedOriginalSiteExcerpts!==716
  ||r.currentTransactionReadOnly!==true||r.transactionRollbackCompleted!==true
  ||r.productionMutations!==0||r.deployedProductionDbBindingProven!==false
  ||r.calendarYearIsStoredPublishedAtMetadataNotIndependentOriginalPublication!==true
  ||r.2026ElectionEligibleStatementCompletenessProven!==false
  ||r.memberRowsAreAggregateCountsOnly!==true
  ||r.outputContainsPrivateSourceRows!==false||r.outputContainsPrivateUrls!==false
  ||r.outputContainsPrivatePeopleNames!==false||r.outputContainsPrivateHashes!==false
  ||r.sourceUrlStatusByDistrict!==undefined
  ||!Array.isArray(r.perPublicDistrict)||r.perPublicDistrict.length!==49
  ||r.duckworth?.perSource?.length!==4)
  throw Error('Unsafe or inconsistent aggregate proof');
 const raw=JSON.stringify(r);
 if(raw.length>46000||PRIVATE.test(raw))throw Error('Private source metadata in keyless issue receipt');
 if(publicManifest.issue!==864||publicManifest.rows.length!==49)
  throw Error('Public 49-person source manifest drifted');
 const counts={};
 for(let i=0;i<49;i++){
  const p=r.perPublicDistrict[i],candidate=publicManifest.rows[i];
  if(p.district!==EXPECTED[i]||candidate.district!==EXPECTED[i]
   ||! /^[a-zA-Z0-9 .'\-]{5,90}$/.test(candidate.senator)
   ||JSON.stringify(Object.keys(p).sort())!==JSON.stringify(FIELDS)
   ||!Object.hasOwn(STATUS,p.selectedSourceStatus)
   ||!HOLD.has(p.membershipHoldReason))
   throw Error('Non-public candidate, unsafe district source classification');
  for(const k of BOOL)if(typeof p[k]!=='boolean')throw Error('Invalid source-scope flag');
  const held=p.selectedSourceStatus==='senator_membership_identity_unresolved';
  if((p.membershipHoldReason!=='none')!==held)throw Error('Contradictory member-identity hold');
  for(const k of NUM){
   if(held){if(p[k]!==null)throw Error('Held member incorrectly represented as zero');}
   else if(!Number.isInteger(p[k])||p[k]<0||p[k]>100000)
    throw Error('Unsafe source issue-position count');
  }
  if(p.selectedSourceIssuePositionLinked&&!p.selectedSourceEvidenceLinked
   ||p.selectedSourceIssuePositionRecorded2026&&!p.selectedSourceIssuePositionLinked)
   throw Error('Unattributed source claimed as member-specific issue position');
  counts[p.selectedSourceStatus]=(counts[p.selectedSourceStatus]||0)+1;
 }
 if(JSON.stringify(counts)!==JSON.stringify(r.groupedStatusCounts)
  ||Object.values(counts).reduce((a,b)=>a+b,0)!==49)
  throw Error('Mismatch between individual source results and public category totals');
 const d=r.duckworth;
 if(d.comparedDatedPublicSources!==4
  ||!Number.isInteger(d.exactLiveWholePublisherHtmlShaMatches)
  ||d.exactLiveWholePublisherHtmlShaMatches<0||d.exactLiveWholePublisherHtmlShaMatches>4)
  throw Error('Invalid four-source Duckworth original parity summary');
 for(let i=0;i<4;i++){
  const s=d.perSource[i];
  if(s.sourceOrdinal!==i+1||typeof s.urlInStoredDocuments!=='boolean'
   ||typeof s.currentSenatorEvidenceLinked!=='boolean'
   ||typeof s.exactShortCueInStoredEvidence!=='boolean'
   ||typeof s.originalRawPublisherBodyShaProvenSame!=='boolean'
   ||s.originalFirstPublicationTimeProven!==false)
   throw Error('Unverified Duckworth source-level result');
 }
 return r;
}
export function renderSanitizedIncumbentIssueComment(input){
 const {verifyResult,readOnlyResult,safeCandidateReportB64,safeFailureStage,runUrl,mainSha}=input;
 if(typeof runUrl!=='string'||! /^https:\/\/github\.com\/killjoy00\/votepredict\/actions\/runs\/[0-9]+$/.test(runUrl)
  ||typeof mainSha!=='string'||! /^[a-f0-9]{40}$/.test(mainSha))
  throw Error('Unreviewed protected run identity');
 const intro=[
  '## #864 — 2026 MN Senate incumbent per-person source-to-evidence V2',
  '',
  '**Reviewed main commit:** '+mainSha,
  '**Read-only report run:** '+runUrl,
  'Scope: existing VotePredict Neon default branch only, not independently tied to the deployed production application.',
  ''
 ];
 if(verifyResult!=='success')return [...intro,
  '**HOLD: public CI or disposable local SQL plan failed before accessing protected Neon.**',
  'No per-person database source conclusions may be drawn.'
 ].join('\n');
 if(readOnlyResult==='failure'){
  const s=safeFailureStage||'not_reported';
  if(!FAILURE_STAGE.has(s))throw Error('Unexpected internal protected read-only stage');
  return [...intro,'**PROTECTED HOLD** at fixed safe stage: '+s,
   'No 49-person result may be inferred from a failed protected transaction.'
  ].join('\n');
 }
 if(readOnlyResult!=='success')throw Error('Unexpected protected source task status');
 const r=compactV2Snapshot(safeCandidateReportB64);
 const groups=Object.entries(STATUS).map(([key,label])=>
  '- '+label+': **'+(r.groupedStatusCounts[key]||0)+'**');
 const h=[
  '| SD | Sitting senator (public 2026 roster) | Selected URL result | Issue-position row at selected URL? | Campaign issue rows in current membership | Distinct campaign docs | Campaign issue rows with 2026 stored date | All-source issue rows with 2026 stored date | Identity note |',
  '|---:|---|---|:---:|---:|---:|---:|---:|---|'
 ];
 for(let i=0;i<49;i++){
  const p=r.perPublicDistrict[i],cand=publicManifest.rows[i];
  const toText=k=>p[k]===null?'HOLD':String(p[k]);
  h.push('| '+p.district+' | '+cand.senator+' | '+STATUS[p.selectedSourceStatus]+' | '+
    (p.selectedSourceIssuePositionLinked?'Yes':'No')+' | '+
    toText('currentMembershipCampaignIssueRows')+' | '+
    toText('currentMembershipCampaignDistinctDocuments')+' | '+
    toText('currentMembershipCampaignIssueRowsRecorded2026')+' | '+
    toText('currentMembershipAllSourceIssueRowsRecorded2026')+' | '+
    (p.membershipHoldReason==='none'?'—':p.membershipHoldReason.replaceAll('_',' '))+' |');
 }
 const d=r.duckworth;
 const duckworthLines=d.perSource.map((x,i)=>
  '- Original 2026 public source '+(i+1)+': URL '+(x.urlInStoredDocuments?'observed':'not observed')+
  ', current-senator evidence '+(x.currentSenatorEvidenceLinked?'linked':'not linked')+
  ', complete original HTML SHA '+(x.originalRawPublisherBodyShaProvenSame?'matched':'not matched')
 );
 const text=[
  ...intro,
  '**Result: SUCCESS — bounded current-membership and source comparisons in READ ONLY REPEATABLE READ, explicit ROLLBACK.**',
  '',
  '### Selected-source URL results for 49 incumbent nominees',
  ...groups,'',
  '### Senator-by-senator protected source and issue evidence',
  ...h,'',
  '**Interpretation:** Each candidate has one selected researched URL. A missing selected URL is NOT proof that the senator has zero issue evidence; other page paths, archive URLs and source pipelines are outside this bounded URL match.',
  'Stored counts above cover only that person’s currently matched 2025–2026 Senate membership. Separate earlier session memberships are not enumerated. “2026” means stored publication-date metadata, NOT proven first-publication or forecasting eligibility. “Issue position at URL” means the stored contextType says issue_position and references the senator, NOT independent quote or stance review.',
  '',
  '### Zach Duckworth: four distinct current publisher pages',
  '- Original public 2026 source URLs observed in stored source documents: '+d.sourceUrlsObserved+'/4',
  '- Linked to correctly matched current Senate membership: '+d.senatorEvidenceLinked+'/4',
  '- Exact selected short statement cue in the existing excerpt: '+d.literalShortCueObserved+'/4',
  '- October 13 live whole original publisher HTML SHA-256 equals correctly linked stored source SHA: '+d.exactLiveWholePublisherHtmlShaMatches+'/4',
  ...duckworthLines,
  '',
  'The Jan 25 and Jan 26 statements overlap one immigration-enforcement policy topic. Full HTML byte differences may reflect later page changes or extraction transformations, not false statements or absence of evidence.',
  '',
  '**Limitations:** No private database names, source row IDs, URLs, raw document bytes, statements, passwords, hashes or donor data exported. No ingestion, repairs, model, forecast, serving or production database changes. Deployed database connection identity unproved. Issue #864 remains OPEN.'
 ].join('\n');
 if(text.length>28500)throw Error('Per-public-district issue report unexpectedly large');
 return text;
}
