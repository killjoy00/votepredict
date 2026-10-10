import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = JSON.parse(readFileSync(
  new URL('../docs/evaluation/source-proof/senate-committee-30-scanned-ocr-source-ledger.json', import.meta.url),
  'utf8',
));
const yearSum = (key:string) =>
  source.secondSample.years.reduce((n:number,year:Record<string,number>) => n + year[key],0);

test('all 30 recovered scans are disjoint original public LRL Senate source cohorts, not the full 207',()=>{
  assert.equal(source.schemaVersion,'senate-committee-2022-25-30-original-ocr-source-ledger-v1');
  assert.equal(source.issue,864);
  assert.equal(source.baseline.tooLittleEmbeddedTextPreviously,207);
  assert.equal(source.baseline.originalElectronicMinutePdfs,1452);
  assert.equal(source.sixOriginalFeasibility.originalPdfsOcrRecovered,6);
  assert.equal(source.sixOriginalFeasibility.originalPdfFailures,0);
  assert.equal(source.secondSample.originalPdfsOcrRecovered,24);
  assert.equal(source.secondSample.originalPdfFailures,0);
  assert.equal(yearSum('ocrRecovered'),24);
  assert.equal(yearSum('failed'),0);
  assert.equal(source.crossPilotTotals.distinctOriginalsOcrRecovered,30);
  assert.equal(source.crossPilotTotals.originalsRemainingUnattemptedOcrFrom207,177);
  assert.equal(207 - 30, source.crossPilotTotals.originalsRemainingUnattemptedOcrFrom207);
  assert.equal(source.baseline.officialElectronicIndexedMeetingsWithoutMinutesLink,141);
});

test('the original six-source and 24-source artifact ZIP and payload SHA-256 digests are all retained',()=>{
  assert.equal(source.sixOriginalFeasibility.sourceRunId,38068730892);
  assert.equal(source.sixOriginalFeasibility.artifactId,11676072623);
  assert.equal(source.sixOriginalFeasibility.zipSha256,
    '99f40a9237eebd6ce94b59b74d4591c9068838f0908e3de5b78cf406a6b28dde');
  assert.equal(source.sixOriginalFeasibility.metadataJsonSha256,
    'a530d9121f676d32079d88e514d6d2ae26aac86a3902244234a7bcb886ba3731');
  assert.equal(source.secondSample.sourceRunId,38069432305);
  assert.equal(source.secondSample.sourceSelectionManifestGitBlobSha,
    '70211898f4f885002b31de594ffd352a8c20d652');
  assert.equal(source.secondSample.sourceSelectionManifestSha256,
    'd482c8274eeea49b5c602480fa166a355855cb9ee5e5b041ada7c470ee3e1f70');
  assert.deepEqual(source.secondSample.years.map((x:any)=>x.year),[2022,2023,2024,2025]);
  assert.deepEqual(source.secondSample.years.map((x:any)=>x.artifactId),
    [11675539378,11676162360,11675569424,11675584270]);
  for(const item of source.secondSample.years){
    assert.match(item.zipSha256,/^[a-f0-9]{64}$/);
    assert.match(item.jsonSha256,/^[a-f0-9]{64}$/);
    assert.equal(item.expected,item.ocrRecovered+item.failed);
    assert.equal(item.parserNamedRolls, item.year === 2025 ? 1 : 0);
  }
});

test('source detected one named Judiciary eight-choice roll, 62 context-only parser action candidates total',()=>{
  assert.equal(yearSum('parserNamedRolls'),1);
  assert.equal(yearSum('parserNamedMemberChoices'),8);
  assert.equal(source.sixOriginalFeasibility.parserNamedRolls,0);
  assert.equal(source.crossPilotTotals.parserNamedRolls,1);
  assert.equal(source.crossPilotTotals.parserNamedMemberChoices,8);
  assert.equal(source.crossPilotTotals.parserVoiceContextActions,19);
  assert.equal(source.crossPilotTotals.parserResultOnlyContextActions,43);
  assert.equal(source.crossPilotTotals.parserUnanimousContextActions,0);
  assert.equal(source.crossPilotTotals.parserCandidateContextActionObservations,62);
  assert.equal(yearSum('voiceContext')+source.sixOriginalFeasibility.parserVoiceContextActions,19);
  assert.equal(yearSum('resultOnlyContext')+source.sixOriginalFeasibility.parserResultOnlyContextActions,43);
  const highlight=source.candidateNamedRollHighlight;
  assert.equal(highlight.meetingDate,'2025-03-12');
  assert.equal(highlight.committee,'Judiciary and Public Safety');
  assert.equal(highlight.originalPdfSha256,
    '0f272639ecf612217daa230794df31731428bbc665e6a2caa6dad26442c54f0a');
  assert.equal(highlight.ocrTextSha256,
    '609bf8f2e212c88eb3e6a414d2eb352258486b24664b885eb92ee45a0be69728');
  assert.equal(highlight.candidateRecordedRollCallExternalKey,'senate-committee:3f52889e20a9b8a6:0');
  assert.equal(highlight.candidateSourceNamedMemberChoices,8);
  assert.equal(highlight.humanValidatedExactTallyNamesAndDistinctMotions,false);
  assert.equal(highlight.reconciledToPersistedDb,false);
  assert.equal(source.crossPilotTotals.sourceParserDoesNotProveAllActualRecordedMotions,true);
});

test('official 2021 print universe and 2022 mixed source gaps remain unknown; no production repair',()=>{
  const b=source.barriers;
  assert.equal(source.baseline.year2021OriginalSenateMinutes,
    'print_only_unknown_official_meeting_and_vote_denominator');
  assert.equal(source.baseline.year2022OfficialPrintElectronicallyIndexedCollectionsMayDiffer,true);
  assert.equal(b.all2021To2025OfficialCommitteeMeetingDenominator,null);
  assert.equal(b.all2021To2025OfficialRecordedVoteDenominator,null);
  assert.equal(b.year2021OfficialPrintSourceRecovered,false);
  assert.equal(b.year2022PrintElectronicSourceReconciled,false);
  assert.equal(b.sourceToPrivateEvidenceDatabaseJoinExecuted,false);
  assert.equal(b.historicalDatabaseRepairApplied,false);
  assert.equal(b.noPrivateProductionDbQueriesOrWrites,true);
  assert.equal(b.noForecastOrModelChanges,true);
  assert.equal(b.keepIssue864Open,true);
});
