/**
 * Historical campaign WEBSITE TEXT is an observation. No stance decisions,
 * no inferred candidate sincerity or recorded votes, no production model updates.
 */
import {canonicalKey,assertManifest} from './senate-864-95-historical-source-neon-parity.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSIONS=['2021-2022','2023-2024','2025-2026'];
const SHA=/^[a-f0-9]{64}$/i;
export const WEBSITE_SIGNAL_VERSION='senate-864-literal-website-observed-asof-v1';
function sessionFor(year){
 return year>=2021&&year<=2022?'2021-2022':
  year>=2023&&year<=2024?'2023-2024':
  year>=2025&&year<=2026?'2025-2026':null;
}
/** Roster identity (not current office) must join all 95 known serving people. */
export function membershipIndex(manifest,roster){
 assertManifest(manifest);
 if(!Array.isArray(roster)||roster.length<95||roster.length>1000)throw Error('Historic Senate roster empty or truncated');
 const byName=new Map();
 for(const r of roster){
  if(!UUID.test(r.legislatorId||'')||!UUID.test(r.membershipId||'')
   ||!SESSIONS.includes(r.sessionSlug))throw Error('Unexpected historical membership');
  const key=canonicalKey(r.name);
  if(!key)continue;
  const found=byName.get(key)||[];
  found.push(r);byName.set(key,found);
 }
 const map=new Map();
 for(let i=0;i<95;i++){
  const people=byName.get(canonicalKey(manifest.people[i].officialName))||[];
  if(!people.length||new Set(people.map(r=>r.legislatorId)).size!==1
   ||new Set(people.map(r=>r.membershipId)).size!==people.length)
   throw Error('Unresolved or ambiguous historical senator identity');
  people.sort((a,b)=>a.sessionSlug.localeCompare(b.sessionSlug)||a.membershipId.localeCompare(b.membershipId));
  map.set(i+1,people);
 }
 return map;
}
export function candidateSiteDrafts(manifest,roster,excerptPlan){
 const byMember=membershipIndex(manifest,roster);
 if(excerptPlan?.selectedExcerpts!==1197||excerptPlan.ready?.length+excerptPlan.holds?.length!==1197)
  throw Error('Pinned 1197 website excerpts were not reconciled');
 const ready=excerptPlan.ready,items=[],unique=new Set();
 for(const row of ready){
  if(!Number.isInteger(row.ordinal)||row.ordinal<1||row.ordinal>95
   ||!SHA.test(row.sourceSha||'')||!SHA.test(row.ingestionIdentityKey||'')
   ||typeof row.literal!=='string'||row.literal.length<5||row.literal.length>1600
   ||!/^https?:\/\/[^/\s]+/i.test(row.sourceUrl||'')
   ||! /^[A-Z2-7]{32}$/.test(row.originalCdxSha1||''))
   throw Error('Historical candidate website row malformed');
  const observed=new Date(row.archiveCapturedAt);
  if(!Number.isFinite(observed.getTime())||observed.getUTCFullYear()>2026)
   throw Error('Invalid original archive observation time');
  const copies=byMember.get(row.ordinal),matching=sessionFor(observed.getUTCFullYear());
  const current=copies.find(x=>x.sessionSlug===matching);
  const membership=(current||copies[0]).membershipId;
  const timestamp=row.archiveCapturedAt.replace(/\D/g,'').slice(0,14);
  const archiveUrl='https://web.archive.org/web/'+timestamp+'id_/'+row.sourceUrl;
  const evidenceKey=row.ingestionIdentityKey;
  if(unique.has(evidenceKey))throw Error('Duplicate source excerpt identity');
  unique.add(evidenceKey);
  items.push({
   key:evidenceKey,membershipId:membership,sourceSha:row.sourceSha,
   sourceUrl:archiveUrl,observedAt:row.archiveCapturedAt,literal:row.literal,
   issueTag:row.issueTag,originalUrl:row.sourceUrl,ordinal:row.ordinal,
   cdx:row.originalCdxSha1,
  });
 }
 if(items.length!==ready.length||items.length>1197)throw Error('Website research selection drift');
 return items;
}
export function websiteEvidenceDraft(row){
 return {
  source:{
   sourceKind:'wayback_campaign_site',sourceUrl:row.sourceUrl,
   contentSha256:row.sourceSha,jurisdictionSlug:'us-mn',chamberSlug:'senate',
   httpStatus:200,metadata:{
    originalUrl:row.originalUrl,archiveCapturedAt:row.observedAt,
    availableAt:row.observedAt,availabilityProof:'archived_original_html_plus_cdx_research_ledger',
    originalCdxSha1Base32:row.cdx,
    issue864WebsiteSourceAsOf:true,
   },
  },
  drafts:[{
   target:{membershipId:row.membershipId},
   kind:'context',stance:'neutral',
   claim:'Candidate campaign website text observed in an archived copy on '+row.observedAt.slice(0,10),
   excerpt:row.literal,
   publishedAt:row.observedAt,
   sourceQuality:'member_primary',relevance:'low',freshness:'stale',
   extractionMethod:'literal_archived_candidate_site_research_excerpt',
   extractionVersion:WEBSITE_SIGNAL_VERSION,
   confidence:1,
   metadata:{
    contextType:'historical_candidate_website_text',subtype:'literal_candidate_website_excerpt',
    ingestionIdentityKey:row.key,issueTag:row.issueTag,
    originalUrl:row.originalUrl,archiveUrl:row.sourceUrl,
    archiveCapturedAt:row.observedAt,availableAt:row.observedAt,
    availabilityProof:'original_site_html_cdx_index_in_existing_research',
    observationDateNotFirstAuthorship:true,
    publishedAtRepresentsArchiveObservation:true,
    candidatePublishedTextNotVerifiedPersonalVote:true,
    asOfEligible:true,sameDayEligible:false,
    contextOnly:true,mechanicallyActionable:false,modelWeight:0,
    experimentalWebsiteTextForHistoricalEvaluation:true,
   },
  }]
 };
}
export const WEBSITE_ASOF_QUERY=[
 'SELECT ei.excerpt AS text,ei.metadata->>\'issueTag\' AS "issueTag",',
 'ei.published_at AS "observedAt",sd.source_url AS "archiveUrl"',
 'FROM memberships vote_m',
 'JOIN memberships website_m ON website_m.legislator_id=vote_m.legislator_id',
 'JOIN evidence_items ei ON ei.membership_id=website_m.id',
 'JOIN source_documents sd ON sd.id=ei.source_document_id',
 "WHERE vote_m.id=$1::uuid AND ei.published_at < $2::timestamptz",
 "AND ei.metadata->>'experimentalWebsiteTextForHistoricalEvaluation'='true'",
 "AND ei.metadata->>'mechanicallyActionable'='false'",
 'ORDER BY ei.published_at,ei.id LIMIT 1601',
].join(' ');
