import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cfbElectronicReportAvailableOn } from '../../src/evidence/cfb-report-availability.js';
import {
  CFB_2025_SPECIAL_CALENDAR_RULES,
  parsePinnedCfb2025SpecialOriginalTargets,
} from '../../src/evidence/cfb-2025-senate-special-original-pdf-proof.js';

const ROOT='docs/evaluation/source-proof/';
const LEDGER=ROOT+'cfb-2025-senate-12-special-original-pdf-source-ledger.psv';
const PROOF=ROOT+'cfb-2025-senate-12-special-original-pdf-source-checkpoint.json';
const INITIAL=ROOT+'cfb-2025-dated-senate-85-reference-versions.psv';
function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function checkpoint() {
  return JSON.parse(readFileSync(PROOF,'utf8')) as Record<string,any>;
}
function parseRows() {
  const raw=readFileSync(LEDGER,'utf8');
  assert.ok(raw.endsWith('\n'), 'Canonical report ledger ends in exactly one newline');
  const canonical=raw.slice(0,-1);
  assert.equal(canonical.endsWith('\n'),false);
  const rows=canonical.split('\n').map(line=>{
    const c=line.split('|');
    assert.equal(c.length,9,'report ID, Senate district, PDF SHA, bytes and five date fields');
    const [reportId,district,pdfSha256,pdfBytes,coverageStartOn,coverageEndOn,receivedOn,dueOn,floorOn]=c as [
      string,string,string,string,string,string,string,string,string
    ];
    assert.match(reportId,/^\d+:25:pcc:(C|E):1:0$/);
    assert.ok(['6','29','47'].includes(district));
    assert.match(pdfSha256,/^[0-9a-f]{64}$/);
    assert.match(pdfBytes,/^\d+$/);
    assert.ok(Number(pdfBytes)>=300 && Number(pdfBytes)<=30000000);
    for(const date of [coverageStartOn,coverageEndOn,receivedOn,dueOn,floorOn]) {
      assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
      const d=new Date(date+'T00:00:00Z');
      assert.equal(d.toISOString().slice(0,10),date,'real ISO date');
    }
    return {reportId,district:Number(district),pdfSha256,bytes:Number(pdfBytes),
      coverageStartOn,coverageEndOn,receivedOn,dueOn,floorOn};
  });
  return {canonical,rows};
}

test('real one-shot source artifact and exact 12-PDF metadata ledger survive artifact expiry',()=>{
  const p=checkpoint(),{canonical,rows}=parseRows();
  assert.equal(p.schemaVersion,'cfb-senate-2025-special-original-ce-12-official-pdf-and-calendar-source-checkpoint-v1');
  assert.equal(p.provenance.runId,38087106096);
  assert.equal(p.provenance.sourceArtifactId,11682778548);
  assert.equal(p.provenance.sourceWorkflowHeadSha,'cb4bde0916477a89a2c64a3eec74cf511137021a');
  assert.equal(p.provenance.sourceWorkflowMergedSha,'093895854ad1f77d707ef3dc71d9308ce5666014');
  assert.equal(p.provenance.originalZipSha256,
    'e2ba145c819586e21065559a2a82f7f740448b507ba51ceaca7dba79f91639eb');
  assert.equal(p.provenance.originalUncompressedJsonSha256,
    '5925fdfc2b0fee6ab5ed352fd1a903e3a9c16f91607854eefb2bb9d9ac196c58');
  assert.equal(p.provenance.originalUncompressedJsonBytes,24337);
  assert.equal(canonical.length,1770);
  assert.equal(Buffer.byteLength(canonical,'utf8'),p.provenance.verified12ReportMetadataLedgerCanonicalBytesWithoutFinalNewline);
  assert.equal(sha256(canonical),
    '5048b6fa2220a92a6e6a61484f49a224c3fd60fc4e5900d42e6f31c9852517b9');
  assert.equal(sha256(canonical),p.provenance.verified12ReportMetadataLedgerCanonicalSha256WithoutFinalNewline);
  assert.equal(rows.length,12);
});

