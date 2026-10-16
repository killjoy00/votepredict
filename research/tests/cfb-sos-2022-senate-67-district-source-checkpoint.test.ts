import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {deriveCfb2022OriginalSegmentRegistrationSet} from '../../src/evidence/cfb-2022-senate-sos-ballot-obligation-reconciliation.js';
const PATH='docs/evaluation/source-proof/cfb-sos-2022-senate-ballot-67-district-source-checkpoint.json';
const SOURCE='docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
const p=JSON.parse(readFileSync(PATH,'utf8'));
test('2022 full Senate general and contested-primary original Secretary of State sources have independent immutable hashes',()=>{
  assert.equal(p.schemaVersion,'cfb-sos-2022-senate-67-district-ballot-source-checkpoint-v1');
  assert.equal(p.source.acquisitionRunId,38093516835);
  assert.equal(p.source.originalWorkflowArtifactId,11685460024);
  assert.equal(p.source.sourceWorkflowExactHead,'61aaf4669b3737655e0a12dba47bf0e2a1b2ebf4');
  assert.equal(p.source.mergedImplementationCommit,'3dc7859f0ba5781920e051201bcdcfbab49f36fa');
  assert.equal(p.source.zipSha256,'bbd94ff80a10d702f8096f73457ab653399b818abaf496449c4f635264868b1c');
  assert.equal(p.source.jsonSha256,'2474359842c2eedad05aed0052a48d6d3fdd24426ce0ee8de9dd6ca41d5c4ae5');
  assert.equal(p.source.originalMetadataJsonBytes,304076);
  const general=p.source.secretaryOfStateGeneral,primary=p.source.secretaryOfStateContestedPrimary;
  assert.equal(general.url,'https://electionresultsfiles.sos.mn.gov/20221108/stsenate.txt');
  assert.equal(general.sha256,'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74');
  assert.equal(general.originalBytes,16857);
  assert.equal(general.officialDistricts,67);
  assert.equal(general.namedCandidateResultEntriesExcludingWriteIns,131);
  assert.equal(primary.url,'https://electionresultsfiles.sos.mn.gov/20220809/stsenate.txt');
  assert.equal(primary.sha256,'598152339775ffb8cb489704abdb13fc06d660878991790a3222a330354d0f88');
  assert.equal(primary.originalBytes,6500);
  assert.equal(primary.districtsWithContestedPrimaryCandidateRows,24);
  assert.equal(primary.namedCandidateResultEntries,75);
  assert.equal(primary.uncontestedCandidateElectionFilingStatusKnownFromThisResultFile,false);
});
test('candidate result reconciliation counts 270 CFB 2022 Senate observed registration numbers and retains all unresolved results',()=>{
  const c=p.source.campaignFinanceBoard,r=p.reconciliation;
  const source=JSON.parse(readFileSync(SOURCE,'utf8'));
  assert.equal(deriveCfb2022OriginalSegmentRegistrationSet(source).size,270);
  assert.equal(c.sourceDistrictPagesIndependentlyFetched,67);
  assert.equal(c.sourceDistinctRegisteredViewerCandidateIds,270);
  assert.equal(c.sourceFailures,0);
  assert.equal(c.sourceIdentityMatchedPreviouslyPinned2022Segment,true);
  assert.equal(r.sourceCandidateRegistrations,270);
  assert.equal(r.SOS2022GeneralEntriesSafeDistrictAndFirstLastNameMatches,115);
  assert.equal(r.SOS2022ContestedPrimaryEntriesSafeDistrictAndFirstLastNameMatches,67);
  assert.equal(r.generalSOSCandidateResultsUnmatchedByStrictIdentity,16);
  assert.equal(r.contestedPrimarySOSCandidateResultsUnmatchedByStrictIdentity,8);
  assert.equal(r.cfbCandidateEntriesWithoutGeneralSOSMatch,155);
  assert.equal(r.cfbCandidateEntriesWithoutContestedPrimarySOSMatch,203);
  assert.equal(r.cfbUnknownNameShapeEntryCount,1);
  assert.equal(r.noFuzzyOrCrossDistrictJoins,true);
  assert.equal(r.unmatchedSosResultDoesNotProveCfbRegistrationAbsent,true);
  assert.equal(r.unmatchedCfbViewerDoesNotProveNotOnBallot,true);
});
test('2022 ballot predicate source observation cannot be promoted into statutory filing denominator',()=>{
  const r=p.reconciliation,b=p.safeguards;
  assert.equal(r.historicalRegistrationTerminationsIndependentlyVerified,0);
  for(const k of ['2022SenatePrePrimaryReportsLegallyRequired','2022SenatePreGeneralReportsLegallyRequired',
    '2022SenateYearEndReportsLegallyRequired','2022SenateNonfilerCount',
    'stateSenate2021to2025RequiredFilingDenominator']){
    assert.equal(r[k],null);
  }
  assert.equal(b.historicalPublicByNotGrantedByLaterResultSource,true);
  assert.equal(b.originalElectionVoteTotalsNotPersistedToRepository,true);
  assert.equal(b.forecastInputsChanged,false);
  assert.equal(b.productionDbReadOrWrite,false);
  assert.equal(b.modelTrainingOrServingChanges,false);
  assert.equal(b.issue864RemainsOpen,true);
});
