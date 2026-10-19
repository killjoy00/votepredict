/** One authoritative #864 audit: aggregate outputs; private inputs never serialized. */
import {createHash} from 'node:crypto';
import {verifyWebsiteNeonReadback} from './senate-864-website-signal-readback.mjs';
export const sha=x=>createHash('sha256').update(x).digest('hex');
export function auditWebsiteReadback(rows,plan,personByMembership){
 if(rows.length>1200||plan.length!==616)throw Error('Bounded exact website cohort required');
 const expected=new Map(plan.map(p=>[p.key,p]));
 const byKey=new Map();
 for(const row of rows){
  const k=row.metadata?.ingestionIdentityKey;
  if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(row);
 }
 let matched=0,missing=0,duplicateKeys=0,mismatched=0,extra=0;
 const valid=[],byObservationYear={};
 for(const [key,p] of expected){
  const got=byKey.get(key)||[];
  if(!got.length){missing++;continue;}
  if(got.length!==1){duplicateKeys++;continue;}
  const r=got[0];
  try{
   verifyWebsiteNeonReadback(got,[p]);
   if(r.legislatorId!==personByMembership.get(p.membershipId)||
    r.sourceMetadata.originalCdxSha1Base32!==p.cdx||
    r.metadata.archiveUrl!==p.sourceUrl)throw Error('Stable person or indexed source digest mismatch');
   matched++;valid.push({...p,legislatorId:r.legislatorId});
   const y=p.observedAt.slice(0,4);byObservationYear[y]=(byObservationYear[y]||0)+1;
  }catch{mismatched++;}
 }
 for(const [key,group] of byKey)if(!expected.has(key))extra+=group.length;
 // Exact literal duplicates are feature duplicates, not ingestion duplicates.
 const dedup=new Map();
 for(const p of valid){
  const k=p.legislatorId+'|'+sha(p.literal),old=dedup.get(k);
  if(!old||[p.observedAt,p.sourceSha,p.key].join('|')<[old.observedAt,old.sourceSha,old.key].join('|'))dedup.set(k,p);
 }
 return {summary:{expected:616,matched,missing,duplicateKeys,mismatched,extra,
  byObservationYear,distinctPeople:new Set(valid.map(p=>p.legislatorId)).size,
  distinctOriginalPageBodies:new Set(valid.map(p=>p.sourceSha)).size,
  deduplicatedPersonLiteralFeatures:dedup.size,literalFeatureDuplicateCopies:valid.length-dedup.size},
  privateDeduplicated:[...dedup.values()].sort((a,b)=>a.key.localeCompare(b.key))};
}
export const COMPLETION_WEBSITE_SQL=`SELECT ei.membership_id::text AS "membershipId",m.legislator_id::text AS "legislatorId",
 ei.excerpt,ei.published_at AS "publishedAt",ei.evidence_kind AS kind,ei.stance,ei.metadata,
 sd.source_url AS "sourceUrl",sd.content_sha256 AS "sourceSha",sd.metadata AS "sourceMetadata"
 FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id JOIN memberships m ON m.id=ei.membership_id
 WHERE ei.metadata->>'ingestionIdentityKey'=ANY($1::text[])
 OR ei.metadata->>'experimentalWebsiteTextForHistoricalEvaluation'='true' ORDER BY ei.id LIMIT 1201`;
