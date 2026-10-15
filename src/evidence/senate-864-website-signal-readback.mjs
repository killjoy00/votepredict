/** #864 bounded Neon replay verification. No raw website content logged. */
export const WEBSITE_NEON_RECEIPT_SQL=[
 'SELECT ei.membership_id::text AS "membershipId",ei.excerpt,ei.published_at AS "publishedAt",',
 'ei.evidence_kind AS kind,ei.stance,ei.metadata AS metadata,',
 'sd.source_url AS "sourceUrl",sd.content_sha256 AS "sourceSha",sd.metadata AS "sourceMetadata"',
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 "WHERE ei.metadata->>'ingestionIdentityKey'=ANY($1::text[])",
 'LIMIT 1201',
].join(' ');
export function verifyWebsiteNeonReadback(rows,plan,{complete=true}={}){
 if(!Array.isArray(rows)||!Array.isArray(plan)||plan.length>1197||rows.length>plan.length)
  throw Error('Invalid bounded website evidence result');
 const lookup=new Map(plan.map(p=>[p.key,p]));
 if(lookup.size!==plan.length)throw Error('Duplicate candidate website source plan');
 const used=new Set();
 for(const row of rows){
  const m=row.metadata||{},s=row.sourceMetadata||{},e=lookup.get(m.ingestionIdentityKey);
  const published=row.publishedAt instanceof Date?row.publishedAt.toISOString():row.publishedAt;
  if(!e||used.has(m.ingestionIdentityKey)||row.membershipId!==e.membershipId
   ||row.excerpt!==e.literal||published!==e.observedAt
   ||row.sourceSha!==e.sourceSha||row.sourceUrl!==e.sourceUrl
   ||row.kind!=='context'||row.stance!=='neutral'
   ||m.originalUrl!==e.originalUrl||s.originalUrl!==e.originalUrl
   ||m.archiveCapturedAt!==e.observedAt||s.archiveCapturedAt!==e.observedAt
   ||m.observationDateNotFirstAuthorship!==true
   ||m.publishedAtRepresentsArchiveObservation!==true
   ||m.experimentalWebsiteTextForHistoricalEvaluation!==true
   ||m.asOfEligible!==true||m.sameDayEligible!==false
   ||m.contextOnly!==true||m.mechanicallyActionable!==false||m.modelWeight!==0
   ||m.durableIngestion!==true||typeof m.ingestionKey!=='string')
   throw Error('Stored website source text/provenance/as-of eligibility mismatch');
  used.add(m.ingestionIdentityKey);
 }
 if(complete&&used.size!==plan.length)throw Error('Not all proven historical website text was saved in Neon');
 return used.size;
}
