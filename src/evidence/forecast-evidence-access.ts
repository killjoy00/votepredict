import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { certifiedHistoricalFinanceAvailableOn } from '../evaluation/historical-finance-asof-proof';

export const FORECAST_EVIDENCE_ACCESS_VERSION='forecast-evidence-access-v1' as const;
export interface AccessibleEvidence {
  id: string; sourceHash: string; sourceUrl: string; sourceKind: string; sourceMembershipId: string | null;
  targetMembershipId: string; legislatorId: string; billId: string | null; excerpt: string | null;
  publishedAt: string | null; fetchedAt: string; metadata: Record<string,unknown>; sourceMetadata: Record<string,unknown>; extractionVersion?: string;
}
export interface EvidenceUseDecision {
  version: typeof FORECAST_EVIDENCE_ACCESS_VERSION;
  allowedUse: 'context' | 'website_text_research' | 'historical_finance_research';
  servingAllowed: false; availableAt: string | null; canonicalKey: string;
  exclusionReason: string | null; missingMeans: 'unknown';
}
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

export function classifyForecastEvidence(row: AccessibleEvidence, cutoff: string): EvidenceUseDecision {
  const m=row.metadata,s=row.sourceMetadata,t=Date.parse(cutoff);
  if (!Number.isFinite(t)) throw new Error('Invalid evidence cutoff');
  const result: EvidenceUseDecision={version:FORECAST_EVIDENCE_ACCESS_VERSION,allowedUse:'context',servingAllowed:false,
    availableAt:null,canonicalKey:'observation:'+row.id,exclusionReason:'NO_ADMITTED_HISTORICAL_PROOF',missingMeans:'unknown'};
  if (!/^[a-f0-9]{64}$/.test(row.sourceHash)) return {...result,exclusionReason:'INVALID_SOURCE_IDENTITY'};
  const finance=['candidate_contribution_record','candidate_expenditure_record','independent_expenditure_record'].includes(String(m.subtype));
  if (finance) {
    const filer=m.subtype==='independent_expenditure_record'?m.spenderRegistrationNumber:m.filerRegistrationNumber;
    if (!/^[0-9]{3,8}$/.test(String(filer)) || !/^[a-f0-9]{64}$/.test(String(m.rowKey)) || !/^20\d\d$/.test(String(m.year)))
      return {...result,exclusionReason:'MISSING_CANONICAL_TRANSACTION_IDENTITY'};
    result.canonicalKey='finance:'+sha([m.subtype,filer,m.year,m.rowKey].join('|'));
    const day=certifiedHistoricalFinanceAvailableOn({...m,publicationDay:row.publishedAt?.slice(0,10)});
    // A date-only proof excludes the entire target date, using an explicit UTC day.
    if (day && day < cutoff.slice(0,10)) return {...result,allowedUse:'historical_finance_research',availableAt:day,exclusionReason:null};
    return {...result,exclusionReason:'FINANCE_EXACT_ROW_PUBLICATION_UNPROVED'};
  }
  if (m.experimentalWebsiteTextForHistoricalEvaluation===true) {
    result.canonicalKey='person-literal:'+sha(row.legislatorId+'|'+(row.excerpt??''));
    const observed=String(m.archiveCapturedAt??'');
    if (row.extractionVersion==='senate-864-literal-website-observed-asof-v1' && row.excerpt && m.mechanicallyActionable===false && m.asOfEligible===true
      && m.availabilityProof==='original_site_html_cdx_index_in_existing_research'
      && s.availabilityProof==='archived_original_html_plus_cdx_research_ledger'
      && s.archiveCapturedAt===observed && row.publishedAt && Date.parse(row.publishedAt)===Date.parse(observed)
      && /^[A-Z2-7]{32}$/.test(String(s.originalCdxSha1Base32))
      && Number.isFinite(Date.parse(observed)) && Date.parse(observed)<t)
      return {...result,allowedUse:'website_text_research',availableAt:observed,exclusionReason:null};
    return {...result,exclusionReason:'WEBSITE_LITERAL_SOURCE_OR_CLOCK_HOLD'};
  }
  if (Date.parse(row.fetchedAt)<t) return {...result,availableAt:row.fetchedAt,exclusionReason:'CONTEXT_ONLY_NO_DIRECTIONAL_ADMISSION'};
  return {...result,exclusionReason:'OBSERVED_AFTER_CUTOFF'};
}

