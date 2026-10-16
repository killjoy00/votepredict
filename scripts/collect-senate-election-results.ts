/**
 * Capture official Minnesota Senate district election results without audits.
 *
 * npm run data:senate:elections -- --year 2022
 * npm run data:senate:elections -- --all --dry-run --out mn-senate-raw.jsonl
 * npm run data:senate:elections -- --year 2025 --no-primaries
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { normalizeMemberName } from '../src/sources/minnesota/house-votes.js';
import {
  fetchSenateElection, senateElectionsForYear,
  type SenateElectionDownload, type SenateElectionEvent,
} from '../src/sources/minnesota/senate-election-results.js';

interface Options {
  years: number[];
  includePrimaries: boolean;
  dryRun: boolean;
  out?: string;
}
function readOption(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
function parseOptions(): Options {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const rawYear = readOption(args, '--year');
  if (all === Boolean(rawYear)) throw new Error('Supply exactly one of --year YYYY or --all');
  const currentYear = new Date().getUTCFullYear();
  const year = rawYear ? Number(rawYear) : 0;
  if (!all && (!Number.isInteger(year) || year < 2016 || year > currentYear)) {
    throw new Error('--year must be an integer from 2016 through the current year');
  }
  return {
    years: all ? Array.from({ length: currentYear - 2015 }, (_unused, index) => 2016 + index) : [year],
    includePrimaries: !args.includes('--no-primaries'),
    dryRun: args.includes('--dry-run'),
    out: readOption(args, '--out'),
  };
}

// Even-year November elections elect members for the NEXT biennium.
// Other special elections fill the CURRENT biennium.
function electedServiceSession(event: SenateElectionEvent): string {
  const year = Number(event.date.slice(0, 4));
  const month = Number(event.date.slice(5, 7));
  const starts = year % 2 === 0 && month >= 11 ? year + 1
    : year % 2 === 0 ? year - 1 : year;
  return String(starts) + '-' + String(starts + 1);
}
interface SenatorMembership {
  id: string;
  district: string;
  name: string;
  aliases: string[];
}

/** Only a unique exact normalized district + name/alias match is linked. */
async function memberLinks(client: PoolClient, event: SenateElectionEvent): Promise<Map<string, string>> {
  const result = await client.query<SenatorMembership>([
    'SELECT m.id, m.district, l.name,',
    "COALESCE(array_agg(a.source_name) FILTER (WHERE a.source_name IS NOT NULL), ARRAY[]::text[]) AS aliases",
    'FROM memberships m',
    'JOIN legislative_sessions s ON s.id=m.session_id',
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'",
    'JOIN legislators l ON l.id=m.legislator_id',
    'LEFT JOIN membership_source_aliases a ON a.membership_id=m.id',
    'WHERE s.slug=$1 GROUP BY m.id,m.district,l.name',
  ].join(' '), [electedServiceSession(event)]);
  const possible = new Map<string, Set<string>>();
  for (const member of result.rows) {
    for (const name of [member.name, ...member.aliases]) {
      const key = member.district + '|' + normalizeMemberName(name);
      const ids = possible.get(key) ?? new Set<string>();
      ids.add(member.id);
      possible.set(key, ids);
    }
  }
  const unique = new Map<string, string>();
  for (const [key, ids] of possible) if (ids.size === 1) unique.set(key, [...ids][0]);
  return unique;
}

