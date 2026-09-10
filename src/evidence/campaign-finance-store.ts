import { getCampaignFinanceContextForMember, type CampaignFinanceMemberContext, type RankedAmount } from './campaign-finance-snapshot';
import { pool } from '@/lib/db';

export type StoredCampaignFinanceEvidenceRow = {
  source_url: string;
  created_at: string;
  metadata: unknown;
};

type FinanceSubtype = 'candidate_contributions' | 'candidate_expenditures' | 'independent_expenditures';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function count(value: unknown): number {
  const parsed = number(value);
  return parsed === undefined ? 0 : Math.max(0, Math.round(parsed));
}

function rankedAmounts(value: unknown): RankedAmount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): RankedAmount[] => {
    const item = record(candidate);
    if (!item) return [];
    const name = text(item.name);
    const amount = number(item.amount);
    if (!name || amount === undefined) return [];
    return [{
      name,
      amount,
      count: count(item.count),
      type: text(item.type),
      employer: text(item.employer),
      direction: text(item.direction),
    }];
  });
}

function cycleRank(metadata: JsonRecord): number {
  const years = Array.isArray(metadata.cycleYears)
    ? metadata.cycleYears.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    : [];
  return years.length ? Math.max(...years) : 0;
}

function subtype(metadata: JsonRecord): FinanceSubtype | undefined {
  const value = text(metadata.subtype);
  if (value === 'candidate_contributions' || value === 'candidate_expenditures' || value === 'independent_expenditures') return value;
  return undefined;
}

function currentRows(rows: readonly StoredCampaignFinanceEvidenceRow[]): Map<FinanceSubtype, { row: StoredCampaignFinanceEvidenceRow; metadata: JsonRecord }> {
  const selected = new Map<FinanceSubtype, { row: StoredCampaignFinanceEvidenceRow; metadata: JsonRecord }>();
  for (const row of rows) {
    const metadata = record(row.metadata);
    if (!metadata || metadata.contextType !== 'campaign_finance') continue;
    const kind = subtype(metadata);
    if (!kind) continue;
    const existing = selected.get(kind);
    if (!existing) {
      selected.set(kind, { row, metadata });
      continue;
    }
    const rank = cycleRank(metadata);
    const existingRank = cycleRank(existing.metadata);
    if (rank > existingRank || (rank === existingRank && row.created_at > existing.row.created_at)) {
      selected.set(kind, { row, metadata });
    }
  }
  return selected;
}

export function campaignFinanceContextFromStoredEvidence(
  input: { membershipId: string; memberName: string },
  rows: readonly StoredCampaignFinanceEvidenceRow[],
): CampaignFinanceMemberContext | undefined {
  const selected = currentRows(rows);
  if (selected.size === 0) return undefined;

  const contribution = selected.get('candidate_contributions');
  const expenditure = selected.get('candidate_expenditures');
  const independent = selected.get('independent_expenditures');
  const identity = contribution?.metadata ?? expenditure?.metadata ?? independent?.metadata;
  if (!identity) return undefined;

  const contributions = contribution ? {
    sourceUrl: contribution.row.source_url,
    transactionCount: count(contribution.metadata.transactionCount),
    totalAmount: number(contribution.metadata.totalAmount) ?? 0,
    latestReceiptDate: text(contribution.metadata.latestReceiptDate),
    topContributors: rankedAmounts(contribution.metadata.topContributors),
    byContributorType: rankedAmounts(contribution.metadata.byContributorType),
    topEmployers: rankedAmounts(contribution.metadata.topEmployers),
  } : undefined;

  const expenditures = expenditure ? {
    sourceUrl: expenditure.row.source_url,
    transactionCount: count(expenditure.metadata.transactionCount),
    totalAmount: number(expenditure.metadata.totalAmount) ?? 0,
    latestDate: text(expenditure.metadata.latestDate),
    topPayees: rankedAmounts(expenditure.metadata.topPayees),
    byPurpose: rankedAmounts(expenditure.metadata.byPurpose),
    byType: rankedAmounts(expenditure.metadata.byType),
  } : undefined;

  const independentExpenditures = independent ? {
    sourceUrl: independent.row.source_url,
    transactionCount: count(independent.metadata.transactionCount),
    totalAmount: number(independent.metadata.totalAmount) ?? 0,
    forAmount: number(independent.metadata.forAmount) ?? 0,
    againstAmount: number(independent.metadata.againstAmount) ?? 0,
    latestDate: text(independent.metadata.latestDate),
    topSpenders: rankedAmounts(independent.metadata.topSpenders),
  } : undefined;

  return {
    membershipId: input.membershipId,
    memberName: input.memberName,
    candidateName: text(identity.candidateName) ?? input.memberName,
    committeeName: text(identity.committeeName) ?? 'Candidate committee',
    registrationNumber: text(identity.registrationNumber),
    contributions,
    expenditures,
    independentExpenditures,
  };
}

export async function loadCurrentCampaignFinanceContext(input: {
  membershipId: string;
  memberName: string;
  chamber?: string;
}): Promise<CampaignFinanceMemberContext | undefined> {
  const result = await pool.query<StoredCampaignFinanceEvidenceRow>(`
    SELECT sd.source_url,
           ei.created_at::text,
           ei.metadata
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id = ei.source_document_id
     WHERE ei.membership_id = $1::uuid
       AND ei.metadata->>'contextType' = 'campaign_finance'
       AND NOT EXISTS (
         SELECT 1
           FROM evidence_relationships er
          WHERE er.to_evidence_id = ei.id
            AND er.relation_kind = 'supersedes'
       )
     ORDER BY ei.created_at DESC`, [input.membershipId]);

  return campaignFinanceContextFromStoredEvidence(input, result.rows)
    ?? getCampaignFinanceContextForMember(input);
}
