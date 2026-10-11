import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const SOURCE='docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-source-checkpoint.json';
const LEDGER='docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv';
const PRIOR='docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv';
const REG_INDEX='docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const originalSha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const checkpoint=JSON.parse(readFileSync(SOURCE,'utf8'));
const raw=readFileSync(LEDGER,'utf8');
const lines=raw.trimEnd().split('\n');
const originalIds=new Set(readFileSync(PRIOR,'utf8').trim().split('\n')
  .map(row=>row.split('|')[0]!));
const apiRows=readFileSync(REG_INDEX,'utf8').split('\n');
const rows=lines.map(line=>{
  const [id,name,election,printed,sha,bytes,start,end,received,due,floor,...extra]=line.split('|');
  assert.equal(extra.length,0,'No data columns beyond allowlisted report provenance');
  return {id:id!,name:name!,election:Number(election),printed:Number(printed),
    sha:sha!,bytes:Number(bytes),start:start!,end:end!,received:received!,
    due:due!,floor:floor!};
});

test('official source checkpoint preserves exact final 2022 source and independent duplicate hash run',()=>{
  const primary=checkpoint.mergedSourceAcquisition, prior=checkpoint.independentlyMatchingOriginalSourceRun;
  assert.equal(checkpoint.schemaVersion,'cfb-2022-served-sd13-24-22-original-ce-permanent-source-proof-v1');
  assert.equal(primary.pr,1012);
  assert.equal(primary.mergeCommit,'794054d02b115d2ea48e15ad2eb862e2476120c2');
  assert.equal(primary.finalImplementationHead,'46df80025905f39376ba1f6026ea2ddd931de069');
  assert.equal(primary.fullCiRunId,38108141165);
  assert.equal(primary.fullCiConclusion,'success');
  assert.equal(primary.sourceWorkflowRunId,38108141175);
  assert.equal(primary.sourceWorkflowAttempt,2);
  assert.equal(primary.sourceWorkflowConclusion,'success');
  assert.equal(primary.sourceArtifactId,11691465004);
  assert.equal(primary.artifactZipSha256,'985e6ff423ea9b7ddbb649f128d9d7dec873352f88d681c4ca7c6b22bd9e4398');
  assert.equal(primary.artifactJsonSha256,'f9c37d0eb60d57f4dac8ee2f4df0d8f0a0d61df4c2a7b5f2ed2ab327b1df253f');
  assert.equal(primary.artifactJsonBytes,73677);
  assert.equal(prior.sourceWorkflowRunId,38107882680);
  assert.equal(prior.sourceArtifactId,11690660273);
  assert.equal(prior.artifactJsonSha256,'daf13482159ebc0f56a0bfcebc3e59a5cca04310e2f62fd001cf56c0fada1c81');
  assert.equal(prior.all22OriginalPdfSha256sAndIdentitiesMatchFinalSuccess,true);
  assert.equal(prior.artifactJsonBytes,primary.artifactJsonBytes);
  assert.ok(primary.observedAt.startsWith('2026-10-11T'));
  assert.ok(prior.observedAt.startsWith('2026-10-11T'));
});

test('22 original binary hashes, source dates, legal-release floors and no duplicate first-cohort reports',()=>{
  const m=checkpoint.verifiedReportMetadata;
  assert.ok(raw.endsWith('\n'));
  assert.equal(originalSha(raw),m.ledgerWithTerminalLinefeedSha256);
  assert.equal(originalSha(raw.slice(0,-1)),m.ledgerCanonicalWithoutTerminalLinefeedSha256);
  assert.equal(originalSha(raw.slice(0,-1)),'cae761dacf3dfaa5403f859e8fe5de38bf9a3759dd974f2822d9524ebfa3887b');
  assert.equal(Buffer.byteLength(raw.slice(0,-1)),3663);
  assert.equal(m.ledgerBytesWithoutTerminalLinefeed,3663);
  assert.equal(m.verifiedNewOriginalReportPdfCount,22);
  assert.equal(rows.length,22);
  assert.equal(new Set(rows.map(r=>r.id)).size,22);
  assert.equal(new Set(rows.map(r=>r.sha)).size,22);
  assert.equal(originalIds.size,24);
  assert.equal(rows.filter(r=>r.id.split(':')[3]==='C').length,11);
  assert.equal(rows.filter(r=>r.id.split(':')[3]==='E').length,11);
  assert.ok(rows.every(r=>!originalIds.has(r.id)));
  for(const r of rows){
    assert.match(r.id,/^\d{3,8}:22:pcc:[CE]:0:0$/);
    assert.ok(Number.isInteger(r.election)&&r.election>=14&&r.election<=24);
    assert.ok(Number.isInteger(r.printed)&&r.printed>=1&&r.printed<=67);
    assert.match(r.sha,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(r.bytes)&&r.bytes>500);
    assert.ok(r.name.length>=5&&!r.name.includes('@'));
    assert.equal(r.start,'2022-01-01');
    const c=r.id.split(':')[3]==='C';
    assert.equal(r.end,c?'2022-07-18':'2022-10-24');
    assert.equal(r.due,c?'2022-07-25':'2022-10-31');
    assert.equal(r.floor,c?'2022-07-26':'2022-11-01');
    assert.ok(r.received>=r.end&&r.received<=r.due);
  }
  assert.equal(m.prePrimaryC,11);
  assert.equal(m.preGeneralE,11);
  assert.equal(m.sourceAcquisitionFailures,0);
  assert.equal(m.earlyHistoricalPublicByIndependentlyVerified,0);
  assert.equal(m.legalFilingObligationDenominator,null);
  assert.equal(m.sourceToFinancialRowsReconciled,false);
});

