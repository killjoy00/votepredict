import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  resolveCampaignFinanceMembersAgainstSnapshot,
  type CampaignFinanceSnapshot,
} from '../src/evidence/campaign-finance-snapshot.js';

type MembershipRow = { membership_id: string; name: string; chamber_slug: string };

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function configureProductionEnvironment(): void {
  const path = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!path) return;
  const parsed = parseRuntimeEnvironment(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) if (value !== undefined) process.env[key] = value;
}

function safeErrorText(error: unknown): string {
  let message = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 4 || !/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key)) continue;
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function freshness(dateValue: string | undefined): 'current' | 'recent' | 'stale' | 'unknown' {
  if (!dateValue) return 'unknown';
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  if (ageDays <= 365) return 'current';
  if (ageDays <= 1095) return 'recent';
  return 'stale';
}

async function main(): Promise<void> {
  configureProductionEnvironment();
  const snapshotPath = resolve(argumentValue('--snapshot') ?? 'data/cfb-2025-2026-snapshot.json');
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as CampaignFinanceSnapshot;
  if (!snapshot.schemaVersion || !snapshot.generatedAt || !Array.isArray(snapshot.candidates)) throw new Error('Invalid CFB snapshot');
  for (const source of [snapshot.provenance.contributions, snapshot.provenance.independentExpenditures]) {
    if (!/^https?:\/\//i.test(source.url) || !/^[a-f0-9]{64}$/i.test(source.contentSha256)) throw new Error('CFB snapshot provenance is incomplete');
  }

  const [{ pool }, { persistDurableEvidence }] = await Promise.all([
    import('../src/lib/db/index.js'),
    import('../src/evidence/durable-ingestion.js'),
  ]);

  const run = await pool.query<{ id: string }>(`
    INSERT INTO ingestion_runs (source_system, scope, status, metadata)
    VALUES ('mn-cfb', $1, 'running', $2::jsonb)
    RETURNING id::text`, [
    `campaign-finance:${snapshot.cycleYears.join('-')}`,
    JSON.stringify({ snapshotSchemaVersion: snapshot.schemaVersion, snapshotGeneratedAt: snapshot.generatedAt, snapshotPath }),
  ]);
  const runId = run.rows[0].id;

  try {
    const memberships = await pool.query<MembershipRow>(`
      SELECT m.id::text AS membership_id, l.name, c.slug AS chamber_slug
        FROM memberships m
        JOIN legislators l ON l.id = m.legislator_id
        JOIN legislative_sessions s ON s.id = m.session_id
        JOIN chambers c ON c.id = m.chamber_id
       WHERE s.is_current = true
         AND (m.starts_on IS NULL OR m.starts_on <= current_date)
         AND (m.ends_on IS NULL OR m.ends_on >= current_date)
       ORDER BY c.slug, l.name`);

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

    const contributionDrafts = contexts.flatMap((context) => context.contributions ? [{
      target: { membershipId: context.membershipId },
      kind: 'context' as const,
      stance: 'neutral' as const,
      claim: `${snapshot.cycleYears.join('-')} campaign committee receipts total ${money(context.contributions.totalAmount)} across ${context.contributions.transactionCount.toLocaleString('en-US')} itemized records.`,
      publishedAt: context.contributions.latestReceiptDate ? `${context.contributions.latestReceiptDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official' as const,
      relevance: 'low' as const,
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
      },
    }] : []);
    const independentDrafts = contexts.flatMap((context) => context.independentExpenditures ? [{
      target: { membershipId: context.membershipId },
      kind: 'context' as const,
      stance: 'neutral' as const,
      claim: `${snapshot.cycleYears.join('-')} independent expenditures affecting this candidate total ${money(context.independentExpenditures.totalAmount)} across ${context.independentExpenditures.transactionCount.toLocaleString('en-US')} records (${money(context.independentExpenditures.forAmount)} supporting; ${money(context.independentExpenditures.againstAmount)} opposing).`,
      publishedAt: context.independentExpenditures.latestDate ? `${context.independentExpenditures.latestDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official' as const,
      relevance: 'low' as const,
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
      },
    }] : []);

    const contributionResult = await persistDurableEvidence({
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
      },
    }, contributionDrafts);
    const independentResult = await persistDurableEvidence({
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
      },
    }, independentDrafts);

    const inserted = contributionResult.inserted + independentResult.inserted;
    const reused = contributionResult.reused + independentResult.reused;
    const result = {
      currentMemberships: memberships.rows.length,
      resolvedWithActivityMemberships: resolvedWithActivity.length,
      resolvedWithoutActivityMemberships: resolvedWithoutActivity.length,
      notInActivitySnapshotMemberships: notInActivitySnapshot.length,
      ambiguousMemberships: ambiguous.length,
      matchedMemberships: resolvedWithActivity.length + resolvedWithoutActivity.length,
      unmatchedMemberships: notInActivitySnapshot.length + ambiguous.length,
      contributionEvidence: contributionDrafts.length,
      independentExpenditureEvidence: independentDrafts.length,
      evidenceInserted: inserted,
      evidenceReused: reused,
    };
    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete', finished_at=now(), source_documents=2, unresolved_members=$2,
             metadata=metadata || $3::jsonb
       WHERE id=$1::uuid`, [runId, ambiguous.length, JSON.stringify(result)]);
    console.log(JSON.stringify({ runId, ...result }));
  } catch (error) {
    const message = safeErrorText(error);
    await pool.query(`UPDATE ingestion_runs SET status='failed', finished_at=now(), error_summary=$2 WHERE id=$1::uuid`, [runId, message.slice(0, 2000)]).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safeErrorText(error));
  process.exitCode = 1;
});