export const COHORT_COUNTS_SQL=`WITH observed AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
 AS x(person uuid,observed_at timestamptz)), target AS (
 SELECT DISTINCT ON (mv.membership_id,v.bill_id) mv.membership_id,m.legislator_id,v.bill_id,v.id AS event_id,v.occurred_on,
 (m.starts_on IS NOT NULL AND m.ends_on IS NOT NULL AND m.starts_on<=v.occurred_on AND m.ends_on>=v.occurred_on) AS service_proven
 FROM member_votes mv JOIN vote_events v ON v.id=mv.vote_event_id JOIN memberships m ON m.id=mv.membership_id
 JOIN chambers c ON c.id=v.chamber_id JOIN legislative_sessions s ON s.id=v.session_id
 JOIN jurisdictions j ON j.id=s.jurisdiction_id
 WHERE c.slug='senate' AND j.slug='us-mn' AND v.is_passage=true AND v.bill_id IS NOT NULL
 AND v.occurred_on BETWEEN DATE '2021-01-01' AND DATE '2025-12-31'
 AND m.session_id=v.session_id AND m.chamber_id=v.chamber_id AND mv.choice IN ('yea','nay')
 AND v.metadata->>'committeeVote' IS DISTINCT FROM 'true'
 ORDER BY mv.membership_id,v.bill_id,v.occurred_on,v.external_key), classified AS (
 SELECT t.*,EXISTS(SELECT 1 FROM observed o WHERE o.person=t.legislator_id
 AND o.observed_at < (t.occurred_on::timestamp AT TIME ZONE 'America/Chicago')) AS prior_text FROM target t)
 SELECT extract(year FROM occurred_on)::int AS year,count(*)::int AS target_member_bills,
 count(*) FILTER(WHERE NOT service_proven)::int AS unknown_service_targets,
 count(*) FILTER(WHERE service_proven AND prior_text)::int AS qualified_member_bills,
 count(DISTINCT bill_id) FILTER(WHERE service_proven AND prior_text)::int AS qualified_bills,
 count(DISTINCT legislator_id) FILTER(WHERE service_proven AND prior_text)::int AS qualified_people,
 encode(sha256(convert_to(coalesce(string_agg(concat_ws('|',membership_id,bill_id,event_id,occurred_on),E'\\n' ORDER BY membership_id,bill_id,event_id)
 FILTER(WHERE service_proven AND prior_text),''),'UTF8')),'hex') AS cohort_sha256
 FROM classified GROUP BY 1 ORDER BY 1 LIMIT 6`;
export const MEDIA_CONTEXT_SQL=`SELECT sd.id::text AS "sourceId",sd.content_sha256 AS "sourceSha",ei.metadata,
 ei.evidence_kind AS kind,ei.stance,ei.published_at AS "publishedAt"
 FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id
 WHERE sd.source_kind='wayback_local_trade_news' AND ei.metadata->>'contextType'='local_trade_news'
 ORDER BY ei.id LIMIT 2001`;
