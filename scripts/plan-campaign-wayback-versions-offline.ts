/**
 * Offline-only version-preserving campaign Wayback capture plan for #864.
 *
 * node --import tsx scripts/plan-campaign-wayback-versions-offline.ts \
 *    --cdx /path/to/exported-cdx.json --output /path/to/plan.json --max-captures 40
 *
 * Reads a PREVIOUSLY EXPORTED Wayback CDX JSON matrix. Never fetches the web or
 * connects to a database; makes no changes to the historical backfill cursor.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseWaybackCdxJson } from '../src/evidence/wayback.js';
import { selectWaybackEvidenceCaptures } from '../src/evidence/wayback-public-evidence-backfill.js';
import { planWaybackCampaignVersionCaptures } from '../src/evidence/wayback-campaign-version-plan.js';

function option(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return (i >= 0 ? args[i + 1] : args.find(a => a.startsWith(name + '='))?.slice(name.length + 1));
}
function main() {
  const inputArg = option('--cdx'), outputArg = option('--output');
  if (!inputArg || !outputArg || inputArg.startsWith('--') || outputArg.startsWith('--')) throw new Error('Provide --cdx and --output');
  const source = resolve(inputArg), target = resolve(outputArg);
  if (source === target) throw new Error('Refusing to overwrite the source CDX manifest');
  if (statSync(source).size > 16 * 1024 * 1024) throw new Error('CDX manifest exceeds offline 16 MiB cap');
  const parsed = JSON.parse(readFileSync(source, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length > 2001) throw new Error('Expected bounded CDX JSON rows');
  const maxArg = option('--max-captures');
  if (maxArg && (!/^\d+$/.test(maxArg) || +maxArg < 1 || +maxArg > 50)) throw new Error('--max-captures must be 1-50');
  const maxCaptures = maxArg ? Number(maxArg) : 40;
  const captures = parseWaybackCdxJson(parsed);
  const v3 = selectWaybackEvidenceCaptures(captures, { maxCaptures });
  const planned = planWaybackCampaignVersionCaptures(captures, { maxCaptures });
  const v3UrlSet = new Set(v3.map(c => c.archiveUrl));
  const versionCandidatesBeyondV3 = planned.selectedCaptures
    .filter(c => !v3UrlSet.has(c.archiveUrl))
    .map(c => ({ originalUrl: c.original, archiveUrl: c.archiveUrl, capturedAt: c.capturedAt, digest: c.digest }));
  const output = {
    ...planned,
    oldV3SelectionCount: v3.length,
    selectedNotInV3: versionCandidatesBeyondV3,
    inputCdxRows: parsed.length - 1,
    upstreamCdxResultTruncated: null,
    upstreamMissingDomainsOrPaths: null,
    sourceBytesAuthenticated: false,
    anyCampaignStatementAuthenticated: false,
  };
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(output, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ output: target, selected: planned.selectedCaptures.length,
    missingDueToSelectionCap: planned.unselectedDistinctVersions, additionalOverV3: versionCandidatesBeyondV3.length,
    completenessCertified: false }, null, 2));
}
main();
