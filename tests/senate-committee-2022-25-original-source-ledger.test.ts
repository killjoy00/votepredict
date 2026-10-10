import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const file = new URL(
  '../docs/evaluation/source-proof/senate-2022-25-committee-original-minutes-source-ledger.json',
  import.meta.url,
);
const raw = readFileSync(file, 'utf8');
const ledger = JSON.parse(raw);

function total(key: string) {
  return ledger.years.reduce((sum: number, year: Record<string, number>) => sum + year[key], 0);
}
function parserTotal(key: string) {
  return ledger.years.reduce((sum: number, year: any) => sum + year.actionParser[key], 0);
}

test('the original 2022–25 Senate committee ledger preserves exact official index and PDF source ZIP/payload digests', () => {
  assert.equal(ledger.schemaVersion,
    'votepredict-senate-committee-original-minutes-source-proof-ledger-v1');
  assert.equal(ledger.issue, 864);
  assert.equal(ledger.indexProof.runId, 38065594898);
  assert.equal(ledger.indexProof.artifactId, 11674762938);
  assert.equal(ledger.indexProof.artifactZipSha256,
    'cd39d5b334a4917616d614a03ae8b2ec0776e70214ae111ac5b54f877e890c7b');
  assert.equal(ledger.indexProof.payloadJsonSha256,
    'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0');
  assert.equal(ledger.originalPdfProof.runId, 38066441841);
  const expectedArtifacts = [11674729430, 11674568363, 11675315164, 11675014092];
  assert.deepEqual(ledger.years.map((year: any) => year.metadataProof.artifactId), expectedArtifacts);
  for (const year of ledger.years) {
    assert.match(year.officialIndexSha256, /^[a-f0-9]{64}$/);
    assert.match(year.metadataProof.artifactZipSha256, /^[a-f0-9]{64}$/);
    assert.match(year.metadataProof.jsonSha256, /^[a-f0-9]{64}$/);
    assert.ok(year.originalPdfLinks > 0);
    assert.equal(year.embeddedTextParsed + year.tooLittleEmbeddedText, year.originalPdfLinks);
    assert.ok(year.meetingsWithoutMinutes >= 0);
    assert.ok(year.originalPdfLinks >= year.meetingsWithMinutes);
    for (const group of Object.values(year.topCommitteeGaps)) {
      assert.ok(Array.isArray(group));
    }
  }
});

test('year 2023 has two distinct original PDF links for one indexed committee meeting, not two meetings', () => {
  assert.deepEqual(ledger.years.map((year: any) => year.year), [2022, 2023, 2024, 2025]);
  assert.deepEqual(ledger.years.map((year: any) => year.originalPdfLinks), [325, 454, 258, 415]);
  assert.deepEqual(ledger.years.map((year: any) => year.meetingsWithMinutes), [325, 453, 258, 415]);
  assert.equal(ledger.years[1].originalPdfLinks - ledger.years[1].meetingsWithMinutes, 1);
  assert.equal(total('committeePages'), 99);
  assert.equal(total('indexedMeetings'), 1592);
  assert.equal(total('meetingsWithMinutes'), 1451);
  assert.equal(total('meetingsWithoutMinutes'), 141);
  assert.equal(total('originalPdfLinks'), 1452);
  assert.equal(total('embeddedTextParsed'), 1245);
  assert.equal(total('tooLittleEmbeddedText'), 207);
});

test('parsed original action/rollcall counts are candidate observations only, not an official complete vote denominator', () => {
  const candidates = {
    candidateNamedRolls: 'namedRolls',
    candidateCountOnlyRolls: 'countOnlyRolls',
    candidateNamedMemberChoices: 'namedMemberChoices',
    candidateVoiceActions: 'voice',
    candidateUnanimousActions: 'unanimous',
    candidateResultOnlyActions: 'resultOnly',
    parsedPdfWithPossibleUnparsedRollSignal: 'possibleUnparsedRollCallPdfCount',
    parsedPdfWithPossibleUnparsedVoiceSignal: 'possibleUnparsedVoicePdfCount',
    parsedPdfWithNoSupportedAction: 'noSupportedActionPdfCount',
  };
  for (const [expectedKey, actualKey] of Object.entries(candidates)) {
    assert.equal(ledger.totals[expectedKey], parserTotal(actualKey));
  }
  assert.equal(ledger.totals.candidateNamedRolls, 89);
  assert.equal(ledger.totals.candidateCountOnlyRolls, 46);
  assert.equal(ledger.totals.candidateNamedMemberChoices, 855);
  assert.equal(ledger.totals.candidateVoiceActions, 1519);
  assert.equal(ledger.totals.candidateUnanimousActions, 6);
  assert.equal(ledger.totals.candidateResultOnlyActions, 3000);
  assert.equal(ledger.totals.parsedPdfWithPossibleUnparsedRollSignal, 141);
  assert.equal(ledger.originalPdfProof.recognitionIsParserCandidateObservationsOnly, true);
  assert.equal(ledger.originalPdfProof.noOriginalPdfBodiesStored, true);
});

test('historical 2021 official print gap, 2022 print/electronic gap and absent private SELECT export fail closed', () => {
  assert.equal(ledger.indexProof.all99CommitteeIndexPagesFetched, true);
  assert.equal(ledger.indexProof.failedPages, 0);
  assert.equal(ledger.indexProof.anomalies, 0);
  assert.equal(ledger.originalPdfProof.unresolvedTooLittleEmbeddedText, 207);
  assert.equal(ledger.originalPdfProof.unresolvedHttpDownloadFailures, 0);
  assert.equal(ledger.limitations.all2021To2025OfficialMeetings, null);
  assert.equal(ledger.limitations.all2021To2025RecordedVotes, null);
  assert.equal(ledger.limitations.all2021To2025NamedVotes, null);
  assert.equal(ledger.limitations.year2021SourcePrintOnly, true);
  assert.equal(ledger.limitations.year2022PrintElectronicGapUnresolved, true);
  assert.equal(ledger.limitations.parsedActionCountsDoNotCertifyVoteCompleteness, true);
  assert.equal(ledger.limitations.legacyPrivateDatabaseRowsNotExported, true);
  assert.equal(ledger.limitations.sourceToDatabaseReconciliationNotPerformed, true);
  assert.equal(ledger.limitations.noProductionDatabaseOrModelModification, true);
  assert.equal(ledger.limitations.issue864MustRemainOpen, true);
  assert.ok(!raw.includes('ocrText'));
});
