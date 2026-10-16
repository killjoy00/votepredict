import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn} from '../../src/evidence/cfb-report-availability.js';
import {SERVED_2025_YE_ORIGINAL_VERSION} from '../../src/evidence/cfb-2025-served-two-ordinary-year-end-originals.js';
import {SPECIAL_2025_SERVING_SENATORS_CONDITIONAL_DUTY_SCHEMA}
  from '../../src/evidence/cfb-2025-two-served-senators-special-yearend-conditional-duty.js';

const PREFIX='docs/evaluation/source-proof/';
const CHECKPOINT=PREFIX+'cfb-2025-two-served-senators-yearend-originals-conditional-duty-source-checkpoint.json';
const PSV=PREFIX+'cfb-2025-two-served-senators-yearend-original-pdf-ledger.psv';
const PARENT=PREFIX+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json';
const VIEWER=PREFIX+'cfb-2025-dated-senate-85-reference-versions.psv';
const REGISTRY=PREFIX+'cfb-2026-public-current-senate-registration-dates.psv';
const HASH=/^[a-f0-9]{64}$/;
function hash(s:string){return createHash('sha256').update(s,'utf8').digest('hex');}
function data(){
  return JSON.parse(readFileSync(CHECKPOINT,'utf8')) as Record<string,any>;
}
function originalRows(){
  const raw=readFileSync(PSV,'utf8');
  assert.ok(raw.endsWith('\n')&&!raw.endsWith('\n\n'));
  const canonical=raw.slice(0,-1);
  const p=data();
  assert.equal(Buffer.byteLength(canonical,'utf8'),387);
  assert.equal(hash(canonical),'6441fe9ccd02ca89706ba68ee8c344b4140983c889258ebce758a1684812eae0');
  assert.equal(hash(canonical),p.provenance.canonicalLedgerSha256WithoutFinalNewline);
  assert.equal(Buffer.byteLength(canonical,'utf8'),p.provenance.canonicalLedgerBytesWithoutFinalNewline);
  return canonical.split('\n').map(s=>{
    const t=s.split('|');
    assert.equal(t.length,11);
    const [reportId,district,sha,bytes,from,to,received,due,legalFloor,retrievedAt,cycleId]=t;
    assert.match(reportId!,/^\d+:25:pcc:YE:0:0$/);
    assert.ok(['29','47'].includes(district!));
    assert.match(sha!,HASH);
    assert.ok(Number(bytes)>=300);
    assert.equal(from,'2025-11-20');
    assert.equal(to,'2025-12-31');
    assert.equal(due,'2026-02-02');
    assert.equal(legalFloor,cfbElectronicReportAvailableOn(received!,due!));
    assert.ok(retrievedAt!.startsWith('2026-10-11T'));
    assert.match(cycleId!,/^\d+:25:pcc:YE:1:0$/);
    return {reportId,district:Number(district),sha,bytes:Number(bytes),
      from,to,received,due,legalFloor,retrievedAt,cycleId};
  });
}
test('freeze both genuine original 2026 source-run artifacts before 30-day expiration',()=>{
  const p=data();
  assert.equal(p.schemaVersion,
    'cfb-2025-actual-served-two-senators-yearend-originals-and-conditional-duty-permanent-source-checkpoint-v1');
  assert.equal(SERVED_2025_YE_ORIGINAL_VERSION,
    'cfb-2025-actual-served-senators-2-ordinary-year-end-original-pdf-proof-v1');
  assert.equal(SPECIAL_2025_SERVING_SENATORS_CONDITIONAL_DUTY_SCHEMA,
    'cfb-2025-actual-senators-2-special-yearend-conditional-duty-original-calendar-v1');
  const a=p.provenance.sourcePdfAudit,b=p.provenance.independentConditionalAudit;
  assert.equal(a.originalArtifactId,11686294025);
  assert.equal(a.exactSourceHeadSha,'ff42c2d2ecd4f31e27a435fd0f1e527b640fa92e');
  assert.equal(a.originalArtifactZipSha256,
    'cf00d3ec6cdf53b3e4cf8dc98434ed2d5bb80dc8eb2f5c1132098b3db9aadd36');
  assert.equal(a.originalMetadataJsonBytes,7314);
  assert.equal(a.originalMetadataJsonSha256,
    '76ab9f1105449277edbd1a469b21e2c58742f9b11fdb8dc418f6c487fc4f15a9');
  assert.equal(a.capturedAt,'2026-10-11T00:50:24.512Z');
  assert.equal(a.mergedImplementationCommit,'122ab348abeb841742328d8954a5a3fc05398d86');
  assert.equal(b.originalArtifactId,11687725162);
  assert.equal(b.exactSourceHeadSha,'bb6486ae525bc5139110eaee6cb557225664e92e');
  assert.equal(b.originalArtifactZipSha256,
    'ee20d71972f1fe19138108f1df313681e5242a3d084476fc56ec458d29e040fe');
  assert.equal(b.originalMetadataJsonBytes,7251);
  assert.equal(b.originalMetadataJsonSha256,
    '4a3f1cdbd1307882d048f2edb71a10ddf5c5289eb9b840a9b3b557201a398c69');
  assert.equal(b.mergedImplementationCommit,'5d040c9aacd02b54c27eebcc2bffbde26af7c73b');
  assert.equal(b.capturedAt,'2026-10-11T00:50:57.445Z');
  assert.ok([a.exactHeadFullCi,b.exactHeadFullCi].every((x:string)=>x.startsWith(
    'https://github.com/killjoy00/votepredict/actions/runs/')));
});
test('two original year-end reports source-hashed, separately bound to real served senators and prior special originals',()=>{
  const p=data(),lines=originalRows();
  const parent=JSON.parse(readFileSync(PARENT,'utf8'));
  const officialOriginals=parent.sourceOriginalReports as Array<Record<string,any>>;
  assert.equal(lines.length,2);
  assert.deepEqual(lines.map(r=>r.reportId),[
    '19229:25:pcc:YE:0:0','19233:25:pcc:YE:0:0']);
  assert.deepEqual(lines.map(r=>r.district),[29,47]);
  assert.deepEqual(lines.map(r=>r.received),['2026-02-01','2026-01-31']);
  assert.deepEqual(lines.map(r=>r.bytes),[18020,18085]);
  assert.equal(new Set(lines.map(x=>x.sha)).size,2);
  const registry=readFileSync(REGISTRY,'utf8');
  const originalViewer=readFileSync(VIEWER,'utf8');
  for(const [i,row] of lines.entries()){
    const item=p.actualServedSenatorSourceReports[i];
    assert.equal(item.originalYearEndReportId,row.reportId);
    assert.equal(item.originalPdfSha256,row.sha);
    assert.equal(item.pdfBytes,row.bytes);
    assert.equal(item.originalPdfRetrievedAt,row.retrievedAt);
    assert.equal(item.yearEndPeriodStartOn,row.from);
    assert.equal(item.yearEndPeriodEndOn,row.to);
    assert.equal(item.boardReceivedOn,row.received);
    assert.equal(item.calendarDueOn,row.due);
    assert.equal(item.conservativeLegalAndReceiptNotBeforeOn,row.legalFloor);
    assert.equal(item.specialCycleFinalReportId,row.cycleId);
    assert.equal(item.specialFinalPeriodEndOn,'2025-11-19');
    assert.equal(item.coverageContiguous,true);
    assert.match(item.originalPdfSha256,HASH);
    assert.match(item.specialCycleFinalOriginalPdfSha256,HASH);
    assert.match(item.originalViewerApiSha256,HASH);
    assert.equal(item.terminationReportCheckboxIndependentlyVerified,null);
    assert.equal(item.yearEndLegallyOwed,null);
    assert.equal(item.exactHistoricalPublicByOn,null);
    assert.equal(item.forecastEligible,false);
    assert.equal(item.independent2025EffectiveRegistrationProved,false);
    const parentItem=officialOriginals.find(x=>x.registrationNumber===item.registrationNumber);
    assert.ok(parentItem);
    assert.equal(item.person,parentItem!.senator);
    assert.equal(item.district,parentItem!.district);
    assert.equal(item.specialCycleFinalOriginalPdfSha256,parentItem!.originalPdfBinarySha256);
    assert.ok(registry.includes(item.registrationNumber+'|'+item.october2026CurrentRegistryReportedRegistrationOn+'|'));
    const old=originalViewer.split('\n').find(x=>x.startsWith(item.registrationNumber+'|'));
    assert.ok(old);
    assert.ok(old!.split('|')[2]!.split(',').includes('YE0.0'));
    assert.equal(old!.split('|')[1],item.originalViewerApiSha256);
  }
});
test('all original official 2025 calendars establish conditional year-end with exact due date, not unconditional obligation',()=>{
  const p=data(),c=p.officialSources;
  const general=c.originalGeneralDisclosureCalendar;
  assert.equal(general.pdfSha256,'008ed4221d1c660c388023b10fe9159e3ece90d880c422c0d6dddff74dea0d37');
  assert.equal(general.pdfBytes,100283);
  assert.equal(general.yearEnd2025DueOn,'2026-02-02');
  assert.equal(general.originalYearendSourceRunRetrievedAt,'2026-10-11T00:50:19.059Z');
  assert.equal(general.conditionalRuleRunRetrievedAt,'2026-10-11T00:50:55.038Z');
  assert.deepEqual(c.specialDisclosureCalendars.map((x:any)=>x.district),[29,47]);
  for(const spec of c.specialDisclosureCalendars){
    assert.equal(spec.exactYearEndUnlessTerminationClauseVerified,true);
    assert.match(spec.pdfSha256,HASH);
    assert.ok(spec.retrievedAt.startsWith('2026-10-11'));
    assert.ok(spec.pdfBytes>500);
    const item=p.actualServedSenatorSourceReports.find((x:any)=>x.district===spec.district);
    assert.ok(item);
  }
  for(const s of [c.originalActualSenateServicePdfRun,c.independentConditionalRuleRun]){
    assert.match(s.directorySha256,HASH);
    assert.match(s.swearingSha256,HASH);
    assert.equal(s.directoryBytes,1601232);
    assert.equal(s.swearingBytes,330790);
    assert.ok(s.directoryRetrievedAt.startsWith('2026-10-11T'));
    assert.ok(s.swearingRetrievedAt.startsWith('2026-10-11T'));
  }
  const z=p.scopeAndLimits;
  assert.equal(z.sourcedActualSenatorsCount,2);
  assert.equal(z.newAuthenticatedOriginalYearEndPdfCount,2);
  assert.equal(z.independentSpecialCalendarTerminationExceptionClausesVerified,2);
  assert.equal(z.previouslyAuthenticatedSpecialFinalOriginalPdfsCountedAgain,0);
  assert.equal(z.historicallyEffectiveRegistrationIndependentlyEstablished,0);
  assert.equal(z.terminationCheckboxOrTerminationsIndependentlyEstablished,0);
  assert.equal(z.legallyOwed2025YearEndReportCount,null);
  assert.equal(z.statewideLegallyOwedReportDenominator,null);
  assert.equal(z.independentHistoricalPublicByCount,0);
  assert.equal(z.sourceToProductionDbReconciled,false);
  assert.equal(z.issue864MustStayOpen,true);
});
