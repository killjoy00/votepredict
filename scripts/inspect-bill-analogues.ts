import { Pool } from 'pg';
import { extractDeterministicBillFeatures, retrieveHistoricalAnalogues, type BillFeatureIdentity, type HistoricalAnalogueCandidate } from '../src/features/bills.js';
import { historicalBillIdentityTitle } from '../src/evaluation/historical-quick-replay.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const session = argumentValue(args, '--session');
  const identifier = argumentValue(args, '--bill')?.replace(/\s+/g, '').toUpperCase();
  const asOf = argumentValue(args, '--as-of') ?? new Date().toISOString();
  if (!session || !identifier) throw new Error('--session and --bill are required');
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const targetResult = await pool.query<{
      bill_id: string; bill_version_id: string; identifier: string; session_slug: string;
      published_at: string; raw_text: string; companion_identifier: string | null;
    }>(`
      SELECT b.id AS bill_id, bv.id AS bill_version_id, b.identifier, s.slug AS session_slug,
             bv.published_at::text, bv.raw_text, companion.companion_identifier
        FROM bills b
        JOIN legislative_sessions s ON s.id=b.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        JOIN LATERAL (
          SELECT * FROM bill_versions x
           WHERE x.bill_id=b.id
             AND x.published_at IS NOT NULL
             AND x.published_at::date < $3::timestamptz::date
           ORDER BY x.published_at DESC,x.created_at DESC,x.id DESC
           LIMIT 1
        ) bv ON true
        LEFT JOIN LATERAL (
          SELECT candidate.identifier AS companion_identifier
            FROM legislative_stage_events lse
            CROSS JOIN LATERAL jsonb_array_elements_text(
              COALESCE(lse.metadata->'companionIdentifiers','[]'::jsonb)
            ) candidate(identifier)
           WHERE lse.bill_id=b.id
             AND lse.stage_kind='companion_reference'
             AND lse.occurred_at::date < $3::timestamptz::date
             AND lse.metadata->>'modelEligibility'='strictly before target vote date only'
           ORDER BY lse.occurred_at DESC,lse.id DESC,candidate.identifier
           LIMIT 1
        ) companion ON true
       WHERE s.slug=$1 AND upper(replace(b.identifier,' ',''))=$2`, [session, identifier, asOf]);
    const row = targetResult.rows[0];
    if (!row) throw new Error(`No dated bill version available for ${session} ${identifier} as of ${asOf}`);
    const target: BillFeatureIdentity = {
      billId: row.bill_id, billVersionId: row.bill_version_id, identifier: row.identifier, session: row.session_slug,
      title: historicalBillIdentityTitle(row.raw_text, row.identifier),
      publishedAt: row.published_at,
      companionIdentifier: row.companion_identifier ?? undefined,
      features: extractDeterministicBillFeatures({
        title: historicalBillIdentityTitle(row.raw_text, row.identifier),
        text: row.raw_text,
      }),
    };

    const candidatesResult = await pool.query<{
      vote_event_id: string; bill_id: string; bill_version_id: string; identifier: string; session_slug: string;
      published_at: string; raw_text: string; companion_identifier: string | null;
      occurred_at: string; chamber: string; yea_count: number; nay_count: number; passed: boolean | null;
    }>(`
      SELECT ve.id AS vote_event_id, b.id AS bill_id, bv.id AS bill_version_id, b.identifier,
             s.slug AS session_slug, bv.published_at::text, bv.raw_text,
             companion.companion_identifier,
             ve.occurred_on::text || 'T23:59:59Z' AS occurred_at, c.slug AS chamber,
             ve.yea_count, ve.nay_count, ve.passed
        FROM vote_events ve
        JOIN bills b ON b.id=ve.bill_id
        JOIN legislative_sessions s ON s.id=ve.session_id
        JOIN chambers c ON c.id=ve.chamber_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        JOIN LATERAL (
          SELECT * FROM bill_versions x
           WHERE x.bill_id=b.id
             AND x.published_at IS NOT NULL
             AND x.published_at::date <= ve.occurred_on
           ORDER BY x.published_at DESC,x.created_at DESC,x.id DESC
           LIMIT 1
        ) bv ON true
        LEFT JOIN LATERAL (
          SELECT candidate.identifier AS companion_identifier
            FROM legislative_stage_events lse
            CROSS JOIN LATERAL jsonb_array_elements_text(
              COALESCE(lse.metadata->'companionIdentifiers','[]'::jsonb)
            ) candidate(identifier)
           WHERE lse.bill_id=b.id
             AND lse.stage_kind='companion_reference'
             AND lse.occurred_at::date < ve.occurred_on
             AND lse.metadata->>'modelEligibility'='strictly before target vote date only'
           ORDER BY lse.occurred_at DESC,lse.id DESC,candidate.identifier
           LIMIT 1
        ) companion ON true
       WHERE ve.is_passage=true AND ve.occurred_on < $1::date`, [asOf]);
    const candidates: HistoricalAnalogueCandidate[] = candidatesResult.rows.map((candidate) => ({
      voteEventId: candidate.vote_event_id,
      billId: candidate.bill_id,
      billVersionId: candidate.bill_version_id,
      identifier: candidate.identifier,
      session: candidate.session_slug,
      title: historicalBillIdentityTitle(candidate.raw_text, candidate.identifier),
      publishedAt: candidate.published_at,
      companionIdentifier: candidate.companion_identifier ?? undefined,
      occurredAt: candidate.occurred_at,
      chamber: candidate.chamber,
      yeaCount: Number(candidate.yea_count),
      nayCount: Number(candidate.nay_count),
      passed: candidate.passed,
      features: extractDeterministicBillFeatures({
        title: historicalBillIdentityTitle(candidate.raw_text, candidate.identifier),
        text: candidate.raw_text,
      }),
    }));
    const results = retrieveHistoricalAnalogues(target, candidates, asOf, { limit: 15 });
    console.log(JSON.stringify({ target: { session, identifier, asOf, versionPublishedAt: target.publishedAt }, analogues: results.map((result) => ({
      score: result.score,
      similarity: result.similarity,
      recencyWeight: result.recencyWeight,
      relationship: result.relationship,
      reasons: result.reasons,
      bill: `${result.candidate.session} ${result.candidate.identifier}`,
      chamber: result.candidate.chamber,
      occurredAt: result.candidate.occurredAt,
      vote: `${result.candidate.yeaCount}-${result.candidate.nayCount}`,
      passed: result.candidate.passed,
    })) }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
