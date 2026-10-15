/** #864: exact database read-back after historical original context import. */
export const RECEIPT_SQL=[
 'SELECT ei.membership_id::text AS "membershipId",',
 'ei.evidence_kind AS kind,ei.stance,ei.published_at AS "publishedAt",',
 'ei.metadata AS "itemMetadata",sd.metadata AS "sourceMetadata",',
 'sd.source_url AS "sourceUrl",sd.content_sha256 AS "sourceSha"',
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 "WHERE ei.metadata->>'ingestionIdentityKey'=ANY($1::text[])",
 'LIMIT 145'
].join(' ');
export function assertStoredOriginalReceipts(rows,plan,{complete=true}={}){
 if(!Array.isArray(rows)||!Array.isArray(plan)||plan.length!==72||rows.length>72)
  throw Error('Unbounded or duplicate original receipts');
 const known=new Map(plan.map(x=>[x.key,x]));
 if(known.size!==72)throw Error('Non-unique receipt identities');
 const seen=new Set();
 for(const r of rows){
  const m=r.itemMetadata||{},s=r.sourceMetadata||{},p=m.issue864HistoricalOriginal||{};
  const expected=known.get(m.ingestionIdentityKey);
  if(!expected||seen.has(m.ingestionIdentityKey)
   ||r.membershipId!==expected.membershipId
   ||r.kind!=='context'||r.stance!=='neutral'||r.publishedAt!==null
   ||r.sourceUrl!==expected.provenance.archiveUrl
   ||r.sourceSha!==expected.originalSha
   ||s.originalUrl!==expected.originalUrl
   ||s.archiveCapturedAt!==expected.provenance.archiveCapturedAtUtc
   ||s.issue864HistoricalOriginal?.originalHtmlSha256!==expected.originalSha
   ||p.originalUrl!==expected.originalUrl
   ||p.originalHtmlSha256!==expected.originalSha
   ||m.contextOnly!==true||m.asOfEligible!==false||m.sameDayEligible!==false
   ||m.mechanicallyActionable!==false||m.modelWeight!==0
   ||m.officialVoteVerified!==false||m.originalFirstAuthoredDateKnown!==false
   ||m.durableIngestion!==true||typeof m.ingestionKey!=='string')
   throw Error('Stored historic page receipt drift or unsafe eligibility');
  seen.add(m.ingestionIdentityKey);
 }
 if(complete&&seen.size!==72)throw Error('Historic original 72-page Neon read-back incomplete');
 return seen.size;
}
