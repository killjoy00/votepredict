import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {cfbElectronicReportAvailableOn} from '../../src/evidence/cfb-report-availability.js';
import {
  SERVED_2025_SPECIAL_FINAL_VERSION,
} from '../evidence/cfb-2025-served-special-final-pdf-proof.js';
const ROOT='docs/evaluation/source-proof/';
const LEDGER=ROOT+'cfb-2025-served-senators-2-special-cycle-final-original-pdf-ledger.psv';
const PROOF=ROOT+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json';
const HASH=/^[0-9a-f]{64}$/;
function sha(s:string){return createHash('sha256').update(s,'utf8').digest('hex');}
function checkpoint(){return JSON.parse(readFileSync(PROOF,'utf8')) as Record<string,any>;}
function records(){
  const p=checkpoint();
  const body=readFileSync(LEDGER,'utf8');
  assert.ok(body.endsWith('\n')&&!body.endsWith('\n\n'));
  const canonical=body.slice(0,-1);
  assert.equal(Buffer.byteLength(canonical),347);
  assert.equal(sha(canonical),'81cadcfa091408bfc0a5195c95979f7759c012827e4ad31b307140c5f9ae2f0e');
  assert.equal(sha(canonical),p.provenance.permanentLedgerCanonicalSha256WithoutFinalNewline);
  const rows=canonical.split('\n').map(line=>{
    const x=line.split('|');
    assert.equal(x.length,10);
    const [id,dist,pdfSha,bytes,start,end,received,due,floor,fetchedAt]=x;
    assert.match(id!,/^\d+:25:pcc:YE:1:0$/);
    assert.match(pdfSha!,HASH);
    assert.ok(Number(bytes)>300);
    assert.ok(Date.parse(fetchedAt!)>=Date.parse('2026-10-10'));
    assert.equal(end,'2025-11-19');
    assert.equal(due,'2025-12-01');
    assert.equal(floor,cfbElectronicReportAvailableOn(received!,due!));
    return {id,dist:Number(dist),pdfSha,bytes:Number(bytes),start,end,received,due,floor,fetchedAt};
  });
  return rows;
}
test('exact 2 genuine 2026 original PDF source identities pinned permanently, not viewer links',()=>{
  const p=checkpoint(),rows=records();
  assert.equal(p.schemaVersion,'cfb-2025-ever-served-senators-2-special-final-original-pdf-source-checkpoint-v1');
  assert.equal(SERVED_2025_SPECIAL_FINAL_VERSION,'cfb-2025-two-ever-served-senators-special-final-pdf-v1');
  assert.equal(p.provenance.sourceRunId,38098411551);
  assert.equal(p.provenance.exactSourceWorkflowHeadSha,'0799021d9bd6de46037a90ccc8dccdd3580ebca5');
  assert.equal(p.provenance.mergedImplementationCommit,'215e5e9031d1d5c3394be9d14ff36f6b486109ae');
  assert.equal(p.provenance.originalSourceArtifactId,11686332476);
  assert.equal(p.provenance.originalArtifactZipSha256,'6c3925b268ae4c65fc91e86a7c1bd092b5d8d7f79ffc78d7b77878a2ad4752e3');
  assert.equal(p.provenance.originalUncompressedMetadataJsonSha256,'00b2a6bada009ca90523a1c7eee43796e6e695f87e9a554db3e60613dfcf29ca');
  assert.equal(p.provenance.originalUncompressedMetadataJsonBytes,7536);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.id),['19229:25:pcc:YE:1:0','19233:25:pcc:YE:1:0']);
  assert.deepEqual(rows.map(r=>r.dist),[29,47]);
  assert.deepEqual(rows.map(r=>r.bytes),[35024,38474]);
  assert.equal(new Set(rows.map(r=>r.pdfSha)).size,2);
  const reports=p.sourceOriginalReports;
  assert.equal(reports.length,2);
  rows.forEach((r,i)=>{
    const x=reports[i]!;
    assert.equal(x.reportId,r.id);
    assert.equal(x.originalPdfBinarySha256,r.pdfSha);
    assert.equal(x.bytes,r.bytes);
    assert.equal(x.pdfFetchedAt,r.fetchedAt);
    assert.equal(x.coverageStartOn,r.start);
    assert.equal(x.coverageEndOn,r.end);
    assert.equal(x.boardReceivedOn,r.received);
    assert.equal(x.calendarDueOn,r.due);
    assert.equal(x.legallyPossibleNotBeforeOn,r.floor);
    assert.equal(x.independentHeaderRegistrationOfficePeriodReceivedVerified,true);
    assert.equal(x.viewerApiHashUnchanged,true);
    assert.equal(x.independentlyProvenHistoricalPublicByOn,null);
    assert.equal(x.eligibleForHistoricalAsOf,false);
    assert.equal(x.exactRequiredDutyPredicateVerified,false);
    assert.match(x.originalViewerApiSha256,HASH);
    assert.match(x.officialCFBDistrictRosterSha256,HASH);
    assert.ok(x.sourceReportPdfUrl.startsWith('https://cfb.mn.gov/rptViewer/Main.php?'));
  });
  assert.equal(p.sourceSummary.newlyAuthenticatedOriginalPdfVersionsBeyondPrevious2025Cohorts,2);
  assert.equal(p.sourceSummary.historicalPublicByVerified,0);
  assert.equal(p.sourceSummary.originalVersionViewerKeyDoesNotGuaranteePdfAmendmentCheckbox,true);
  assert.equal(p.sourceSummary.thisCohortLegallyRequiredReportCount,null);
  assert.equal(p.sourceSummary.statewideLegallyRequiredReportDenominator,null);
});
test('official original LRL service and two 2025 disclosure calendar sources are pinned, with 2026 observation dates',()=>{
  const p=checkpoint();
  const s=p.sourceService;
  assert.equal(s.senateServiceUrl,'https://www.lrl.mn.gov/legdb/senate_dir');
  assert.equal(s.senateSwearingUrl,'https://www.lrl.mn.gov/history/caucus?body=s');
  assert.match(s.senateServiceSha256,HASH);
  assert.match(s.senateSwearingSha256,HASH);
  assert.ok(s.senateServiceBytes>9000&&s.senateSwearingBytes>9000);
  assert.ok(s.senateServiceObservedAt.startsWith('2026-10-11T'));
  assert.ok(s.senateSwearingObservedAt.startsWith('2026-10-11T'));
  assert.equal(s.originalHistoricPublicationOfLRLPageProven,false);
  const c=p.sourceCalendars;
  assert.deepEqual(c.map((x:any)=>x.district),[29,47]);
  assert.equal(new Set(c.map((x:any)=>x.pdfSha256)).size,2);
  assert.ok(c.every((x:any)=>x.calendarIdentityAndExactCycleFinalDueDateVerified===true
    &&x.dueOn==='2025-12-01'&&x.lastTransactionDate==='2025-11-19'
    &&x.pdfSha256&&HASH.test(x.pdfSha256)
    &&x.url==='https://cfb.mn.gov/pdf/calendars/2025_special_election_'+x.district+'.pdf'));
  assert.equal(p.sourceSummary.sourceFailures,0);
  assert.equal(p.sourceSummary.exactOriginalReportPdfBinaryAndFirstPageVerified,2);
  assert.equal(p.sourceSummary.exactIndependentSpecialCalendarOriginalPdfsVerified,2);
  assert.equal(p.sourceSummary.originalPdfBytesOrDonorsStored,false);
  assert.equal(p.sourceSummary.modelOrProductionDataChanged,false);
  assert.equal(p.sourceSummary.issue864RemainsOpen,true);
});
