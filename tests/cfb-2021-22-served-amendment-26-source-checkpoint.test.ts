import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn}
  from '../src/evidence/cfb-report-availability.js';

const P='docs/evaluation/source-proof/';
const proof=JSON.parse(readFileSync(P+'cfb-2021-22-served-amendment-26-source-checkpoint.json','utf8'));
const psv=readFileSync(P+'cfb-2021-22-served-amendment-26-pdf-source.psv','utf8');
const ce=readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8');
const ye=readFileSync(P+'cfb-2021-22-served-11-20-original-ye-pdf-proof.psv','utf8');
const originalReports=new Map([...ce.trimEnd().split('\n').map(r=>r.split('|')),
  ...ye.trimEnd().split('\n').map(r=>r.split('|'))]
  .map(p=>[p[0]!,{name:p[1]!,ballotDistrict:Number(p[2]),
    originalPrintedDistrict:Number(p[3]),sha:p[4]!,
    receivedOn:p[p.length===11?8:9]!,dueOn:p[p.length===11?9:10]!}]));
const expectedKeys=new Map(readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8')
  .split('\n').filter(v=>v.startsWith('2022|'))
  .map(line=>{const a=line.split('|');return [a[1]!,new Set((a[3]??'').split(','))]}));
const rows=psv.trimEnd().split('\n').map(line=>{
  const a=line.split('|');
  assert.equal(a.length,9);
  const [id,parent,hash,size,received,printed,observed,floor,status]=a;
  return {id:id!,parent:parent!,hash:hash!,size:Number(size),
    received:received!,printed:printed!,observed:observed!,
    floor:floor!,status:status!};
});
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');

