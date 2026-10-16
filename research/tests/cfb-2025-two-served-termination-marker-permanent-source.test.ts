import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CFB_TWO_SERVED_SPECIAL_TERMINATION_PROBE_SCHEMA}
  from '../evidence/cfb-2025-served-special-final-termination-markers.js';
const ROOT='docs/evaluation/source-proof/';
const CHECKPOINT=ROOT+'cfb-2025-two-served-special-final-termination-marker-original-source-checkpoint.json';
const PSV=ROOT+'cfb-2025-two-served-special-final-termination-marker-original-psv.psv';
const PRIOR=ROOT+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json';
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const HEX=/^[0-9a-f]{64}$/;
function checkpoint(){return JSON.parse(readFileSync(CHECKPOINT,'utf8'));}
function canonicalRows(){
  const raw=readFileSync(PSV,'utf8');
  assert.ok(raw.endsWith('\n')&&!raw.endsWith('\n\n'));
  const canonical=raw.slice(0,-1);
  assert.equal(Buffer.byteLength(canonical),474);
  assert.equal(sha(canonical),'108730ea3e3aaac8deb3829f5acd4f39d1d59c5795551155454d6a31c555b95a');
  const p=checkpoint();
  assert.equal(p.provenance.permanentMarkerLedgerCanonicalBytesWithoutFinalNewline,474);
  assert.equal(p.provenance.permanentMarkerLedgerSha256WithoutFinalNewline,sha(canonical));
  return canonical.split('\n').map(row=>{
    const c=row.split('|');
    assert.equal(c.length,13);
    const [registrationNumber,reportId,district,originalPdfSha256,pdfBytes,retrievedAt,
      boardReceived,extractedTextSha256,terminationWords,positions,explicitLabel,bareLabel,status]=c;
    assert.match(originalPdfSha256!,HEX);
    assert.match(extractedTextSha256!,HEX);
    assert.equal(terminationWords,'3');
    assert.equal(explicitLabel,'false');
    assert.equal(bareLabel,'false');
    assert.equal(status,'unknown');
    assert.ok(retrievedAt!.startsWith('2026-10-11T'));
    assert.ok(/^\d+(?:,\d+){2}$/.test(positions!));
    return{registrationNumber,reportId,district:Number(district),originalPdfSha256,
      pdfBytes:Number(pdfBytes),retrievedAt,boardReceived,extractedTextSha256,
      wordCount:Number(terminationWords),positions:positions!.split(',').map(Number)};
  });
}
test('preserve 2026 original source artifact exact head and 7180-byte SHA256 before expiry',()=>{
  const c=checkpoint();
  assert.equal(c.schemaVersion,'cfb-2025-actual-senate-members-two-original-special-final-termination-marker-permanent-proof-v1');
  assert.equal(CFB_TWO_SERVED_SPECIAL_TERMINATION_PROBE_SCHEMA,
    'cfb-2025-two-served-senators-original-special-final-termination-marker-probe-v1');
  assert.equal(c.provenance.sourceWorkflowSucceeded,true);
  assert.equal(c.provenance.exactHeadFullCiSucceeded,true);
  assert.equal(c.provenance.sourceWorkflowHead,'d015e09e3a783ee4b0aa609b5e191135e2004225');
  assert.equal(c.provenance.mergedSourceImplementationCommit,'e6231859ed0da8ba095fa4b0ac2ae612ed1323c1');
  assert.equal(c.provenance.sourceArtifactId,11687644644);
  assert.equal(c.provenance.originalSourceArtifactZipSha256,
    'b4b84746952ca3853ea673fda2301cc85d4f42e2db5160f44245eb694ed32b55');
  assert.equal(c.provenance.originalUncompressedMetadataJsonSha256,
    'f7dab9154a7423d7b8abbd04a3c8e041a678d0d0d9b88fe6bc841cc93dacfc74');
  assert.equal(c.provenance.originalUncompressedMetadataJsonBytes,7180);
  assert.equal(c.provenance.originalSourceArtifactCapturedUtc,'2026-10-11T01:34:32.603Z');
  assert.match(c.originalSenateService.originalDirectorySha256,HEX);
  assert.match(c.originalSenateService.originalSpecialSenatorSwearingSha256,HEX);
  assert.ok(c.originalSenateService.originalDirectoryObservedAtUtc.startsWith('2026-10-11T'));
  assert.ok(c.originalSenateService.originalSwearingObservedAtUtc.startsWith('2026-10-11T'));
});
test('only two actual senators, exact same original PDF versions and Board-received days as prior independent proof',()=>{
  const c=checkpoint(),p=JSON.parse(readFileSync(PRIOR,'utf8')),rows=canonicalRows();
  assert.deepEqual(rows.map(x=>x.registrationNumber),['19229','19233']);
  assert.deepEqual(rows.map(x=>x.district),[29,47]);
  assert.deepEqual(rows.map(x=>x.pdfBytes),[35024,38474]);
  assert.deepEqual(rows.map(x=>x.boardReceived),['2025-11-26','2025-11-20']);
  assert.deepEqual(rows.map(x=>x.positions),[[830,1550,8522],[834,1558,10883]]);
  assert.deepEqual(c.originalReportSourceFindings.map((x:any)=>x.senateMember),
    ['Michael Holmstrom Jr','Amanda Hemmingsen-Jaeger']);
  const original=p.sourceOriginalReports;
  for(const [i,r] of rows.entries()){
    const x=c.originalReportSourceFindings[i];
    const prev=original.find((z:any)=>z.registrationNumber===r.registrationNumber);
    assert.ok(prev);
    assert.equal(x.originalSpecialFinalReportId,r.reportId);
    assert.equal(x.originalPdfSha256,prev.originalPdfBinarySha256);
    assert.equal(x.originalPdfSha256,r.originalPdfSha256);
    assert.equal(x.originalPdfBytes,r.pdfBytes);
    assert.equal(x.originalPdfReacquiredAtUtc,r.retrievedAt);
    assert.equal(x.officialBoardReceivedOn,prev.boardReceivedOn);
    assert.equal(x.officialBoardReceivedOn,r.boardReceived);
    assert.equal(x.recheckedOriginalViewerApiSha256,prev.originalViewerApiSha256);
    assert.equal(x.originalPdfExtractedTextSha256,r.extractedTextSha256);
    assert.equal(x.extractedTerminationVocabularyCount,r.wordCount);
    assert.deepEqual(x.extractedTerminationWordPositions,r.positions);
    assert.equal(x.selectedCheckboxProven,null);
    assert.equal(x.originalBoardTerminationNoticeProven,null);
    assert.equal(x.reportIsTermination,null);
    assert.equal(x.effectiveCommitteeTerminationOn,null);
    assert.equal(x.individual2025YearEndLegallyRequired,null);
    assert.equal(x.independentlyProvenHistoricalPublicByOn,null);
    assert.equal(x.explicitFirst6500TextTerminationReportTypeFound,false);
    assert.equal(x.bareFirst6500TextTerminationReportLabelFound,false);
  }
});
test('generic report termination wording is not a termination certificate or an as-of publication date',()=>{
  const x=checkpoint();
  assert.equal(x.summary.previouslyVerifiedOriginalPdfHashesReconfirmed,2);
  assert.equal(x.summary.newlyAuthenticatedOriginalReportPdfBodies,0);
  assert.equal(x.summary.distinctTerminationLexemesAcrossTwoPdfs,6);
  assert.equal(x.summary.explicitReportTypeTerminationsTextuallyFound,0);
  assert.equal(x.summary.independentSelectedTerminationCheckboxesVerified,0);
  assert.equal(x.summary.independentOriginalBoardTerminationNoticesVerified,0);
  assert.equal(x.summary.individualLegallyOwedYearEndCount,null);
  assert.equal(x.summary.statewideActualServingSenatorsLegallyOwedReportDenominator,null);
  assert.equal(x.summary.independentlyProvenHistoricPublicByCount,0);
  assert.equal(x.legalSource.noInferenceFromFollowingYearEndFiling,true);
  assert.equal(x.legalSource.noInferenceFrom2026CurrentRegistrationDateOrMissingTerminationDate,true);
  assert.equal(x.summary.noPredictionEligibilityChange,true);
  assert.equal(x.summary.keepIssue864Open,true);
  assert.equal(x.safeguards.noOriginalPdfBodiesOrRawTextSaved,true);
  assert.equal(x.safeguards.noDonorsOrFinancialAmountsOrCandidateContactsSaved,true);
  assert.equal(x.safeguards.noProductionDbOrModelOrServingOrSchedulerWrites,true);
});
