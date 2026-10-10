/**
 * #864: offline-only, no network or database usage.
 * node --import tsx scripts/audit-campaign-issue-platforms-offline.ts \
 *   --roster roster.jsonl --sites sites.jsonl --captures captures.jsonl \
 *   --statements statements.jsonl [--discoveries discoveries.jsonl] --output audit.json
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  auditSenateCampaignIssuePlatforms,
  type CampaignMembership,
  type CampaignSiteRecord,
  type CampaignArchiveCapture,
  type CampaignIssueStatement,
  type ArchiveDiscoveryRun,
} from '../src/evidence/campaign-issue-platform-audit.js';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_RECORDS = 50_000;
const args = process.argv.slice(2);
function flag(name: string, required = true): string | undefined {
  const index = args.indexOf(name);
  const inline = args.find(x => x.startsWith(name + '='));
  const value = index >= 0 ? args[index + 1] : inline?.slice(name.length + 1);
  if ((!value || value.startsWith('--')) && required) throw new Error('Missing ' + name);
  return value && !value.startsWith('--') ? value : undefined;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function readJsonl(path: string): Record<string, unknown>[] {
  const file = resolve(path);
  if (statSync(file).size > MAX_BYTES) throw new Error('JSONL input exceeds 64 MiB limit');
  const records: Record<string, unknown>[] = [];
  for (const [lineNo, line] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    if (records.length >= MAX_RECORDS) throw new Error('JSONL input exceeds 50,000 records');
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new Error(file + ':' + (lineNo + 1) + ' invalid JSON'); }
    if (!object(value)) throw new Error(file + ':' + (lineNo + 1) + ' expected object');
    records.push(value);
  }
  return records;
}
function requiredString(record: Record<string, unknown>, key: string): string {
  if (typeof record[key] !== 'string') throw new Error('Missing string field: ' + key);
  return record[key] as string;
}
function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value !== null && value !== undefined && typeof value !== 'string') throw new Error('Invalid optional string: ' + key);
  return typeof value === 'string' ? value : null;
}
function campaignYear(record: Record<string, unknown>): number | null {
  const year = record.campaignYear;
  if (year === null || year === undefined) return null;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 2026) throw new Error('Invalid campaignYear');
  return year as number;
}
function choice<T extends string>(record: Record<string, unknown>, key: string, values: readonly T[]): T {
  const value = requiredString(record, key);
  if (!values.includes(value as T)) throw new Error('Invalid ' + key + ': ' + value);
  return value as T;
}
function member(r: Record<string, unknown>): CampaignMembership {
  return { membershipId: requiredString(r, 'membershipId'), senatorName: requiredString(r, 'senatorName'),
    sessionSlug: choice(r, 'sessionSlug', ['2021-2022', '2023-2024', '2025-2026']) };
}
function site(r: Record<string, unknown>): CampaignSiteRecord {
  return { membershipId: requiredString(r, 'membershipId'), campaignYear: campaignYear(r), url: requiredString(r, 'url'),
    status: choice(r, 'status', ['documented', 'unavailable', 'unverified']), registrySourceUrl: optionalString(r, 'registrySourceUrl') };
}
function capture(r: Record<string, unknown>): CampaignArchiveCapture {
  if (typeof r.selectedByV3 !== 'boolean') throw new Error('selectedByV3 must be boolean');
  return { membershipId: requiredString(r, 'membershipId'), campaignYear: campaignYear(r),
    originalUrl: requiredString(r, 'originalUrl'), archiveUrl: requiredString(r, 'archiveUrl'),
    capturedAt: requiredString(r, 'capturedAt'), archiveDigest: optionalString(r, 'archiveDigest'),
    selectedByV3: r.selectedByV3, snapshotStatus: choice(r, 'snapshotStatus', ['fetched', 'failed', 'not_selected']),
    contentSha256: optionalString(r, 'contentSha256'), pageText: optionalString(r, 'pageText'),
    pageTextSha256: optionalString(r, 'pageTextSha256'),
    pageType: choice(r, 'pageType', ['issue', 'platform', 'policy', 'other', 'unknown']),
    originalPostedOn: optionalString(r, 'originalPostedOn') };
}
function statement(r: Record<string, unknown>): CampaignIssueStatement {
  return { membershipId: requiredString(r, 'membershipId'), archiveUrl: requiredString(r, 'archiveUrl'),
    policyFamily: requiredString(r, 'policyFamily'), excerpt: requiredString(r, 'excerpt'),
    attribution: choice(r, 'attribution', ['candidate', 'third_party', 'ambiguous']),
    stance: choice(r, 'stance', ['supports', 'opposes', 'unclear']) };
}
function discovery(r: Record<string, unknown>): ArchiveDiscoveryRun {
  if (!Number.isInteger(r.requestedLimit) || Number(r.requestedLimit) < 1 || Number(r.requestedLimit) > 2000
    || !Number.isInteger(r.returnedCount) || Number(r.returnedCount) < 0) throw new Error('Invalid CDX discovery counts');
  return { membershipId: requiredString(r, 'membershipId'), seedUrl: requiredString(r, 'seedUrl'),
    requestedLimit: Number(r.requestedLimit), returnedCount: Number(r.returnedCount),
    status: choice(r, 'status', ['complete', 'failed']) };
}
function main() {
  const roster = readJsonl(flag('--roster')!).map(member);
  const sites = readJsonl(flag('--sites')!).map(site);
  const captures = readJsonl(flag('--captures')!).map(capture);
  const statements = readJsonl(flag('--statements')!).map(statement);
  const discoveryPath = flag('--discoveries', false);
  const outputPath = flag('--output')!;
  const discoveries = discoveryPath ? readJsonl(discoveryPath).map(discovery) : undefined;
  const report = auditSenateCampaignIssuePlatforms({ roster, sites, captures, statements, discoveries });
  const output = resolve(outputPath);
  const inputPaths = [flag('--roster')!, flag('--sites')!, flag('--captures')!, flag('--statements')!, discoveryPath]
    .filter((x): x is string => Boolean(x)).map(path => resolve(path));
  if (inputPaths.includes(output)) throw new Error('Refusing to overwrite an input export');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ output, totals: report.totals, reconciliationCertified: false }, null, 2));
}
main();