async function storeDownload(client: PoolClient, download: SenateElectionDownload): Promise<number> {
  const { event } = download;
  await client.query('BEGIN');
  try {
    const source = await client.query<{ id: string }>([
      'INSERT INTO mn_senate_election_source_snapshots',
      '(election_date,election_type,post_2022_redistricting,source_url,source_index_url,source_kind,original_observed_on,',
      'fetched_at,content_type,content_sha256,raw_content,raw_bytes_base64)',
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      'ON CONFLICT (election_date,election_type,source_url,content_sha256)',
      'DO UPDATE SET fetched_at=EXCLUDED.fetched_at RETURNING id',
    ].join(' '), [
      event.date, event.type, download.post2022Redistricting, download.sourceUrl,
      download.indexUrl, download.sourceKind, download.originalObservedOn, download.fetchedAt,
      download.contentType, download.contentSha256, download.rawContent, download.rawBase64,
    ]);
    const sourceId = source.rows[0].id;
    const members = event.type === 'primary' || event.type === 'special_primary'
      ? new Map<string, string>() : await memberLinks(client, event);
    let matched = 0;
    for (const record of download.candidates) {
      const membershipId = record.winner
        ? members.get(record.district + '|' + normalizeMemberName(record.candidate)) ?? null : null;
      if (membershipId) matched++;
      await client.query([
        'INSERT INTO mn_senate_election_raw_results',
        '(source_snapshot_id,source_ordinal,election_date,election_type,',
        'post_2022_redistricting,district,candidate_name,party,votes,total_votes,',
        'vote_share_percent,winner,membership_id,source_url,fetched_at,raw_line)',
        'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
        'ON CONFLICT (source_snapshot_id,source_ordinal) DO UPDATE SET',
        'membership_id=EXCLUDED.membership_id,fetched_at=EXCLUDED.fetched_at',
      ].join(' '), [
        sourceId, record.sourceOrdinal, event.date, event.type, download.post2022Redistricting,
        record.district, record.candidate, record.party, record.votes,
        record.totalVotes, record.voteShare, record.winner, membershipId,
        download.sourceUrl, download.fetchedAt, record.rawLine,
      ]);
    }
    await client.query('COMMIT');
    return matched;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

interface Coverage {
  year: number;
  elections: number;
  districts: number;
  districtElections: number;
  candidateRows: number;
  generalOrSpecialElections: number;
  primaryDistricts: number;
  matchingWinnerMemberships: number;
  missing: { date: string; type: string; reason: string }[];
}
function blankCoverage(year: number): Coverage {
  return { year, elections: 0, districts: 0, districtElections: 0,
    candidateRows: 0, generalOrSpecialElections: 0, primaryDistricts: 0,
    matchingWinnerMemberships: 0, missing: [] };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!options.dryRun && !connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED / DATABASE_URL required; use --dry-run for public files');
  }
  if (options.out) writeFileSync(options.out, '');
  const pool = options.dryRun ? null : new Pool({ connectionString, max: 2 });
  const coverage: Coverage[] = [];
  try {
    for (const year of options.years) {
      const summary = blankCoverage(year);
      const districts = new Set<string>();
      for (const event of senateElectionsForYear(year, options.includePrimaries)) {
        try {
          const raw = await fetchSenateElection(event);
          const eventDistricts = new Set(raw.candidates.map((item) => item.district));
          if (options.out) appendFileSync(options.out, JSON.stringify({
            event, sourceUrl: raw.sourceUrl, sourceIndexUrl: raw.indexUrl,
            fetchedAt: raw.fetchedAt, contentType: raw.contentType,
            contentSha256: raw.contentSha256, rawBase64: raw.rawBase64,
            post2022Redistricting: raw.post2022Redistricting,
            sourceKind:raw.sourceKind,originalObservedOn:raw.originalObservedOn,
            candidates: raw.candidates,
          }) + '\n');
          let matched = 0;
          if (pool) {
            const client = await pool.connect();
            try { matched = await storeDownload(client, raw); }
            finally { client.release(); }
          }
          for (const district of eventDistricts) districts.add(district);
          summary.elections++;
          summary.districtElections += eventDistricts.size;
          summary.candidateRows += raw.candidates.length;
          summary.matchingWinnerMemberships += matched;
          if (event.type === 'general' || event.type === 'special') {
            summary.generalOrSpecialElections += eventDistricts.size;
          } else {
            summary.primaryDistricts += eventDistricts.size;
          }
          console.log(JSON.stringify({
            status: 'collected', year, electionDate: event.date, type: event.type,
            map: raw.post2022Redistricting ? 'post-2022' : 'pre-2022',
            districts: eventDistricts.size, candidates: raw.candidates.length,
            matchedMemberships: matched, sourceUrl: raw.sourceUrl,sourceKind:raw.sourceKind,
          }));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          summary.missing.push({ date: event.date, type: event.type, reason });
          console.warn(JSON.stringify({ status: 'not_collected', year,
            electionDate: event.date, type: event.type, reason }));
        }
      }
      summary.districts = districts.size;
      coverage.push(summary);
    }
  } finally { await pool?.end(); }
  console.log(JSON.stringify({ mode: options.dryRun ? 'raw-file' : 'database',
    includePrimaries: options.includePrimaries, byYear: coverage }, null, 2));
  // A missing optional primary does not obscure incomplete required elections.
  if (coverage.some((year) => year.missing.some((miss) =>
    miss.type === 'general' || miss.type === 'special'))) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
