import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {firstCfbReportAvailabilityForTransaction}
 from '../src/evidence/cfb-report-availability.js';

const candidateWriter=readFileSync('scripts/backfill-cfb-candidate-finance.ts','utf8');

const report={
 registrationNumber:'12345',
 reportName:'2022 annual report',
 coverageStartOn:'2022-01-01',
 coverageEndOn:'2022-03-31',
 availableOn:'2022-04-10',
 filedOn:'2022-04-07',
 dueOn:'2022-04-08',
 proofUrl:'https://cfb.mn.gov/reports/example.pdf',
} as const;

test('current CFB candidate report PDF cannot imply positive historical public-by',()=>{
 const candidate={
  registrationNumber:report.registrationNumber,occurredOn:'2022-02-12',
 };
 assert.equal(firstCfbReportAvailabilityForTransaction(candidate,[
  {...report,proofKind:'cfb_report_filing'},
 ]),null);
 assert.equal(firstCfbReportAvailabilityForTransaction(candidate,[
  {...report,availableOn:'2022-04-12',proofKind:'cfb_report_filing'},
 ]),null);
 const direct=firstCfbReportAvailabilityForTransaction(candidate,[
  {...report,proofKind:'cfb_public_disclosure'},
 ]);
 assert.equal(direct?.proofKind,'cfb_public_disclosure');
 assert.equal(direct?.availableOn,'2022-04-10');
});

test('candidate writer mapping is separately gated to direct source-labelled public disclosure',()=>{
 assert.match(candidateWriter,
  /if \(!match \|\| match\.window\.proofKind !== 'cfb_public_disclosure'\) continue;/);
 assert.match(candidateWriter,/proofKind: 'cfb_public_disclosure'/);
 assert.match(candidateWriter,/disclosedOn: match\.window\.availableOn/);
 assert.match(candidateWriter,/proof_kind: mapping\.proofKind/);
 assert.match(candidateWriter,/disclosed_on: mapping\.disclosedOn/);
 assert.match(candidateWriter,/proof_kind text/);
 assert.match(candidateWriter,/disclosed_on date/);
});

test('candidate SQL hard-fails filing-only mappings even if an upstream selector regresses',()=>{
 assert.match(candidateWriter,/AND disclosure\.proof_kind = 'cfb_public_disclosure'/);
 assert.match(candidateWriter,/AND disclosure\.disclosed_on IS NOT NULL/);
 assert.match(candidateWriter,/AND disclosure\.disclosed_on = disclosure\.available_on/);
 assert.match(candidateWriter,/'availabilityProofKind', disclosure\.proof_kind/);
 assert.match(candidateWriter,/'disclosedOn', disclosure\.disclosed_on::text/);
 assert.doesNotMatch(candidateWriter,/'availabilityProofKind', 'cfb_report_filing'/);
 assert.match(candidateWriter,/filingDerivedAvailabilityUsesDocumentedNextDayRule: false/);
 assert.match(candidateWriter,/filingAndDueDatesOnlyProvideLegalNotBeforeFloor: true/);
 assert.match(candidateWriter,/separateDirectDisclosureEvidenceRequiredForPromotion: true/);
 assert.match(candidateWriter,
  /historicalAvailability: 'current_report_pdf_row_lead_not_historical_public_by'/);
});

test('candidate backfill remains non-serving research and not executed by this test',()=>{
 assert.match(candidateWriter,/publishedAt: undefined/);
 assert.match(candidateWriter,/asOfEligible: false/);
 assert.match(candidateWriter,/modelWeight: 0/);
 assert.match(candidateWriter,/transactionDateIsAvailability: false/);
});
