import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  cfbCandidateFinanceTargetBatchNames,
  resolveCfbCandidateFinanceTargetBatch,
} from '../src/evidence/cfb-candidate-finance-target-batches.js';
import {
  parseCfbCandidateContributionCsv,
  parseCfbCandidateExpenditureCsv,
  sessionForCandidateFinanceYear,
} from '../src/evidence/cfb-candidate-finance-history.js';
import { cfbCandidateSegmentEndYear } from '../src/evidence/cfb-candidate-report-history.js';
import {
  discoverCampaignFinanceDownloadUrls,
  fetchCampaignFinanceBulkText,
} from '../src/evidence/campaign-finance-live.js';
import { resolveCandidateFinanceMembership } from '../src/evidence/cfb-candidate-membership-resolution.js';

export {};

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL = 'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) {
    console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  }
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

async function main() {
  const envFile = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envFile) throw new Error('Production env file required');
  const env = parseRuntimeEnvironment(readFileSync(envFile, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);

  process.env.DATABASE_URL = await chooseDb(env);
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool } = await import('../src/lib/db/index.js');
  try {
    const urls = await discoverCampaignFinanceDownloadUrls();
    const [contributionText, expenditureText] = await Promise.all([
      fetchCampaignFinanceBulkText(urls.contributions),
      fetchCampaignFinanceBulkText(urls.expenditures),
    ]);
    const rows = [
      ...parseCfbCandidateContributionCsv(contributionText, { fromYear: 2021, toYear: 2026 }),
      ...parseCfbCandidateExpenditureCsv(expenditureText, { fromYear: 2021, toYear: 2026 }),
    ].filter(row => Boolean(
      row.candidateName
      && row.chamber
      && row.filerRegistrationNumber
      && row.transactionDate
      && cfbCandidateSegmentEndYear(row.year) !== null
    ));

    type MembershipCandidate = {
      membershipId: string;
      memberName: string;
      sessionSlug: string;
      chamberSlug: string;
      membershipStartsOn: string | null;
      membershipEndsOn: string | null;
      sessionStartsOn: string | null;
      sessionEndsOn: string | null;
    };
    const membershipRows = await pool.query<MembershipCandidate>(`
      SELECT m.id::text AS "membershipId",
             l.name AS "memberName",
             s.slug AS "sessionSlug",
             c.slug AS "chamberSlug",
             m.starts_on::text AS "membershipStartsOn",
             m.ends_on::text AS "membershipEndsOn",
             s.starts_on::text AS "sessionStartsOn",
             s.ends_on::text AS "sessionEndsOn"
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND c.slug IN ('house','senate')
    `);

    const reviewedTargetKeys = new Set<string>();
    for (const name of cfbCandidateFinanceTargetBatchNames()) {
      for (const target of resolveCfbCandidateFinanceTargetBatch('batch=' + name).targets) {
        reviewedTargetKeys.add(target.registrationNumber + ':' + target.segmentEndYear);
      }
    }

    type Group = {
      registrationNumber: string;
      segmentEndYear: number;
      candidateName: string;
      chamber: string;
      totalRows: number;
      contributionRows: number;
      expenditureRows: number;
      resolvedRows: number;
      resolvedMembershipIds: Set<string>;
      resolvedMemberNames: Set<string>;
      reviewedTarget: boolean;
    };
    const groups = new Map<string, Group>();
    let resolvedMembershipRows = 0;
    let resolvedRowsInReviewedTargets = 0;

    for (const row of rows) {
      const registrationNumber = row.filerRegistrationNumber!;
      const segmentEndYear = cfbCandidateSegmentEndYear(row.year)!;
      const key = registrationNumber + ':' + segmentEndYear;
      let group = groups.get(key);
      if (!group) {
        group = {
          registrationNumber,
          segmentEndYear,
          candidateName: row.candidateName!,
          chamber: row.chamber!,
          totalRows: 0,
          contributionRows: 0,
          expenditureRows: 0,
          resolvedRows: 0,
          resolvedMembershipIds: new Set<string>(),
          resolvedMemberNames: new Set<string>(),
          reviewedTarget: reviewedTargetKeys.has(key),
        };
        groups.set(key, group);
      }
      group.totalRows += 1;
      if (row.kind === 'contribution') group.contributionRows += 1;
      else group.expenditureRows += 1;

      const sessionSlug = sessionForCandidateFinanceYear(row.year);
      if (!sessionSlug) continue;
      const candidates = membershipRows.rows.filter(candidate =>
        candidate.sessionSlug === sessionSlug
        && candidate.chamberSlug === row.chamber
        && (!candidate.membershipStartsOn || candidate.membershipStartsOn <= row.transactionDate!)
        && (!candidate.membershipEndsOn || candidate.membershipEndsOn >= row.transactionDate!)
        && (!candidate.sessionStartsOn || candidate.sessionStartsOn <= row.transactionDate!)
        && (!candidate.sessionEndsOn || candidate.sessionEndsOn >= row.transactionDate!)
      );
      const membership = resolveCandidateFinanceMembership(row.candidateName!, candidates);
      if (!membership) continue;
      group.resolvedRows += 1;
      group.resolvedMembershipIds.add(membership.membershipId);
      group.resolvedMemberNames.add(membership.memberName);
      resolvedMembershipRows += 1;
      if (group.reviewedTarget) resolvedRowsInReviewedTargets += 1;
    }

    const serialized = [...groups.values()].map(group => ({
      registrationNumber: group.registrationNumber,
      segmentEndYear: group.segmentEndYear,
      candidateName: group.candidateName,
      chamber: group.chamber,
      totalRows: group.totalRows,
      contributionRows: group.contributionRows,
      expenditureRows: group.expenditureRows,
      resolvedRows: group.resolvedRows,
      unresolvedRows: group.totalRows - group.resolvedRows,
      resolvedMembershipIds: [...group.resolvedMembershipIds].sort(),
      resolvedMemberNames: [...group.resolvedMemberNames].sort(),
      reviewedTarget: group.reviewedTarget,
    }));
    const remaining = serialized
      .filter(group => !group.reviewedTarget && group.resolvedRows > 0)
      .sort((a, b) => b.resolvedRows - a.resolvedRows || b.totalRows - a.totalRows || a.registrationNumber.localeCompare(b.registrationNumber));
    const reviewed = serialized.filter(group => group.reviewedTarget);
    const resolvedRowsRemaining = remaining.reduce((sum, group) => sum + group.resolvedRows, 0);

    console.log(JSON.stringify({
      cfbCandidateFinanceCoverageAudit: {
        rowsExamined: rows.length,
        groupsExamined: serialized.length,
        membershipRowsLoaded: membershipRows.rows.length,
        reviewedTargetGroups: reviewed.length,
        resolvedMembershipRows,
        resolvedRowsInReviewedTargets,
        resolvedRowsRemaining,
        resolvedCoverageShare: resolvedMembershipRows
          ? resolvedRowsInReviewedTargets / resolvedMembershipRows
          : null,
        remainingTargetableGroups: remaining.length,
        nextTargetableGroups: remaining.slice(0, 120),
        policy: {
          readOnly: true,
          targetRankingUsesOnlyDeterministicHistoricalMembershipResolution: true,
          transactionDateIsAvailability: false,
          reportProofNotInferredByThisAudit: true,
          financeContextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
          servingChanged: false,
          productionAction: 'none',
        },
      },
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch(error => {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter(item => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]'));
  process.exitCode = 1;
});
