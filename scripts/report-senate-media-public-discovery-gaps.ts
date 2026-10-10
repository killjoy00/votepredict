/**
 * #946 PUBLIC URL-only collector path audit. No Neon, SQL, HTTP, source
 * article bytes, senator quotation adjudication, artifact upload or writes.
 *
 * Usage: node --import tsx scripts/report-senate-media-public-discovery-gaps.ts
 */
import {readFileSync} from 'node:fs';
import {diagnoseMediaPublicDiscoveryPaths} from '../src/evidence/senate-media-public-discovery-gaps.js';

function main():void {
  if(process.argv.length!==2)
    throw Error('Public media discovery path audit accepts no arguments');
  const text=readFileSync(
    'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8',
  );
  if(text.length>500_000)
    throw Error('Public media discovery lead ledger exceeds bounded size');
  const parsed=JSON.parse(text) as Record<string,unknown>;
  if(parsed.version!=='senate-media-public-discovery-leads-v1'
    || !Array.isArray(parsed.selectedNonExhaustiveArticleLeads)
    || parsed.sourceUniverseCompletenessKnown!==false)
    throw Error('Unexpected public discovery lead ledger version/scope');
  const report=diagnoseMediaPublicDiscoveryPaths(parsed.selectedNonExhaustiveArticleLeads);
  // Deliberately print public IDs and aggregates, never raw source article
  // text, senator quotes, connected DB records, or private source identifiers.
  console.log(JSON.stringify({
    version:report.version,
    studyYears:[2021,2022,2023,2024,2025],
    sampleSizeOnly:report.totalCuratedPublicUrlLeads,
    outsideCurrentSeedPrefix:report.urlLeadsOutsideConfiguredSeedPrefix,
    excludedByPathPriority:report.urlLeadsFilteredByTopicalPathPriority,
    excludedByEitherGate:report.urlLeadsExcludedByEitherGate,
    excludedByBothGates:report.urlLeadsExcludedByBothGates,
    seedPrefixBlindSpotLeadIds:report.leads
      .filter(x=>!x.currentSeedPrefixWouldIncludeUrl).map(x=>x.id),
    topicalPathBlindSpotLeadIds:report.leads
      .filter(x=>!x.currentPathPriorityWouldSelectUrl).map(x=>x.id),
    candidateAliasPairs:report.possibleAliasPairs,
    originalWaybackCaptureVerified:false,
    fullPublisherArticleDenominatorKnown:false,
    productionDbOrSourceBodiesAccessed:false,
    reviewedSenatorQuotes:0,
  },null,2));
}
if(process.argv[1]?.endsWith('/report-senate-media-public-discovery-gaps.ts'))
  main();
