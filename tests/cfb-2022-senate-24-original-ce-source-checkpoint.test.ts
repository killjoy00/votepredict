import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {cfb2022OriginalCePdfTargets,CFB_2022_CE_INDEPENDENT_CALENDAR_URL}
  from '../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';

const SOURCE_DIR='docs/evaluation/source-proof/';
const source=JSON.parse(readFileSync(SOURCE_DIR+'cfb-2022-senate-24-original-ce-pdf-source-checkpoint.json','utf8'));
const originalLedger=readFileSync(SOURCE_DIR+'cfb-2022-senate-24-original-ce-pdf-headers.psv','utf8');
const ledger=originalLedger.endsWith('\n')?originalLedger.slice(0,-1):originalLedger;
const hash=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');

test('24 source-verified original 2022 C/E report PDF metadata rows have canonical authenticated hash, source IDs and legal bounds',()=>{
  const p=source.reportEvidence;
  assert.equal(source.schemaVersion,'cfb-2022-senate-24-original-ce-pdf-original-calendar-checkpoint-v1');
  assert.equal(ledger.length,3502);
  assert.equal(p.metadataLedgerNoFinalLfBytes,3502);
  assert.equal(hash(ledger),'ff962750038b768f037d61961a27998cab0aa821eb7e3512c173af963cf2fa15');
  assert.equal(p.metadataLedgerNoFinalLfSha256,hash(ledger));
  const rows=ledger.split('\n').map(line=>line.split('|'));
  assert.equal(rows.length,24);
  assert.deepEqual(rows.map(r=>r[0]),[...rows].map(r=>r[0]).sort());
  assert.equal(hash(rows.map(r=>r[0]).join('\n')),
    'a20677d59a33e29c7488040a71f8968f94dc9ea33647077ed5f82eb17677436d');
  const expected=new Set(cfb2022OriginalCePdfTargets().map(x=>x.id));
  assert.equal(expected.size,24);
  assert.deepEqual([...new Set(rows.map(r=>r[0]))].sort(),[...expected].sort());
  assert.equal(new Set(rows.map(r=>r[1])).size,24);
  const ids=new Set<string>();
  let late=0;
  for(const row of rows){
    assert.equal(row.length,8);
    const [id,sha,rawBytes,start,end,received,due,notBefore]=row as string[];
    assert.ok(expected.has(id));
    ids.add(id.split(':')[0]!);
    assert.match(sha,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(Number(rawBytes))&&Number(rawBytes)>=300);
    assert.equal(start,'2022-01-01');
    const period=id.split(':')[3];
    assert.equal(end,period==='C'?'2022-07-18':'2022-10-24');
    assert.equal(due,period==='C'?'2022-07-25':'2022-10-31');
    assert.match(received,/^2022-\d{2}-\d{2}$/);
    assert.ok(received>=end);
    const predictedFloor=new Date(Date.parse((received>due?received:due)+'T00:00:00Z')+86_400_000)
      .toISOString().slice(0,10);
    assert.equal(notBefore,predictedFloor);
    if(received>due)late++;
  }
  assert.equal(ids.size,12);
  assert.equal(late,1);
  assert.equal(p.parsedBoardReceiptsAfterApplicable2022DueOnCount,1);
  assert.equal(p.lateBoardReceiptReportId,'18077:22:pcc:C:0:0');
  assert.equal(p.lateBoardReceiptOn,'2022-07-27');
  assert.equal(p.exactHeaderRegistrationOfficeDistrictCoverageEndAndBoardReceiptVerified,24);
  assert.equal(p.originalVersionReferencesSelected,24);
  assert.equal(p['2022PrePrimaryOriginalPdfHeadersVerified'],12);
  assert.equal(p['2022PreGeneralOriginalPdfHeadersVerified'],12);
});
test('original official 2022 Senate disclosure calendar binary and source metadata remain pinned',()=>{
  const s=source.source;
  assert.equal(s.acquisitionRunId,38093672501);
  assert.equal(s.acquisitionWorkflowExactHead,'4fad228f7dad3d97c2e75809478263e7c0e543f0');
  assert.equal(s.implementationMergedSquashCommit,'f2749aa0173cf6e4b129ee69a4233f0add4c486d');
  assert.equal(s.artifactId,11685645051);
  assert.equal(s.artifactZipSha256,'35a706b2d40a2e939c784093707080f0c6fdeab29c3d013ef6dcda8b50542324');
  assert.equal(s.artifactJsonSha256,'0287cff4f269a35468d5cd216bbb6491e3b4ecf710c8803658e90c889e22aba4');
  assert.equal(s.artifactJsonBytes,57351);
  assert.equal(s.artifactCapturedAt,'2026-10-10T23:04:26.640Z');
  const c=s.original2022Calendar;
  assert.equal(c.originalUrl,CFB_2022_CE_INDEPENDENT_CALENDAR_URL);
  assert.equal(c.pdfSha256,'3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25');
  assert.equal(c.pdfBytes,574447);
  assert.equal(c.originalCalendarIdentityAndRowsVerified,true);
  assert.equal(c.prePrimaryDueOn,'2022-07-25');
  assert.equal(c.preGeneralDueOn,'2022-10-31');
  assert.deepEqual(source.reportEvidence.districts,Array.from({length:12},(_,i)=>i+1));
});
test('source first-page receipt stamp and legal floor must never promote historical prediction eligibility or statewide count',()=>{
  const p=source.reportEvidence,l=source.limits;
  assert.equal(p.independentlyVerifiedUnamendedCheckboxOnPdf,0);
  assert.equal(p.historicalPublicByOnIndependentlyVerifiedCount,0);
  assert.equal(p.legallyRequired2022SenateReportDenominator,null);
  assert.equal(p.statewideOriginalFiled2022SenateReportDenominator,null);
  assert.equal(p.donorTransactionContainmentReconciledToDatabase,false);
  assert.equal(l.originalVersionZeroNotIndependentAmendmentCheckbox,true);
  assert.equal(l.earliestReleaseFloorDoesNotProveActualPublicationDate,true);
  assert.equal(l.BoardReceivedStampDoesNotProvePriorPublicAvailability,true);
  assert.equal(l['24SourcePinsAreSampleNotFull2022SenateCensus'],true);
  assert.equal(l.originalReportPdfsStoredInRepository,false);
  assert.equal(l.anyReportContentsOrDonorTextStoredInRepository,false);
  assert.equal(l.noProductionDatabaseReadsOrWrites,true);
  assert.equal(l.noForecastsOrModelTraining,true);
  assert.equal(l.issue864RemainsOpen,true);
});
