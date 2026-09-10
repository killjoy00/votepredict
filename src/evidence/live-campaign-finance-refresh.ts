import { loadCurrentCampaignFinanceSnapshot } from '@/evidence/campaign-finance-live';
import { resolveCampaignFinanceMembersAgainstSnapshot } from '@/evidence/campaign-finance-snapshot';
import {
  persistDurableEvidence,
  type DurableEvidenceDraft,
  type DurableEvidenceFreshness,
} from '@/evidence/durable-ingestion';
import { pool } from '@/lib/db';

type MembershipRow = { membership_id: string; name: string; chamber_slug: string };

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function freshness(dateValue: string | undefined): DurableEvidenceFreshness {
  if (!dateValue) return 'unknown';
  const date = new Date(dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  if (ageDays <= 365) return 'current';
  if (ageDays <= 1095) return 'recent';
  return 'stale';
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 1800);
}

async function startRun(scope: string, metadata: Record<string, unknown>): Promise<string> {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ('mn-cfb-live',$1,'running',$2::jsonb)
    RETURNING id::text`, [scope, JSON.stringify(metadata)]);
  return result.rows[0].id;
}

async function completeRun(id: string, metadata: Record<string, unknown>, unresolvedMembers: number): Promise<void> {
  await pool.query(`
    UPDATE ingestion_runs
       SET status='complete', finished_at=now(), source_documents=2, unresolved_members=$2,
           metadata=metadata || $3::jsonb
     WHERE id=$1::uuid`, [id, unresolvedMembers, JSON.stringify(metadata)]);
}

async function failRun(id: string, error: unknown): Promise<void> {
  await pool.query(`
    UPDATE ingestion_runs
       SET status='failed', finished_at=now(), error_summary=$2
     WHERE id=$1::uuid`, [id, safeMessage(error)]).catch(() => undefined);
}

export async function runLiveCampaignFinanceRefresh() {
  const loaded = await loadCurrentCampaignFinanceSnapshot();
  const snapshot = loaded.snapshot;
  const runId = await startRun(`campaign-finance:${snapshot.cycleYears.join('-')}`, {
    snapshotSchemaVersion: snapshot.schemaVersion,
    snapshotGeneratedAt: snapshot.generatedAt,
    sourceMode: loaded.sourceMode,
    fallbackWarning: loaded.warning,
    execution: 'vercel-runtime',
  });

  try {
    const memberships = await pool.query<MembershipRow>(`
      SELECT m.id::text AS membership_id, l.name, c.slug AS chamber_slug
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE s.is_current=true
         AND (m.starts_on IS NULL OR m.starts_on<=current_date)
         AND (m.ends_on IS NULL OR m.ends_on>=current_date)
       ORDER BY c.slug,l.name`);

    const resolutions = resolveCampaignFinanceMembersAgainstSnapshot(snapshot, memberships.rows.map((membership) => ({
      membershipId: membership.membership_id,
      memberName: membership.name,
      chamber: membership.chamber_slug,
    })));
    const contexts = resolutions.flatMap((resolution) => resolution.context ? [resolution.context] : []);
    const resolvedWithActivity = resolutions.filter((resolution) => resolution.status === 'resolved_with_activity');
    const resolvedWithoutActivity = resolutions.filter((resolution) => resolution.status === 'resolved_without_activity');
    const notInActivitySnapshot = resolutions.filter((resolution) => resolution.status === 'not_in_activity_snapshot');
    const ambiguous = resolutions.filter((resolution) => resolution.status === 'ambiguous');

    const contributionDrafts: DurableEvidenceDraft[] = contexts.flatMap((context) => context.contributions ? [{
      target: { membershipId: context.membershipId },
      kind: 'context',
      stance: 'neutral',
      claim: `${snapshot.cycleYears.join('-')} campaign committee receipts total ${money(context.contributions.totalAmount)} across ${context.contributions.transactionCount.toLocaleString('en-US')} itemized records.`,
      publishedAt: context.contributions.latestReceiptDate ? `${context.contributions.latestReceiptDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official',
      relevance: 'low',
      freshness: freshness(context.contributions.latestReceiptDate),
      extractionMethod: 'deterministic-cfb-bulk-aggregate',
      extractionVersion: snapshot.schemaVersion,
      confidence: 1,
      metadata: {
        contextType: 'campaign_finance',
        subtype: 'candidate_contributions',
        contextOnly: true,
        mechanicallyActionable: false,
        committeeName: context.committeeName,
        candidateName: context.candidateName,
        registrationNumber: context.registrationNumber,
        cycleYears: snapshot.cycleYears,
        totalAmount: context.contributions.totalAmount,
        transactionCount: context.contributions.transactionCount,
        latestReceiptDate: context.contributions.latestReceiptDate,
        topContributors: context.contributions.topContributors,
        byContributorType: context.contributions.byContributorType,
        topEmployers: context.contributions.topEmployers,
        sourceMode: loaded.sourceMode,
      },
    }] : []);

    const independentDrafts: DurableEvidenceDraft[] = contexts.flatMap((context) => context.independentExpenditures ? [{
      target: { membershipId: context.membershipId },
      kind: 'context',
      stance: 'neutral',
      claim: `${snapshot.cycleYears.join('-')} independent expenditures affecting this candidate total ${money(context.independentExpenditures.totalAmount)} across ${context.independentExpenditures.transactionCount.toLocaleString('en-US')} records (${money(context.independentExpenditures.forAmount)} supporting; ${money(context.independentExpenditures.againstAmount)} opposing).`,
      publishedAt: context.independentExpenditures.latestDate ? `${context.independentExpenditures.latestDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official',
      relevance: 'low',
      freshness: freshness(context.independentExpenditures.latestDate),
      extractionMethod: 'deterministic-cfb-bulk-aggregate',
      extractionVersion: snapshot.schemaVersion,
      confidence: 1,
      metadata: {
        contextType: 'campaign_finance',
        subtype: 'independent_expenditures',
        contextOnly: true,
        mechanicallyActionable: false,
        committeeName: context.committeeName,
        candidateName: context.candidateName,
        registrationNumber: context.registrationNumber,
        cycleYears: snapshot.cycleYears,
        totalAmount: context.independentExpenditures.totalAmount,
        transactionCount: context.independentExpenditures.transactionCount,
        forAmount: context.independentExpenditures.forAmount,
        againstAmount: context.independentExpenditures.againstAmount,
        latestDate: context.independentExpenditures.latestDate,
        topSpenders: context.independentExpenditures.topSpenders,
        sourceMode: loaded.sourceMode,
      },
    }] : []);

    const contributions = await persistDurableEvidence({
      sourceKind: 'campaign_finance_bulk',
      sourceUrl: snapshot.provenance.contributions.url,
      contentSha256: snapshot.provenance.contributions.contentSha256,
      fetchedAt: snapshot.generatedAt,
      metadata: {
        publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
        dataset: 'candidate_contributions',
        cycleYears: snapshot.cycleYears,
        snapshotSchemaVersion: snapshot.schemaVersion,
        rows: snapshot.provenance.contributions.cycleRows,
        bytes: snapshot.provenance.contributions.bytes,
        sourceMode: loaded.sourceMode,
      },
    }, contributionDrafts);
    const independent = await persistDurableEvidence({
      sourceKind: 'campaign_finance_bulk',
      sourceUrl: snapshot.provenance.independentExpenditures.url,
      contentSha256: snapshot.provenance.independentExpenditures.contentSha256,
      fetchedAt: snapshot.generatedAt,
      metadata: {
        publisher: 'Minnesota Campaign Finance and Public Disclosure Board',
        dataset: 'independent_expenditures',
        cycleYears: snapshot.cycleYears,
        snapshotSchemaVersion: snapshot.schemaVersion,
        rows: snapshot.provenance.independentExpenditures.cycleRows,
        bytes: snapshot.provenance.independentExpenditures.bytes,
        sourceMode: loaded.sourceMode,
      },
    }, independentDrafts);

    const result = {
      sourceMode: loaded.sourceMode,
      fallbackWarning: loaded.warning,
      currentMemberships: memberships.rows.length,
      resolvedWithActivityMemberships: resolvedWithActivity.length,
      resolvedWithoutActivityMemberships: resolvedWithoutActivity.length,
      notInActivitySnapshotMemberships: notInActivitySnapshot.length,
      ambiguousMemberships: ambiguous.length,
      contributionEvidence: contributionDrafts.length,
      independentExpenditureEvidence: independentDrafts.length,
      inserted: contributions.inserted + independent.inserted,
      reused: contributions.reused + independent.reused,
      supersessionRelationships: contributions.supersessionRelationships + independent.supersessionRelationships,
      snapshotGeneratedAt: snapshot.generatedAt,
      contributionRows: snapshot.provenance.contributions.cycleRows,
      independentExpenditureRows: snapshot.provenance.independentExpenditures.cycleRows,
    };
    await completeRun(runId, result, result.ambiguousMemberships);
    return result;
  } catch (error) {
    await failRun(runId, error);
    throw error;
  }
}
