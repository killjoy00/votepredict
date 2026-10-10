import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SENATE_2023_24_CATCHUP_ORIGINALS,
  SENATE_2023_24_CATCHUP_YEAR_COUNTS,
} from '../src/evidence/senate-committee-2023-24-scanned-catchup.js';

const raw = readFileSync(new URL(
  '../docs/evaluation/source-proof/senate-committee-2023-24-final-25-scanned-ocr-source-ledger.json',
  import.meta.url,
), 'utf8');
const ledger = JSON.parse(raw);

test('25 original source audit metadata proofs are immutable and retained beyond temporary Actions artifacts', () => {
  const blob = createHash('sha1')
    .update('blob ' + Buffer.byteLength(raw) + '\0')
    .update(raw).digest('hex');
  assert.equal(blob, 'e263c6f9f7075b90456a1fdb4711153949616ce1');
  assert.equal(ledger.schemaVersion,
    'senate-committee-final-2023-24-scanned-original-ocr-proofs-v1');
  assert.equal(ledger.issue, 864);
  assert.equal(ledger.originalFullPdfAuditSourceRun, 38066441841);
  assert.deepEqual(ledger.originalFullPdfAuditArtifactIDs, {
    '2023':11674568363, '2024':11675315164,
  });
  assert.equal(ledger.sourceSelectionOrderedUrlsSha256,
    'cd3e4b1a21c18df68b1014c08628a4ca4438d401b00cd9fee42965f292da8108');
  assert.equal(ledger.sourceRecovery.githubActionsRunId, 38073521109);
  assert.equal(ledger.sourceRecovery.mergedMainSha,
    '32144d53d178c8d460ec9bd881b7d041574bccf5');
  assert.equal(ledger.sourceRecovery.premergeCI, 38073343396);
  assert.equal(ledger.sourceRecovery.postmergeCI, 38073521111);
});

test('all 25 source PDF and OCR SHA-256 hashes preserve exact LRL original identity and date', () => {
  const records = ledger.perOriginalProofs as Array<{
    year:number; meetingDate:string; committeeName:string; officialSourceUrl:string;
    originalRawPdfSha256:string; ocrTextSha256:string; parserNamedRolls:number;
    parserCountOnlyRolls:number; parserNamedChoices:number;
    parserVoiceContextCandidates:number; parserUnanimousContextCandidates:number;
    parserResultOnlyContextCandidates:number;
  }>;
  assert.equal(records.length, 25);
  assert.deepEqual(records.map(r => r.officialSourceUrl),
    SENATE_2023_24_CATCHUP_ORIGINALS.map(r => r.url));
  assert.equal(new Set(records.map(r => r.officialSourceUrl)).size, 25);
  for (const r of records) {
    assert.equal(r.committeeName, 'Higher Education');
    assert.ok([2023, 2024].includes(r.year));
    assert.equal(r.meetingDate.slice(0,4), String(r.year));
    assert.match(r.originalRawPdfSha256, /^[a-f0-9]{64}$/);
    assert.match(r.ocrTextSha256, /^[a-f0-9]{64}$/);
    assert.equal(r.parserNamedRolls, 0);
    assert.equal(r.parserCountOnlyRolls, 0);
    assert.equal(r.parserNamedChoices, 0);
    for (const n of [
      r.parserVoiceContextCandidates, r.parserUnanimousContextCandidates,
      r.parserResultOnlyContextCandidates,
    ]) assert.ok(Number.isInteger(n) && n >= 0);
  }
  assert.equal(records.find(r => r.meetingDate === '2023-01-12')?.originalRawPdfSha256,
    '570417d54a0ce34400bfdaf6b53cdca7bd407e2a75e30fb469487a925944f434');
  assert.equal(records.find(r => r.meetingDate === '2024-04-16')?.ocrTextSha256,
    '7d1d3c71eec86556aa77d6c2d48e0dcd329db699380db42d0e8f92158b8a15fa');
});