test('every senator, 2022 registration and original CFB API PDF-version reference is source-pinned',()=>{
  const regs=checkpoint.pinnedOriginalRegistrationApiAndDistrictSources as Array<{
    registrationNumber:string;senateElectionDistrict:number;
    originalCfbReportsTabApiSha256:string;official2022CfbDistrictRosterHtmlSha256:string;
  }>;
  assert.equal(regs.length,11);
  assert.equal(new Set(regs.map(r=>r.registrationNumber)).size,11);
  assert.equal(new Set(regs.map(r=>r.senateElectionDistrict)).size,11);
  assert.equal(new Set(rows.map(r=>r.id.split(':')[0])).size,11);
  for(const r of regs){
    assert.match(r.originalCfbReportsTabApiSha256,/^[0-9a-f]{64}$/);
    assert.match(r.official2022CfbDistrictRosterHtmlSha256,/^[0-9a-f]{64}$/);
    const related=rows.filter(x=>x.id.split(':')[0]===r.registrationNumber);
    assert.equal(related.length,2);
    assert.ok(related.every(x=>x.election===r.senateElectionDistrict));
    assert.equal(related[0]!.name,related[1]!.name);
    const api=apiRows.find(x=>x.startsWith('2022|'+r.registrationNumber+'|'));
    assert.ok(api,'Every source registration must appear in permanent 2022 viewer');
    const bits=api!.split('|');
    assert.equal(bits[2],r.originalCfbReportsTabApiSha256);
    assert.ok(bits[3]?.includes('22:pcc:C:0:0'));
    assert.ok(bits[3]?.includes('22:pcc:E:0:0'));
  }
  const older=rows.filter(r=>r.election!==r.printed);
  assert.equal(older.length,12);
  assert.equal(new Set(older.map(r=>r.name)).size,6);
  assert.equal(checkpoint.verifiedReportMetadata.originalPdfsPrintingIndependentlyVerifiedPriorDistrict,12);
  assert.equal(checkpoint.verifiedReportMetadata.sixRedistrictedSenatorsPrintDifferent2022District,true);
});

test('official original source times and retrospective publication uncertainty retained',()=>{
  const src=checkpoint.originalGovernmentSources;
  assert.equal(src.secretaryOfState2022GeneralSha256,'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74');
  assert.equal(src.calendarPdfSha256,'3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25');
  assert.match(src.lrlSenateServiceSha256,/^[a-f0-9]{64}$/);
  assert.ok(src.lrlObservedAt.startsWith('2026-10-11T'));
  assert.ok(src.sosObservedAt.startsWith('2026-10-11T'));
  assert.ok(src.calendarPdfObservedAt.startsWith('2026-10-11T'));
  assert.equal(checkpoint.unresolved.district13CFBCandidateRegistrationJoin,'unknown');
  assert.equal(checkpoint.unresolved.district13NotAProvenNonfiler,true);
  assert.equal(checkpoint.unresolved.statewideLegallyRequiredOriginalReportCount,null);
  assert.equal(checkpoint.unresolved.statewideActuallyFiledOriginalReportCount,null);
  assert.equal(checkpoint.unresolved.independentlyProvenHistoricalPublicByForTheseReports,null);
  assert.equal(checkpoint.unresolved.authorizedHistoricalForecastEligibility,false);
  assert.equal(checkpoint.safeguards.reportPdfBodiesStored,false);
  assert.equal(checkpoint.safeguards.rawDonorOrTransactionDataStored,false);
  assert.equal(checkpoint.safeguards.neverServedCandidateNamesStored,false);
  assert.equal(checkpoint.safeguards.productionDbReadOrWritten,false);
  assert.equal(checkpoint.safeguards.issue864ShouldRemainOpen,true);
});
