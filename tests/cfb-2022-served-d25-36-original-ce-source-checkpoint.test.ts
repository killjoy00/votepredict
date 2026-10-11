import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn}
  from '../src/evidence/cfb-report-availability.js';

const ROOT='docs/evaluation/source-proof/';
const checkpoint=JSON.parse(readFileSync(
  ROOT+'cfb-2022-served-d25-36-original-ce-source-checkpoint.json','utf8'));
const raw=readFileSync(ROOT+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8');
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const rows=raw.trimEnd().split('\n').map(line=>{
  const a=line.split('|');
  assert.equal(a.length,12,'Only source-version metadata columns are retained');
  const [id,name,ballot,printed,binary,size,start,end,received,due,floor,runTime]=a;
  return {id:id!,name:name!,ballot:Number(ballot),printed:Number(printed),
    binary:binary!,size:Number(size),start:start!,end:end!,received:received!,
    due:due!,floor:floor!,runTime:runTime!};
});
const priorIds=new Set([
  ...readFileSync(ROOT+'cfb-2022-senate-24-original-ce-pdf-headers.psv','utf8').trim().split('\n'),
  ...readFileSync(ROOT+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8').trim().split('\n'),
].map(line=>line.split('|')[0]!));
const api=new Map(readFileSync(ROOT+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8')
  .split('\n').filter(v=>v.startsWith('2022|')).map(line=>{
    const a=line.split('|');
    return [a[1]!,{sha:a[2]!,reportKeys:new Set((a[3]??'').split(','))}];
  }));

test('22 original 2022 source PDF binaries match permanent PSV fingerprint, byte size and exact official source job',()=>{
  assert.equal(checkpoint.schemaVersion,'cfb-2022-served-sd25-36-22-original-ce-pdf-source-checkpoint-v1');
  assert.ok(raw.endsWith('\n'));
  assert.equal(Buffer.byteLength(raw),4230);
  assert.equal(sha(raw),'263c1b27b425f67332eacdf855e4ae7f7300d111b2330d0a259d239cfea9050c');
  assert.equal(checkpoint.verifiedReports.ledgerUtf8Sha256,sha(raw));
  assert.equal(checkpoint.verifiedReports.ledgerBytes,4230);
  assert.equal(rows.length,22);
  assert.equal(new Set(rows.map(r=>r.id)).size,22);
  assert.equal(new Set(rows.map(r=>r.binary)).size,22);
  assert.equal(new Set(rows.map(r=>r.name)).size,11);
  const source=checkpoint.originalSourceRun;
  assert.equal(source.acquisitionPr,1048);
  assert.equal(source.acquisitionHead,'b464d7ee98477c155ca721e9c52a5470b51f0ffc');
  assert.equal(source.mergedCommit,'ffbb1a0787c8be1f4b4607445b2a3114c9f5cabd');
  assert.equal(source.exactHeadFullCiRunId,38111883321);
  assert.equal(source.fullCiConclusion,'success');
  assert.equal(source.originalSourceRunId,38111883336);
  assert.equal(source.originalSourceConclusion,'success');
  assert.equal(source.artifactId,11690714984);
  assert.equal(source.artifactZipSha256,'6267bb1de4ada57194ae11e2e84f2b9b8aed363388c8292660becfecce3be75e');
  assert.equal(source.artifactZipBytes,6991);
  assert.equal(source.artifactJsonSha256,'f3d10429584314098683e3764cfe9cf999dc0ba6c0a729bda4888ef607150d5c');
  assert.equal(source.artifactJsonBytes,73609);
  assert.equal(source.sourceResultCompletedAtUtc,'2026-10-11T04:33:05.735Z');
});

test('verified 11 real senator CFB registrations have exact source API and roster SHA; district 31 is a hold',()=>{
  const verified=checkpoint.actualServedSenators as Array<{
    district:number;officialName:string;registrationNumber:string;
    officialDistrictRosterHtmlSha256:string;originalCfBReportsTabApiSha256:string;
  }>;
  assert.equal(verified.length,11);
  assert.equal(new Set(verified.map(x=>x.registrationNumber)).size,11);
  const expected=[25,26,27,28,29,30,32,33,34,35,36];
  assert.deepEqual(verified.map(x=>x.district),expected);
  for(const senator of verified){
    assert.match(senator.officialDistrictRosterHtmlSha256,/^[0-9a-f]{64}$/);
    assert.match(senator.originalCfBReportsTabApiSha256,/^[0-9a-f]{64}$/);
    const selected=rows.filter(r=>r.id.startsWith(senator.registrationNumber+':'));
    assert.equal(selected.length,2);
    assert.ok(selected.every(r=>r.name===senator.officialName&&r.ballot===senator.district));
    assert.deepEqual(selected.map(r=>r.id.split(':')[3]),['C','E']);
    const originalApi=api.get(senator.registrationNumber);
    assert.equal(originalApi?.sha,senator.originalCfBReportsTabApiSha256);
    assert.ok(originalApi?.reportKeys.has('22:pcc:C:0:0'));
    assert.ok(originalApi?.reportKeys.has('22:pcc:E:0:0'));
  }
  assert.equal(checkpoint.excludedDistrict31.district,31);
  assert.equal(checkpoint.excludedDistrict31.reason,'single_original_cfb_registration_identity_unresolved');
  assert.equal(checkpoint.excludedDistrict31.proofOfNonfiler,false);
  assert.ok(rows.every(r=>r.ballot!==31));
});

test('original PDF period, due date, Board receipt, conservative publication floor and no historical public-by are exact',()=>{
  assert.equal(priorIds.size,46);
  assert.equal(rows.filter(r=>r.id.split(':')[3]==='C').length,11);
  assert.equal(rows.filter(r=>r.id.split(':')[3]==='E').length,11);
  for(const r of rows){
    assert.match(r.id,/^\d{4,8}:22:pcc:[CE]:0:0$/);
    assert.ok(!priorIds.has(r.id),'New source study may not double-count previously authenticated original PDF');
    assert.match(r.binary,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(r.size)&&r.size>300);
    assert.equal(r.start,'2022-01-01');
    const c=r.id.split(':')[3]==='C';
    assert.equal(r.end,c?'2022-07-18':'2022-10-24');
    assert.equal(r.due,c?'2022-07-25':'2022-10-31');
    assert.ok(r.received>=r.end);
    assert.equal(r.floor,cfbElectronicReportAvailableOn(r.received,r.due));
    assert.equal(r.runTime,checkpoint.originalSourceRun.sourceResultCompletedAtUtc);
    assert.ok(r.runTime.startsWith('2026-10-11T'));
  }
  assert.equal(checkpoint.verifiedReports.verifiedOriginalReportPdfCount,22);
  assert.equal(checkpoint.verifiedReports.verifiedDistinctSenators,11);
  assert.equal(checkpoint.verifiedReports.sourceFailures,0);
  assert.equal(checkpoint.verifiedReports.independentlyVerifiedActualHistoricalPublicBy,0);
  assert.equal(checkpoint.verifiedReports.originalAcquisitionTimeIsBoundedByRunObservedAtNotIndividuallyReported,true);
});
test('pre-redistricting office on four originals belongs only to originally independently verified senators',()=>{
  const older=rows.filter(r=>r.ballot!==r.printed);
  assert.equal(older.length,4);
  assert.deepEqual([...new Set(older.map(r=>r.name))],['Mark W. Koran','Karin Housley']);
  assert.deepEqual([...new Set(older.map(r=>r.printed))],[32,39]);
  assert.equal(checkpoint.verifiedReports.differentEarlierPrintedDistrictPdfs,4);
});

test('independent CFB/SOS/LRL source hashes and unresolved historical finance completeness remain separate',()=>{
  const o=checkpoint.pinnedOfficialSources;
  assert.equal(o.sos2022General.sha256,'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74');
  assert.equal(o.independentCfb2022Calendar.sha256,'3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25');
  assert.equal(o.lrlSenateService.sha256,'79657e3f9b0287dc950abd3bd42801c49c4cd01e77e96604db86136fe09db844');
  assert.ok(o.sos2022General.observedAt.startsWith('2026-10-11T'));
  assert.ok(o.lrlSenateService.observedAt.startsWith('2026-10-11T'));
  assert.equal(checkpoint.unresolved.statewideRequiredReportDenominator,null);
  assert.equal(checkpoint.unresolved.actuallyFiledReportDenominator,null);
  assert.equal(checkpoint.unresolved.originalReportHistoricalPublicBy,null);
  assert.equal(checkpoint.unresolved.sourceToFinancialDatabaseRowsChecked,false);
  assert.equal(checkpoint.unresolved.historicalForecastEligibility,false);
  assert.equal(checkpoint.safeguards.rawPdfsStored,false);
  assert.equal(checkpoint.safeguards.donorsOrFinancialTransactionContentsStored,false);
  assert.equal(checkpoint.safeguards.neverServedCandidateNamesStored,false);
  assert.equal(checkpoint.safeguards.productionDatabaseReadOrWritten,false);
  assert.equal(checkpoint.safeguards.issue864RemainsOpen,true);
});
