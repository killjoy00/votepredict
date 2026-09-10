import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

type RankedAmount = { name: string; amount: number; count: number; type?: string; employer?: string; direction?: string };
type CandidateSnapshot = {
  committeeName: string;
  candidateName: string;
  chamber: string;
  registrationNumber?: string;
  matchKey: string;
  lastNameKey: string;
  contributions: {
    transactionCount: number;
    totalAmount: number;
    latestReceiptDate?: string;
    topContributors: RankedAmount[];
    byContributorType: RankedAmount[];
    topEmployers: RankedAmount[];
  };
  independentExpenditures: {
    transactionCount: number;
    totalAmount: number;
    forAmount: number;
    againstAmount: number;
    latestDate?: string;
    topSpenders: RankedAmount[];
  };
};
type CampaignFinanceSnapshot = {
  schemaVersion: string;
  generatedAt: string;
  cycleYears: number[];
  provenance: {
    landingPage: string;
    contributions: { url: string; contentSha256: string; cycleRows: number; bytes?: number };
    independentExpenditures: { url: string; contentSha256: string; cycleRows: number; bytes?: number };
  };
  candidates: CandidateSnapshot[];
};
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

function normalizeToken(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const ignoredNameTokens = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'hon', 'rep', 'sen', 'representative', 'senator']);
function memberIdentity(name: string): { matchKey?: string; lastNameKey?: string } {
  const tokens = name.split(/\s+/).map(normalizeToken).filter((token) => token && !ignoredNameTokens.has(token));
  if (tokens.length === 0) return {};
  const lastNameKey = tokens[tokens.length - 1];
  const first = tokens.find((token) => token.length > 1) ?? tokens[0];
  return { matchKey: first && lastNameKey ? `${first}|${lastNameKey}` : undefined, lastNameKey };
}

function findCandidate(snapshot: CampaignFinanceSnapshot, membership: MembershipRow): CandidateSnapshot | undefined {
  const identity = memberIdentity(membership.name);
  const chamberCandidates = snapshot.candidates.filter((candidate) => candidate.chamber === membership.chamber_slug.toLowerCase());
  if (identity.matchKey) {
    const exact = chamberCandidates.find((candidate) => candidate.matchKey === identity.matchKey);
    if (exact) return exact;
  }
  if (!identity.lastNameKey) return undefined;
  const lastNameMatches = chamberCandidates.filter((candidate) => candidate.lastNameKey === identity.lastNameKey);
  return lastNameMatches.length === 1 ? lastNameMatches[0] : undefined;
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

    const matches = memberships.rows.flatMap((membership) => {
      const candidate = findCandidate(snapshot, membership);
      return candidate ? [{ membership, candidate }] : [];
    });
    const contributionDrafts = matches.flatMap(({ membership, candidate }) => candidate.contributions.transactionCount > 0 ? [{
      target: { membershipId: membership.membership_id },
      kind: 'context' as const,
      stance: 'neutral' as const,
      claim: `${snapshot.cycleYears.join('-')} campaign committee receipts total ${money(candidate.contributions.totalAmount)} across ${candidate.contributions.transactionCount.toLocaleString('en-US')} itemized records.`,
      publishedAt: candidate.contributions.latestReceiptDate ? `${candidate.contributions.latestReceiptDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official' as const,
      relevance: 'low' as const,
      freshness: freshness(candidate.contributions.latestReceiptDate),
      extractionMethod: 'deterministic-cfb-bulk-aggregate',
      extractionVersion: snapshot.schemaVersion,
      confidence: 1,
      metadata: {
        contextType: 'campaign_finance',
        subtype: 'candidate_contributions',
        contextOnly: true,
        mechanicallyActionable: false,
        committeeName: candidate.committeeName,
        candidateName: candidate.candidateName,
        registrationNumber: candidate.registrationNumber,
        cycleYears: snapshot.cycleYears,
        totalAmount: candidate.contributions.totalAmount,
        transactionCount: candidate.contributions.transactionCount,
        latestReceiptDate: candidate.contributions.latestReceiptDate,
        topContributors: candidate.contributions.topContributors,
        byContributorType: candidate.contributions.byContributorType,
        topEmployers: candidate.contributions.topEmployers,
      },
    }] : []);
    const independentDrafts = matches.flatMap(({ membership, candidate }) => candidate.independentExpenditures.transactionCount > 0 ? [{
      target: { membershipId: membership.membership_id },
      kind: 'context' as const,
      stance: 'neutral' as const,
      claim: `${snapshot.cycleYears.join('-')} independent expenditures affecting this candidate total ${money(candidate.independentExpenditures.totalAmount)} across ${candidate.independentExpenditures.transactionCount.toLocaleString('en-US')} records (${money(candidate.independentExpenditures.forAmount)} supporting; ${money(candidate.independentExpenditures.againstAmount)} opposing).`,
      publishedAt: candidate.independentExpenditures.latestDate ? `${candidate.independentExpenditures.latestDate}T00:00:00.000Z` : undefined,
      sourceQuality: 'official' as const,
      relevance: 'low' as const,
      freshness: freshness(candidate.independentExpenditures.latestDate),
      extractionMethod: 'deterministic-cfb-bulk-aggregate',
      extractionVersion: snapshot.schemaVersion,
      confidence: 1,
      metadata: {
        contextType: 'campaign_finance',
        subtype: 'independent_expenditures',
        contextOnly: true,
        mechanicallyActionable: false,
        committeeName: candidate.committeeName,
        candidateName: candidate.candidateName,
        registrationNumber: candidate.registrationNumber,
        cycleYears: snapshot.cycleYears,
        totalAmount: candidate.independentExpenditures.totalAmount,
        transactionCount: candidate.independentExpenditures.transactionCount,
        forAmount: candidate.independentExpenditures.forAmount,
        againstAmount: candidate.independentExpenditures.againstAmount,
        latestDate: candidate.independentExpenditures.latestDate,
        topSpenders: candidate.independentExpenditures.topSpenders,
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
    const unmatched = memberships.rows.length - matches.length;
    await pool.query(`
      UPDATE ingestion_runs
         SET status='complete', finished_at=now(), source_documents=2, unresolved_members=$2,
             metadata=metadata || $3::jsonb
       WHERE id=$1::uuid`, [
      runId,
      unmatched,
      JSON.stringify({
        currentMemberships: memberships.rows.length,
        matchedMemberships: matches.length,
        contributionEvidence: contributionDrafts.length,
        independentExpenditureEvidence: independentDrafts.length,
        evidenceInserted: inserted,
        evidenceReused: reused,
      }),
    ]);
    console.log(JSON.stringify({
      runId,
      currentMemberships: memberships.rows.length,
      matchedMemberships: matches.length,
      unmatchedMemberships: unmatched,
      contributionEvidence: contributionDrafts.length,
      independentExpenditureEvidence: independentDrafts.length,
      inserted,
      reused,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(`UPDATE ingestion_runs SET status='failed', finished_at=now(), error_summary=$2 WHERE id=$1::uuid`, [runId, message.slice(0, 2000)]).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