/** Bounded stable-person access. No stance conversion, scoring, training or automatic promotion. */
export async function readForecastEvidence(db: Pick<Pool,'query'>, input: {
  membershipId:string; billId:string; cutoff:string; family:'website_text'|'finance'|'bill_context'; year?:number; limit?:number;
}): Promise<{version:typeof FORECAST_EVIDENCE_ACCESS_VERSION;missingMeans:'unknown';scope:'bounded_retained_corpus';observations:Array<AccessibleEvidence & {use:EvidenceUseDecision;sourceObservationIds:string[]}>}> {
  const limit=input.limit??500;
  if (!Number.isFinite(Date.parse(input.cutoff))) throw new Error('Invalid evidence cutoff');
  if (!['website_text','finance','bill_context'].includes(input.family)) throw new Error('Unsupported evidence family');
  if (!Number.isInteger(limit)||limit<1||limit>2000) throw new Error('Evidence limit must be 1..2000');
  if (input.family==='finance' && (!Number.isInteger(input.year)||input.year!<2000||input.year!>2100)) throw new Error('Finance access requires a bounded year');
  const rows=(await db.query<AccessibleEvidence>(`
    WITH target AS (
      SELECT m.* FROM memberships m JOIN bills requested ON requested.id=$2::uuid AND requested.session_id=m.session_id
      WHERE m.id=$1::uuid
    ), scoped AS (
      SELECT ei.* FROM evidence_items ei JOIN memberships original ON original.id=ei.membership_id
      JOIN target ON target.legislator_id=original.legislator_id
      WHERE ei.bill_id=$2::uuid OR ei.bill_id IS NULL
      UNION ALL
      SELECT ei.* FROM evidence_items ei WHERE ei.membership_id IS NULL AND ei.bill_id=$2::uuid AND $4='bill_context'
    )
    SELECT ei.id::text,sd.content_sha256 AS "sourceHash",sd.source_url AS "sourceUrl",sd.source_kind AS "sourceKind",
      ei.membership_id::text AS "sourceMembershipId",target.id::text AS "targetMembershipId",target.legislator_id::text AS "legislatorId",
      ei.bill_id::text AS "billId",ei.excerpt,ei.published_at::text AS "publishedAt",sd.fetched_at::text AS "fetchedAt",
      ei.metadata,sd.metadata AS "sourceMetadata",ei.extraction_version AS "extractionVersion"
    FROM target CROSS JOIN scoped ei JOIN source_documents sd ON sd.id=ei.source_document_id
    WHERE target.id=$1::uuid AND (ei.bill_id=$2::uuid OR ei.bill_id IS NULL)
      AND (($4='website_text' AND ei.metadata->>'experimentalWebsiteTextForHistoricalEvaluation'='true')
        OR ($4='finance' AND ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record','independent_expenditure_record') AND ei.metadata->>'year'=$5)
        OR ($4='bill_context' AND ei.bill_id=$2::uuid))
    ORDER BY ei.id LIMIT $3`,[input.membershipId,input.billId,limit+1,input.family,String(input.year??'')])).rows;
  if (rows.length>limit) throw new Error('Evidence selection truncated; narrow the family/scope before use');
  const decisions=rows.map(row=>({...row,use:classifyForecastEvidence(row,input.cutoff),sourceObservationIds:[row.id]}));
  decisions.sort((a,b)=>Number(a.use.allowedUse==='context')-Number(b.use.allowedUse==='context')
    || (a.use.availableAt??'z').localeCompare(b.use.availableAt??'z') || a.id.localeCompare(b.id));
  const canonical=new Map<string,typeof decisions[number]>();
  for(const row of decisions){const prior=canonical.get(row.use.canonicalKey);if(prior)prior.sourceObservationIds.push(row.id);else canonical.set(row.use.canonicalKey,row);}
  return {version:FORECAST_EVIDENCE_ACCESS_VERSION,missingMeans:'unknown',scope:'bounded_retained_corpus',observations:[...canonical.values()]};
}