test('permanent original CFB artifact ZIP and JSON dates/hashes correspond to exact successful source-only PR head',()=>{
  const a=proof.originalSourceAcquisition;
  assert.equal(proof.schemaVersion,'cfb-2021-22-11-actual-senators-26-amendment-pdf-source-checkpoint-v1');
  assert.equal(a.mergedPr,1030);
  assert.equal(a.mergedCommit,'3e8f76823ad307c979fa3eca9ef20b04b3e7c28f');
  assert.equal(a.exactSourceImplementationHead,'3b921279c9d01cd1a5eef46156bf4590e2ce0c1a');
  assert.equal(a.exactHeadCiRun,38110090069);
  assert.equal(a.exactHeadCiConclusion,'success');
  assert.equal(a.exactHeadOfficialSourceRun,38110090051);
  assert.equal(a.officialSourceConclusion,'success_with_one_documentary_hold');
  assert.equal(a.artifactId,11691073805);
  assert.equal(a.sourceArtifactZipSha256,'ebe280d2560cfa5e4a1093aab4eaf2bba2dc1acebc17eadfc5edf24d094e4931');
  assert.equal(a.zipBytes,8925);
  assert.equal(a.sourceJsonSha256,'046c78504a1c2d0196d23b7acac1f57c281d1852e5522749d01b8f7a8d64aa3b');
  assert.equal(a.jsonBytes,83581);
  assert.ok(a.originalSourceObservedAt.startsWith('2026-10-11T'));
});
test('three independent live official source observations match all 26 SHA256s without claiming 26 report headers',()=>{
  const o=proof.independentSourceObservationsMatchingEveryVersion;
  assert.equal(o.distinctRuns,3);
  assert.equal(o.all26OriginalPdfBinaryHashesAndBytesIdenticalAcrossAllThree,true);
  assert.equal(o.all26OriginalPdfBoardReceiptOutcomesIdenticalAcrossAllThree,true);
  assert.deepEqual(o.observations.map((x:{run:number})=>x.run),
    [38109788636,38109917993,38110090051]);
  assert.deepEqual(o.observations.map((x:{successfulStrictlyVerifiedReports:number})=>
    x.successfulStrictlyVerifiedReports),[25,25,25]);
  for(const r of o.observations){
    assert.match(r.zipSha256,/^[0-9a-f]{64}$/);
    assert.match(r.jsonSha256,/^[0-9a-f]{64}$/);
    assert.ok(r.jsonBytes>60000);
    assert.ok(r.observedAt.startsWith('2026-10-11T'));
  }
});
test('all 26 permanent first-party amendment PDF binary proofs join to 42 previously authenticated originals',()=>{
  const m=proof.permanentNonSensitiveLedger;
  assert.equal(psv.endsWith('\n'),true);
  assert.equal(Buffer.byteLength(psv,'utf8'),4321);
  assert.equal(m.bytes,4321);
  assert.equal(sha(psv),'293dcebac622da4ccaa4a5c9ccc3f067ecd9bea005a3b472bcf48856c3fb5891');
  assert.equal(sha(psv),m.sha256);
  assert.equal(rows.length,26);
  assert.equal(originalReports.size,42);
  assert.equal(new Set(rows.map(r=>r.id)).size,26);
  assert.equal(new Set(rows.map(r=>r.hash)).size,26);
  assert.equal(new Set(rows.map(r=>r.id.split(':')[0])).size,11);
  assert.equal(rows.filter(r=>r.status==='AUTH').length,25);
  assert.equal(rows.filter(r=>r.status==='HOLD_HEADER').length,1);
  const categories:Record<string,number>={};
  for(const r of rows){
    assert.match(r.id,/^\d{4,8}:(21|22):pcc:(C|E|YE):0:[12]$/);
    const a=r.id.split(':');
    assert.equal(r.parent,a.slice(0,5).join(':')+':0');
    const prior=originalReports.get(r.parent);
    assert.ok(prior,'Parent version must exist and have an original-source PDF');
    assert.match(r.hash,/^[a-f0-9]{64}$/);
    assert.notEqual(r.hash,prior!.sha);
    assert.ok(Number.isInteger(r.size)&&r.size>=300);
    assert.match(r.observed,/^2026-10-11T\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(expectedKeys.get(a[0]!)?.has(a.slice(1).join(':')),
      'Exact amendment version must have existed in pinned official CFB viewer');
    categories[a[1]+':'+a[3]]=(categories[a[1]+':'+a[3]]??0)+1;
    if(r.status==='AUTH'){
      assert.match(r.received,/^20\d\d-\d\d-\d\d$/);
      assert.ok(r.received>=prior!.receivedOn);
      assert.ok(r.printed===String(prior!.ballotDistrict)
        ||r.printed===String(prior!.originalPrintedDistrict));
      assert.equal(r.floor,cfbElectronicReportAvailableOn(r.received,prior!.dueOn));
    }else{
      assert.equal(r.status,'HOLD_HEADER');
      assert.equal(r.received,'-');
      assert.equal(r.printed,'-');
      assert.equal(r.floor,'-');
    }
  }
  assert.deepEqual(categories,{'21:YE':10,'22:YE':12,'22:E':2,'22:C':2});
});
test('report revision receipt ordering is proven when both amendment versions have authentic headers',()=>{
  const groups=new Map<string,typeof rows>();
  for(const r of rows){
    const a=groups.get(r.parent)??[];
    a.push(r);groups.set(r.parent,a);
  }
  for(const group of groups.values()){
    group.sort((a,b)=>Number(a.id.split(':').at(-1))-Number(b.id.split(':').at(-1)));
    const seen=new Set<string>();
    let previousReceipt='';
    for(const r of group){
      assert.ok(!seen.has(r.hash));
      seen.add(r.hash);
      if(r.status==='AUTH'){
        if(previousReceipt)assert.ok(r.received>=previousReceipt);
        previousReceipt=r.received;
      }else{
        assert.equal(r.id,'18430:21:pcc:YE:0:1');
        previousReceipt='';
      }
    }
  }
  assert.equal(proof.result.amendmentRevisionChainsFullyVerified,false);
});
test('one and only one exact Aric Putnam source-document hold remains unresolved',()=>{
  const h=proof.heldDocument;
  assert.equal(h.id,'18430:21:pcc:YE:0:1');
  assert.equal(h.person,'Aric Putnam');
  assert.equal(h.originalReportId,'18430:21:pcc:YE:0:0');
  assert.equal(h.heldPdfSha256,'7529ad0bf417548f1617d2bb2b74e5115855844df4a979fdbb6ad3e5e6420acf');
  assert.equal(h.heldPdfBytes,128524);
  assert.equal(h.extractedTextChars,1836);
  assert.equal(h.hasPrincipalCampaignTitle,false);
  assert.equal(h.hasSenateDistrictLabel,false);
  assert.equal(h.hasRegistrationLabel,false);
  assert.equal(h.hasPeriodCoveredLabel,false);
  assert.equal(h.hasBoardReceiptStamp,false);
  assert.equal(h.verifiedAmendedReportReceiptOn,null);
  assert.equal(h.confirmedOriginalFinancialReportForm,false);
  assert.equal(h.completeVersion1ToVersion2ChainAuthenticated,false);
  assert.equal(rows.find(r=>r.status==='HOLD_HEADER')?.id,h.id);
  assert.equal(proof.result.originalFirstPageAmendedFinanceFormsAuthenticated,25);
  assert.equal(proof.result.completeOriginalPlusAmendmentSourceVersionCoverageAcrossPinnedViewerRefs,false);
  assert.equal(proof.openQuestions.actualHistoricalPublicByByAmendment,null);
  assert.equal(proof.openQuestions.statewideLegallyRequiredSenateFilings,null, 'No implicit legal completeness claim');
  assert.equal(proof.safeguards.noRawReportTextsOrPdfsStored,true);
  assert.equal(proof.safeguards.noProductionDataReadsOrWrites,true);
  assert.equal(proof.safeguards.keepIssue864Open,true);
});
test('late 2024 original YE amendment is retained with independent 2024 receipt, never backdated to 2023',()=>{
  const r=rows.find(r=>r.id==='18058:22:pcc:YE:0:2')!;
  assert.ok(r);
  assert.equal(r.received,'2024-04-30');
  assert.equal(r.floor,'2024-05-01');
  assert.equal(proof.result.amendedDocumentReportYear2022ReceivedIn2024.boardReceivedOn,'2024-04-30');
  assert.equal(proof.result.amendedDocumentReportYear2022ReceivedIn2024.actualHistoricallyPublicByIndependentlyVerified,null);
  assert.equal(proof.openQuestions.historicalPredictionAdmissionPermitted,false);
});