const fullName=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
export function mediaAccounting(rows,manifest,seeds){
 if(rows.length>2000||manifest.people.length!==95||seeds.length!==44)throw Error('Media public scope mismatch');
 const people=new Map(manifest.people.map((p,i)=>[fullName(p.officialName),i+1]));
 if(people.size!==95)throw Error('Ambiguous public full-name roster');
 const sources=new Map(seeds.map(s=>[s.id,s]));
 const matrix=new Map(),years=new Map(),seenSources=new Set();
 let outside=0,invalidClock=0,unknownSeed=0,unresolvedMentionTokens=0,unsafeFlags=0;
 for(const row of rows){
  const m=row.metadata||{},stamp=m.archiveCapturedAt;
  if(typeof stamp!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(stamp)||!Number.isFinite(Date.parse(stamp))){invalidClock++;continue;}
  const y=Number(stamp.slice(0,4));if(y<2021||y>2025){outside++;continue;}
  if(!sources.has(m.seedId)){unknownSeed++;continue;}
  if(m.contextOnly!==true||m.mechanicallyActionable!==false||m.modelWeight!==0||m.sameDayEligible!==false||row.kind!=='context'||row.stance!=='neutral')unsafeFlags++;
  if(!years.has(y))years.set(y,{year:y,contexts:0,sources:new Set(),publisherDatedContexts:0});
  const year=years.get(y);year.contexts++;year.sources.add(row.sourceId);seenSources.add(row.sourceId);
  if(m.publisherPublishedAt)year.publisherDatedContexts++;
  // Exact full official name only; a contextual mention never becomes a speaker.
  const mentions=new Set();
  for(const name of Array.isArray(m.mentionedMembers)?m.mentionedMembers:[]){
   const ordinal=people.get(fullName(name));
   if(ordinal)mentions.add(ordinal);else unresolvedMentionTokens++;
  }
  for(const ordinal of mentions.size?mentions:[0]){
   const k=[ordinal,y,m.seedId].join('|');
   if(!matrix.has(k))matrix.set(k,{personOrdinal:ordinal,year:y,seedId:m.seedId,contextRows:0,sources:new Set()});
   const x=matrix.get(k);x.contextRows++;x.sources.add(row.sourceId);
  }
 }
 return {scope:'44_seed_local_news_context_only',rows:rows.length,outsideStudyCaptureYear:outside,
  invalidArchiveClock:invalidClock,unknownSeed,unresolvedFullNameMentionTokens:unresolvedMentionTokens,unsafeNeutralFlags:unsafeFlags,
  inRangeDistinctSourceDocuments:seenSources.size,
  years:[...years.values()].sort((a,b)=>a.year-b.year).map(x=>({year:x.year,contexts:x.contexts,distinctSources:x.sources.size,publisherDatedContexts:x.publisherDatedContexts})),
  nonzeroSenatorYearSourceCells:[...matrix.values()].sort((a,b)=>a.personOrdinal-b.personOrdinal||a.year-b.year||a.seedId.localeCompare(b.seedId)).map(x=>({personOrdinal:x.personOrdinal,year:x.year,seedId:x.seedId,contextRows:x.contextRows,distinctSources:x.sources.size})),
  zeroCellsMean:'Unobserved in this bounded stored context, never no published statement',
  namedAttributableStatementsCertifiedByThisContextAudit:0,publicationsDenominator:'UNKNOWN'};
}
export const FINANCE_CANONICAL_SQL=`WITH rows AS (
 SELECT ei.metadata AS m,sd.source_kind,
 CASE WHEN ei.metadata->>'subtype'='candidate_contribution_record' AND sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk') THEN 'candidate_contribution'
 WHEN ei.metadata->>'subtype'='candidate_expenditure_record' AND sd.source_kind IN ('campaign_finance_candidate_expenditure_bulk','campaign_finance_bulk') THEN 'candidate_expenditure'
 WHEN ei.metadata->>'subtype'='independent_expenditure_record' AND sd.source_kind='campaign_finance_independent_expenditure_bulk' THEN 'independent_expenditure' ELSE 'category_mismatch' END AS family
 FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id LEFT JOIN memberships mem ON mem.id=ei.membership_id
 LEFT JOIN chambers c ON c.id=mem.chamber_id
 WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_candidate_expenditure_bulk','campaign_finance_independent_expenditure_bulk','campaign_finance_bulk')
 AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')
 AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))), identified AS (SELECT rows.*,CASE WHEN family='independent_expenditure' THEN m->>'spenderRegistrationNumber' ELSE m->>'filerRegistrationNumber' END AS canonical_filer FROM rows)
 SELECT m->>'year' AS year,family,count(*)::int AS evidence_copies,
 count(DISTINCT (canonical_filer,m->>'year',m->>'rowKey')) FILTER(WHERE m->>'rowKey' ~ '^[a-f0-9]{64}$' AND canonical_filer ~ '^[0-9]{3,8}$')::int AS canonical_transactions,
 count(*) FILTER(WHERE NOT coalesce(m->>'rowKey' ~ '^[a-f0-9]{64}$' AND canonical_filer ~ '^[0-9]{3,8}$',false))::int AS copies_missing_canonical_identity,
 count(*) FILTER(WHERE m->>'asOfEligible'='true')::int AS legacy_eligible_copies,
 count(*) FILTER(WHERE family='candidate_contribution' AND (m->>'contributorType' IS NULL OR m->>'contributorType'=''))::int AS unclassified_contributor_type_copies,
 count(*) FILTER(WHERE family IN ('candidate_contribution','candidate_expenditure') AND EXISTS(SELECT 1 FROM cfb_official_senate_pdf_versions v WHERE v.committee_registration=m->>'filerRegistrationNumber' AND v.report_year::text=m->>'year'))::int AS copies_in_indexed_committee_years,
 count(DISTINCT (canonical_filer,m->>'year',m->>'rowKey')) FILTER(WHERE m->>'rowKey' ~ '^[a-f0-9]{64}$' AND canonical_filer ~ '^[0-9]{3,8}$' AND family IN ('candidate_contribution','candidate_expenditure') AND EXISTS(SELECT 1 FROM cfb_official_senate_pdf_versions v WHERE v.committee_registration=m->>'filerRegistrationNumber' AND v.report_year::text=m->>'year'))::int AS canonical_in_indexed_committee_years
 FROM identified GROUP BY 1,2 ORDER BY 1,2 LIMIT 21`;
export const FINANCE_REGISTRY_SQL=`SELECT report_year AS year,count(*)::int AS versions,count(DISTINCT full_original_pdf_sha256)::int AS pdf_bodies,
 count(*) FILTER(WHERE historical_exact_version_public_by_proven)::int AS tracked_historical_version_public_by_proofs,
 count(*) FILTER(WHERE EXISTS(SELECT 1 FROM cfb_finance_pdf_body_captures b WHERE b.pdf_sha256=full_original_pdf_sha256 AND b.byte_length=full_original_pdf_bytes))::int AS versions_with_cached_bodies
 FROM cfb_official_senate_pdf_versions GROUP BY report_year ORDER BY report_year LIMIT 6`;
