/**
 * Capture official Minnesota Senate district election results without audits.
 *
 * npm run data:senate:elections -- --year 2022
 * npm run data:senate:elections -- --all --dry-run --out mn-senate-raw.jsonl
 * npm run data:senate:elections -- --year 2025 --no-primaries
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import {
  fetchSenateElection, senateElectionsForYear,
} from '../src/sources/minnesota/senate-election-results.js';
import {storeSenateElectionDownload} from '../src/operations/senate-election-ingest.js';

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
            try { matched = await storeSenateElectionDownload(client, raw); }
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