test('authenticated report hashes tie one-to-one to all and only 12 pinned 2025 C/E original-version refs',()=>{
  const p=checkpoint(),{rows}=parseRows();
  const targets=parsePinnedCfb2025SpecialOriginalTargets(readFileSync(INITIAL,'utf8'));
  assert.deepEqual(rows.map(x=>x.reportId),targets.map(x=>x.reportId));
  assert.equal(new Set(rows.map(x=>x.reportId)).size,12);
  assert.equal(new Set(rows.map(x=>x.pdfSha256)).size,12);
  assert.deepEqual([6,29,47].map(d=>rows.filter(x=>x.district===d).length),[5,4,3]);
  assert.deepEqual([7,5],[rows.filter(x=>x.reportId.includes(':C:')).length,
    rows.filter(x=>x.reportId.includes(':E:')).length]);
  assert.equal(new Set(rows.map(x=>x.reportId.split(':')[0])).size,7);
  assert.equal(p.sourceAcquisition.candidateViewerRequestsSucceeded,7);
  assert.equal(p.sourceAcquisition.candidateViewerResponseHashChangedSinceOriginalReferenceAudit,0);
  assert.equal(p.sourceAcquisition.pdfDownloadsWithBinarySha256,12);
  assert.equal(p.sourceAcquisition.exactRegistrationAndSenateDistrictHeaderVerified,12);
  assert.equal(p.sourceAcquisition.expectedReportPeriodEndIndependentlyMatched,12);
  assert.equal(p.sourceAcquisition.BoardReceivedDatesParsed,12);
  assert.equal(p.sourceAcquisition.reportPdfHeaderAndCalendarPairsVerified,12);
  assert.equal(p.sourceAcquisition.reportSourceFailures,0);
  assert.equal(p.sourceAcquisition.unverifiedOriginalVersionTargets,0);
  assert.equal(p.sourceAcquisition.newlyVerifiedBeyondPriorDistrict6PrePrimaryAndPreGeneralControls,10);
  assert.equal(p.sourceAcquisition.originalReportAmendmentCheckboxIndependentlyVerified,0);
  rows.forEach((r,i)=>{
    const t=targets[i]!;
    assert.equal(r.district,t.district);
    assert.equal(r.coverageEndOn,t.expectedPeriodEndOn);
    assert.equal(r.dueOn,t.dueOn);
    assert.ok(r.coverageStartOn>= '2025-01-01');
    assert.ok(r.coverageStartOn<=r.coverageEndOn);
    assert.ok(r.receivedOn>=r.coverageEndOn);
    assert.ok(r.receivedOn<=r.dueOn);
    assert.equal(r.floorOn,cfbElectronicReportAvailableOn(r.receivedOn,r.dueOn));
    assert.ok(r.floorOn>r.dueOn);
  });
});

test('all three official special-election calendars are pinned as unique original PDF byte hashes',()=>{
  const p=checkpoint();
  const calendars=p.calendarPdfs as Array<Record<string,any>>;
  assert.equal(calendars.length,3);
  assert.deepEqual(calendars.map(c=>c.district),[6,29,47]);
  assert.equal(new Set(calendars.map(c=>c.pdfBinarySha256)).size,3);
  assert.equal(p.sourceAcquisition.independentCalendarDownloadsAndHashes,3);
  assert.equal(p.sourceAcquisition.independentCalendarScopeAndDateMarkersVerified,3);
  assert.equal(p.sourceAcquisition.calendarSourceFailures,0);
  const expectedHashes={
    6:'d27307ec9bad876fb79cd517516e567e642ad4931077dda2d7941dc09518e863',
    29:'b102a7297a6ff1add3bcdb4bce03ef9761f3a3433908cbb507e95554fd3d38b2',
    47:'3b7669d2597632278b2a0e895a5cbf7199492fd286872127f6d9e36d9eb13291',
  };
  for(const c of calendars) {
    const district=c.district as 6|29|47;
    const rule=CFB_2025_SPECIAL_CALENDAR_RULES[district];
    assert.equal(c.pdfBinarySha256,expectedHashes[district]);
    assert.equal(c.originalOfficialPdfUrl,rule.sourceUrl);
    assert.equal(c.prePrimaryDueOn,rule.prePrimaryDueOn);
    assert.equal(c.preGeneralDueOn,rule.preGeneralDueOn);
    assert.equal(c.prePrimaryPeriodEndOn,rule.prePrimaryPeriodEndOn);
    assert.equal(c.preGeneralPeriodEndOn,rule.preGeneralPeriodEndOn);
    assert.ok(c.bytes>=500);
  }
});

test('authenticated PDF headers and conservative earliest legal bounds never become historic public-by proof',()=>{
  const p=checkpoint(),h=p.historicalFinanceCompleteness,b=p.boundaries;
  assert.equal(h.historicPublicByOnIndependentlyVerifiedCountInThisProbe,0);
  assert.equal(h.historicalPublicByDateProofForAnyOfThese12,null);
  assert.equal(h.everyDateInMetadataLedgerIsAtMostConservativeNotBeforeEvidence,true);
  assert.equal(h.complete2021To2025SenateHistoricalCommitteeYearDenominator,null);
  assert.equal(h.statewide2025LegallyOwedOriginalReportDenominator,null);
  assert.equal(h.statewide2025ActuallyFiledOriginalReportDenominator,null);
  assert.equal(h.sourceToProductionRowContainmentProved,false);
  assert.equal(h.candidateObligationOrPrimaryBallotApplicabilityConfirmed,false);
  assert.equal(h.originalCheckboxProofStillNeeded,true);
  assert.equal(h.specialElectionFinalReportMay14VersusMay20DiscrepancyResolved,false);
  assert.equal(h.completeStatewide2021To2025SenateCoverageCertified,false);
  assert.equal(b.rawPdfBytesOrBodyTextCommitted,false);
  assert.equal(b.candidateOrDonorIdentityAndTransactionTextCommitted,false);
  assert.equal(b.noProductionNeonOrVercelReadsOrWrites,true);
  assert.equal(b.noPredictionServingOrModelChange,true);
  assert.equal(b.noBackfillOrScheduler,true);
  assert.equal(b.no2027ProgramModification,true);
  assert.equal(b.issue864MustRemainOpen,true);
});