test('2023 and 2024 all previously low-text originals are now recovered, not all votes', () => {
  const years = ledger.sourceRecovery.years;
  assert.equal(years.length, 2);
  assert.deepEqual(years.map((y:any) => [
    y.year, y.originalInitialLowText, y.alreadyOcrRecovered,
    y.attemptedNow, y.ocrRecoveredNow, y.failedNow, y.stillScannedUnrecovered,
  ]), [
    [2023,22,5,17,17,0,0],
    [2024,13,5,8,8,0,0],
  ]);
  assert.equal(SENATE_2023_24_CATCHUP_YEAR_COUNTS[2023], 17);
  assert.equal(SENATE_2023_24_CATCHUP_YEAR_COUNTS[2024], 8);
  assert.equal(years[0].metadataArtifactId, 11678185896);
  assert.equal(years[0].metadataZipSha256,
    '9d6981acee78651cbbc87211901d8b0e80092f332811d75be77e1f92dee3cfe7');
  assert.equal(years[0].metadataJsonSha256,
    '2ea0feb375285de31e3838df4fd88e0cee1aee38f11e71a913b789d38e9c64f4');
  assert.equal(years[1].metadataArtifactId, 11677986160);
  assert.equal(years[1].metadataZipSha256,
    'afc29c477a9f624876349a5d2e4f1c532a403fad9e845ccb5be1d3edf540b66f');
  assert.equal(years[1].metadataJsonSha256,
    '117eab1b79627bb625c21c424b9e6c302968bed52d6d1f01102dbcfd73b19375');
  const records = ledger.perOriginalProofs;
  const sum = (field:string, year:number) => records
    .filter((r:any) => r.year === year)
    .reduce((n:number,r:any) => n + r[field], 0);
  for (const y of years) {
    assert.equal(sum('parserVoiceContextCandidates',y.year), y.parserVoiceContextCandidates);
    assert.equal(sum('parserUnanimousContextCandidates',y.year),
      y.parserUnanimousContextCandidates);
    assert.equal(sum('parserResultOnlyContextCandidates',y.year),
      y.parserResultOnlyContextCandidates);
  }
  assert.equal(years[0].parserVoiceContextCandidates, 1);
  assert.equal(years[0].parserUnanimousContextCandidates, 1);
  assert.equal(years[0].parserResultOnlyContextCandidates, 9);
  assert.equal(years[1].parserResultOnlyContextCandidates, 21);
});

test('cross-cohort source totals and unresolved historical/database debt stay explicit', () => {
  const x = ledger.crossCohort;
  assert.equal(x.originalInitialScannedPdfCount,207);
  assert.equal(x.alreadyOcrRecoveredBefore,30);
  assert.equal(x.additionalRecoveredNow,25);
  assert.equal(x.ocrRecoveredAfter,55);
  assert.equal(x.remainingUnrecovered,152);
  assert.deepEqual(x.remainingByYear, {'2022':110,'2023':0,'2024':0,'2025':42});
  assert.equal(x.newContextCandidates,32);
  assert.equal(x.totalOcrParserContextCandidates,94);
  assert.equal(x.alreadyObservedNamedRollCallsInPriorCohorts,1);
  assert.equal(x.alreadyObservedExplicitNamedChoicesInPriorCohorts,8);
  const l=ledger.limitations;
  assert.equal(l.original2021SenatePrintMeetingsAndVotesDenominator,null);
  assert.equal(l.all2021_25OfficialRecordedActionsDenominator,null);
  assert.equal(l.all2021_25MeetingDenominator,null);
  assert.equal(l.year2022_25IndexedMeetingsWithNoLinkedMinutePdfs,141);
  assert.equal(l.year2022PrintElectronicMayDiffer,true);
  assert.equal(l.parserCandidateActionsNotHumanValidatedAsDistinct,true);
  assert.equal(l.sourceToPrivateDatabaseReconciliationPerformed,false);
  assert.equal(l.productionHistoricalRowsChanged,false);
  assert.equal(l.rawOriginalPdfOrOcrTextOrNamesPersisted,false);
  assert.equal(l.modelForecastServingSchedulerChanges,false);
});