export const COMMITTEE_YEAR_SQL=`SELECT extract(year FROM v.occurred_on)::int AS year,count(*)::int AS stored_events,
 count(*) FILTER(WHERE v.metadata->>'individualVotesAvailable'='true')::int AS declared_named_events,
 coalesce(sum((SELECT count(*) FROM member_votes mv WHERE mv.vote_event_id=v.id)),0)::int AS explicit_stored_choices,
 count(*) FILTER(WHERE v.metadata->>'meetingDateIsAvailability'='true' AND v.metadata->>'availableOn'=v.occurred_on::text AND v.metadata->>'sameDayEligible'='false')::int AS hearing_date_timing_events
 FROM vote_events v JOIN chambers c ON c.id=v.chamber_id JOIN legislative_sessions s ON s.id=v.session_id
 JOIN jurisdictions j ON j.id=s.jurisdiction_id WHERE j.slug='us-mn' AND c.slug='senate'
 AND v.metadata->>'committeeVote'='true' AND v.occurred_on BETWEEN DATE '2021-01-01' AND DATE '2025-12-31'
 GROUP BY 1 ORDER BY 1 LIMIT 6`;
export const DIRECT_STATEMENT_SQL=`SELECT ei.id::text AS "evidenceId",m.legislator_id::text AS "legislatorId",ei.membership_id::text AS "membershipId",
 sd.source_url AS "sourceUrl",sd.source_kind AS "sourceKind",sd.content_sha256 AS "sourceSha",ei.excerpt,
 ei.published_at AS "publishedAt",ei.metadata,ei.stance,ei.evidence_kind AS "evidenceKind",ei.bill_id::text AS "billId"
 FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id
 JOIN memberships m ON m.id=ei.membership_id JOIN chambers c ON c.id=m.chamber_id
 WHERE c.slug='senate' AND ei.evidence_kind='direct_statement'
 AND sd.source_kind IN ('member_primary_article','senate_member_primary_historical_article','public_news_article','wayback_local_trade_news','wayback_member_primary')
 AND ei.published_at>=TIMESTAMPTZ '2021-01-01T00:00:00Z' AND ei.published_at<TIMESTAMPTZ '2027-01-01T00:00:00Z'
 ORDER BY ei.id LIMIT 10001`;
export function safeGroupedCounts(rows,groups,metrics,{max=100,allowed={}}={}){
 if(!Array.isArray(rows)||rows.length>max)throw Error('Unbounded public aggregate');
 for(const r of rows){
  const keys=[...groups,...metrics];
  if(Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k)))throw Error('Private aggregate field rejected');
  for(const k of groups)if(allowed[k]&&!allowed[k].includes(r[k]))throw Error('Unexpected aggregate scope');
  for(const k of metrics)if(!Number.isSafeInteger(r[k])||r[k]<0||r[k]>3000000)throw Error('Invalid aggregate count');
 }
 return rows;
}
// CASE guards the cast itself: planner reordering of a chamber join must not
// attempt to cast House districts such as 1A while auditing Senate members.
export const CURRENT_VERIFIED_MEMBER_SQL=`SELECT m.id::text AS "membershipId",
 CASE WHEN m.district ~ '^[0-9]{1,2}$' THEN m.district::int END AS district,l.name FROM memberships m
 JOIN legislators l ON l.id=m.legislator_id JOIN legislative_sessions s ON s.id=m.session_id JOIN chambers c ON c.id=m.chamber_id
 WHERE s.slug='2025-2026' AND c.slug='senate'
 AND CASE WHEN m.district ~ '^[0-9]{1,2}$' THEN m.district::int END=ANY($1::int[]) ORDER BY district LIMIT 151`;

export function safeCohortCounts(rows){
 if(!Array.isArray(rows)||rows.length>5)throw Error('Unbounded cohort years');
 const counts=rows.map(({cohort_sha256,...r})=>{
  if(!/^[a-f0-9]{64}$/.test(cohort_sha256||''))throw Error('Invalid aggregate cohort fingerprint');
  return r;
 });
 safeGroupedCounts(counts,['year'],['target_member_bills','unknown_service_targets','qualified_member_bills','qualified_bills','qualified_people'],{allowed:{year:[2021,2022,2023,2024,2025]},max:5});
 return rows;
}
