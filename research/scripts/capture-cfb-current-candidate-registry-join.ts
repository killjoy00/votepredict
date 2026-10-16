/**
 * Issue #864. One-time public 2026 candidate registration-status source capture.
 * NO historical legal denominator, report PDF, donor data or production DB.
 *
 * node --import tsx scripts/capture-cfb-current-candidate-registry-join.ts \
 *    --output artifacts/cfb-current-candidate-registry-join.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  auditCfbCurrentCandidateRegistryAgainstSenateViewer,
  parseCfbCandidateRegistryGrid,
  type CfbCandidateRegistryListAction,
  type CfbCandidateRegistrySource,
  type CfbObservedViewerRegistrationCheckpoint,
} from '../../src/evidence/cfb-current-candidate-registry-join.js';

const appUrl = 'https://register.cfb.mn.gov/reports/current-lists/';
const apiUrl = 'https://register.cfb.mn.gov/reports/api/';
const proofPath = 'docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
const argv = process.argv.slice(2);
const outputArg = argv.indexOf('--output');
if (outputArg !== 0 || argv.length !== 2 || !argv[1]) {
  throw Error('Required --output <metadata-only JSON file>');
}
const output = resolve(argv[1]!);
if (output === resolve(proofPath) || /\/source-proof\/.*\.json$/.test(output)) {
  throw Error('Cannot overwrite original historical source proof');
}
const agent = 'Mozilla/5.0 VotePredict/2.0 historical-cfb-current-registry-crosscheck';
function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
async function fetchOfficial(url: string, init: RequestInit={}) {
  const original = new URL(url);
  if (original.protocol !== 'https:' || original.hostname !== 'register.cfb.mn.gov') {
    throw Error('Only official CFB registered candidate source allowed');
  }
  const response = await fetch(original, {
    ...init,
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'user-agent': agent,
      ...(init.headers as Record<string,string> ?? {}),
    }
  });
  const final = new URL(response.url);
  if (final.hostname !== 'register.cfb.mn.gov' || final.protocol !== 'https:' ||
    !response.ok) throw Error('CFB source redirected or returned non-2xx');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 8_000_000 || bytes.length < 3) throw Error('Official CFB response outside size bound');
  return {response,bytes,fetchedAt:new Date().toISOString(),url:final.toString()};
}
async function main(): Promise<void> {
  const doc = JSON.parse(readFileSync(proofPath,'utf8')) as CfbObservedViewerRegistrationCheckpoint;
  const page = await fetchOfficial(appUrl);
  const headers = page.response.headers as Headers & {getSetCookie?:()=>string[]};
  const cookies = (typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie() : [headers.get('set-cookie') ?? ''].filter(Boolean))
    .map(value=>value.split(';',1)[0]?.trim()).filter(Boolean).join('; ');
  async function get(action: CfbCandidateRegistryListAction): Promise<CfbCandidateRegistrySource> {
    const body=new URLSearchParams();
    body.set('action','grid_data');
    body.set('data[action]',action);
    body.set('data[type]','current-lists');
    body.set('data[params][0]','all');
    const original=await fetchOfficial(apiUrl,{
      method:'POST',
      headers:{
        'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with':'XMLHttpRequest',
        'referer':appUrl,
        cookie:cookies,
      },body:body.toString(),
    });
    if (original.url !== apiUrl) throw Error('Unexpected official grid-data endpoint redirect');
    const raw=new TextDecoder().decode(original.bytes);
    return {
      action, apiUrl:original.url, fetchedAt:original.fetchedAt,
      responseSha256:hash(original.bytes),
      grid:parseCfbCandidateRegistryGrid(raw,action),
    };
  }
  const all=await get('all-registered-candidates');
  const terminated=await get('recent-candidate-terminations');
  const result=auditCfbCurrentCandidateRegistryAgainstSenateViewer(doc,all,terminated);
  mkdirSync(dirname(output),{recursive:true});
  // Metadata-only; no source response rows, names, contact, donor or finance data.
  writeFileSync(output, JSON.stringify({
    ...result,
    sourceRetrievedAt:new Date().toISOString(),
    status:'present-day-source-crosscheck-only',
  },null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({
    version:result.schemaVersion,
    allSourceSha256:result.source.allRegistered.responseSha256,
    allCurrentCandidateRegistrationsAllOffices:result.snapshot.candidateRegistrationsFromAllOfficesCurrentlyListed,
    currentlyListedSenateRegistrations:result.snapshot.currentListedSenateRegistrationIds,
    overlappingPreviouslyObservedSenateIds:result.snapshot.viewerIdsListedOnCurrentSource,
    viewerIdsAbsentFromCurrentPublicList:result.snapshot.viewerIdsNotListedOnCurrentSource,
    newCurrentSenateIdsNotIn268PageViewerScan:result.snapshot.currentSenateIdsAbsentFromElectionSegmentViewer,
    recentTerminationsAllOffices:result.source.recentTerminations.rows,
    previouslyObservedSenateIdsRecentlyTerminated:result.snapshot.viewerIdsInRecentTerminationListing,
    allKnownOriginalPdfControlsPresent:result.snapshot.bothKnownOriginalReportControlsInCurrentList,
    rejectedRows:result.source.allRegistered.rejectedRows+result.source.recentTerminations.rejectedRows,
    complete2021to2025RegisteredFilerOrFilingDenominator:result.historicalFinanceDenominator.fullStatewideHistoricalFilingDenominatorCertified,
    output,
  },null,2));
  if (result.snapshot.sourceContainsInvalidRows ||
    !result.snapshot.bothKnownOriginalReportControlsInCurrentList ||
    result.snapshot.currentListedSenateRegistrationIds === 0) {
    process.exitCode=1;
  }
}
main().catch(error => {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
