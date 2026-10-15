/**
 * #864 offline, SHA-bound original Minnesota Senate committee meeting ledger.
 * This uses previously authenticated public Actions artifacts; no network,
 * Neon, production DB, PDF re-download, private export or external outreach.
 *
 * node --import tsx scripts/build-senate-864-independent-committee-ledger.ts \
 *   --output-dir artifacts/senate-864-independent-committee-ledger
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPinnedOfficialSourceManifests} from
 './audit-senate-864-protected-source-db-parity.js';
import {sourceShaPinnedMerged} from
 './audit-senate-864-2025-judiciary-full-source-neon-v5.js';
import {audit141NoLinkedMinuteMeetings,type GapLedger} from
 '../src/evidence/senate-864-committee-coverage-gap-gates.js';
import {buildIndependentSenateCommitteeLedger} from
 '../src/evidence/senate-864-independent-committee-meeting-ledger.js';

const CENSUS_SHA='ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0';
const CENSUS_PATH='artifacts/senate-2021-25-official-meeting-census.json';
const GAP_PATH='docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output-dir'||!args[1]||args[1].startsWith('-'))
  throw Error('Use exactly --output-dir for local original-source-only JSON evidence');
 const output=resolve(args[1]);
 const raw=readFileSync(CENSUS_PATH);
 if(raw.byteLength>5_000_000||sha(raw)!==CENSUS_SHA)
  throw Error('Exact original LRL 1592-meeting source artifact SHA mismatch');
 const census=JSON.parse(raw.toString('utf8')) as {
  indexedMeetings:Array<{year:number;committeeName:string;committeeUrl:string;
   meetingDate:string;indexHeadingVerified:boolean;minutesPdfUrls:string[];
   electronicMinutesStatus:string}>;
  anomalies:unknown[];
  totalIndexedMeetings2022To2025:number;
  indexAcquisitionFailures:unknown[];officialIndexProofs:Array<{downloadedPageHashes:unknown[]}>;
  yearSummaries:Array<{year:number;indexedMeetings:number|null}>;
 };
 if(census.totalIndexedMeetings2022To2025!==1592
   ||census.indexAcquisitionFailures.length!==0
   ||census.officialIndexProofs.length!==4
   ||census.officialIndexProofs.reduce((n,x)=>n+x.downloadedPageHashes.length,0)!==99
   ||census.yearSummaries.filter(s=>s.year>=2022&&s.year<=2025).length!==4)
  throw Error('Authenticated original LRL electronic index year/committee provenance drift');
 // Exact 141-row compact source roster is independently reviewable in Git.
 const gap=JSON.parse(readFileSync(GAP_PATH,'utf8')) as GapLedger;
 audit141NoLinkedMinuteMeetings(gap);
 const expected=new Set(gap.meetingGroups.flatMap(g=>
  g.missingMinutesMeetingDates.map(day=>
   [g.year,g.committeeName,g.year+'-'+day].join('|'))));
 const actual=census.indexedMeetings.filter(m=>!m.minutesPdfUrls.length)
  .map(m=>[m.year,m.committeeName,m.meetingDate].join('|'));
 if(expected.size!==141||actual.length!==141||new Set(actual).size!==141
  ||actual.some(id=>!expected.has(id)))
  throw Error('Original complete 141 LRL no-Minutes rows do not match independently pinned index');
 const previous=verifyPinnedOfficialSourceManifests();
 const ocrUrls=new Set(previous.flatMap(y=>
  y.unresolvedOriginalDocuments.map(x=>x.sourceUrl)));
 if(ocrUrls.size!==207)
  throw Error('Original exactly 207 initially low-text PDF proof cohort missing');
 // The existing merger verifies every original source SHA and all 16 OCR
 // artifact SHA files plus the independently proved 2025 Judiciary roll.
 const merged=sourceShaPinnedMerged();
 const report=buildIndependentSenateCommitteeLedger(
  census,merged.years,ocrUrls,true);
 const header={
  schemaVersion:report.schemaVersion,issue:864,
  meetingCensusOriginalSha256:CENSUS_SHA,
  originalMeetingIndexRun:38065594898,
  originalPdfMetadataRun:38066441841,
  all207OcrProofsPreviouslyAuthenticated:true,
  original2025JudiciaryEightNamedChoicesIndependentSourceRun:38070395356,
  hearingDayConventionNotIndependentPdfPublication:true,
  sourceToCurrentStoredActionReconciliation:false,
  importedOrMutatedAnyProductionData:false,
 };
 const meeting={
  ...header,sourceRecordReconciliation:report.sourceRecordReconciliation,
  year2022PrintVsElectronicParity:report.year2022PrintVsElectronicParity,
  meetings:report.meetings,
 };
 const committeeYear={
  ...header,summariesByYear:report.summariesByYear,
  committeeYears:report.committeeYears,
  year2022PrintVsElectronicParity:report.year2022PrintVsElectronicParity,
  historicalAsOfConvention:report.historicalAsOfConvention,
 };
 // Safe public source metadata only. Named official source choices remain
 // one-way commitments inside authenticated input; never serialized.
 for(const data of [meeting,committeeYear]){
  const body=JSON.stringify(data);
  if(/choiceIdentitySha256|normalized_member_name|member_votes|membership_id|privateRow|donor|viewstate|api_key/i.test(body))
   throw Error('Original public-only source ledger would expose protected data');
 }
 mkdirSync(output,{recursive:true});
 writeFileSync(join(output,'1592-official-meetings-to-source-action-candidates.json'),
  JSON.stringify(meeting,null,2)+'\n');
 writeFileSync(join(output,'committee-year-completeness.json'),
  JSON.stringify(committeeYear,null,2)+'\n');
 const table=[
  '# #864 Minnesota Senate committee-year electronic source completeness',
  '',
  'Official source: Minnesota Legislative Reference Library 2022-25 Senate committee index and verified original Minutes PDF hashes.',
  '2022 print-versus-electronic Minutes parity remains UNKNOWN; only the official 2022-25 electronic index is included.',
  'The 141 electronic no-Minutes listings are documented meeting leads, not proven no-vote meetings.',
  'First-pass candidate actions below are **not** the total official action denominator or a current persisted-member-vote parity statement.',
  'The 207 recovered OCR originals have complete document/hash evidence but original OCR action metadata does not completely enumerate context-only motions.',
  'Parser v3 adds 8 independently rechecked named source candidates (2024 +5, 2025 +3); only the four extra February 14 Education amendment actions have been tied to an independent exact motion proof in this ledger.',
  'Individual source-name fingerprints remain private to the original proof artifact and no roster/person inference occurs.',
  '',
  '| Year | Committee | Indexed meetings | Minutes-linked | No linked minutes | SHA originals | OCR recovered | V2 named | V2 count-only | V2 voice | V2 unanimous | V2 result-only |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
 ];
 for(const c of report.committeeYears)
  table.push('| '+[
   c.year,c.committee.replace(/\|/g,'/'),c.indexedMeetings,c.minutesLinkedMeetings,
   c.meetingsWithoutLinkedMinutes,c.shaAuthenticatedOriginalPdfs,c.ocrRecoveredOriginalPdfs,
   c.firstPassNamedRollCandidates,c.firstPassCountOnlyRollCandidates,
   c.firstPassVoiceActions,c.firstPassUnanimousActions,c.firstPassResultOnlyActions,
  ].join(' | ')+' |');
 table.push('','## Exact source and persisted-record limits',
  'Original immutable PDF URL/byte SHA and hearing date: in the meeting ledger.',
  'Full motion text and original PDF page: usually not retained by frozen source-proof manifests (null, not invented); independent 2024 Education source catalogue has original pages and paraphrased action descriptions.',
  'Stored member-vote rows and current parser-v3 positional event join: not independently verified (null).',
  'Official recorded-motion denominator, print archive parity and historical service-date proof: not available.',
  '2024 single YEA: original YEA fingerprint is absent in the earlier stored snapshot; identity and root cause remain held.',
  'No backfill, DB write, production deployment, model/forecast, scheduler or government outreach occurred.',
  '');
 writeFileSync(join(output,'committee-year-completeness.md'),table.join('\n'));
 console.log('SENATE_864_PUBLIC_SOURCE_AUDIT='+JSON.stringify({
  indexedMeetings:report.meetings.length,
  committeeYears:report.committeeYears.length,
  originalShaPdfs:report.committeeYears.reduce((n,c)=>n+c.shaAuthenticatedOriginalPdfs,0),
  originalOcrRecovered:report.committeeYears.reduce((n,c)=>n+c.ocrRecoveredOriginalPdfs,0),
  indexedWithoutPdf:report.committeeYears.reduce((n,c)=>n+c.meetingsWithoutLinkedMinutes,0),
  namedParserV3CandidateDelta:8,
  persistedDataRead:false,productionWrites:false,completenessCertified:false,
 }));
}
try{main()}catch{
 console.error('SENATE_864_INDEPENDENT_COMMITTEE_LEDGER_HOLD=source_or_proof_mismatch');
 process.exitCode=1;
}
