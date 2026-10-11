/** Strict read-only official-source tests for #864, 2025 actual SD29 serving senator. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  SD29_2025_AMENDMENT_KEYS,SD29_2025_SOURCE_RESPONSE_SHA,
  selectSd29SevenAmendmentTargets,sd29AmendmentRef,
  parseSd29AmendmentPdfHeader,auditSd29Amendment,
  classifySd29AmendmentSequence,
} from '../src/evidence/cfb-2025-served-sd29-seven-amendments.js';
const P='docs/evaluation/source-proof/';
const data={
  queuePsv:readFileSync(P+'cfb-2021-25-served-senator-next-source-pdf-targets.psv','utf8'),
  viewerLedgerPsv:readFileSync(P+'cfb-2025-dated-senate-85-reference-versions.psv','utf8'),
  specialCePsv:readFileSync(P+'cfb-2025-senate-12-special-original-pdf-source-ledger.psv','utf8'),
  specialFinalPsv:readFileSync(P+'cfb-2025-served-senators-2-special-cycle-final-original-pdf-ledger.psv','utf8'),
  ordinaryYePsv:readFileSync(P+'cfb-2025-two-served-senators-yearend-original-pdf-ledger.psv','utf8'),
};
const targets=selectSd29SevenAmendmentTargets(data);
function displayDate(d:string){
  const [y,m,day]=d.split('-');
  return String(Number(m))+'/'+String(Number(day))+'/'+y;
}
function syntheticText(t:typeof targets[number],received='February 27, 2026'){
  return ['Report of Receipts and Expenditures for Principal Campaign Committee',
    'Senate District: 29','Registration Number: 19229',
    'Period Covered: '+displayDate(t.parentStart)+' through '+displayDate(t.parentEnd),
    'Received by the Board '+received].join('\n');
}
function mockSource(t:typeof targets[number],sha:string,text=syntheticText(t)){
  return {sourceUrl:'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=25&type=pcc&period='+
    t.period+'&se='+t.se+'&regnum=19229&amend='+t.index,
    sha256:sha,bytes:1000,observedAt:'2026-10-11T16:45:00.000Z',text};
}
test('all seven exact official viewer amendment references are proved on actual senator, four authenticated parent hashes',()=>{
  assert.equal(targets.length,7);
  assert.deepEqual(targets.map(t=>t.id),[...SD29_2025_AMENDMENT_KEYS].sort());
  const parentIds=new Set(targets.map(t=>t.parentId));
  assert.deepEqual([...parentIds].sort(),[
    '19229:25:pcc:C:1:0','19229:25:pcc:E:1:0',
    '19229:25:pcc:YE:0:0','19229:25:pcc:YE:1:0'].sort());
  assert.ok(targets.every(t=>t.actualSenator==='Michael Holmstrom Jr'
    &&t.district===29&&t.reg==='19229'
    &&t.viewerSha===SD29_2025_SOURCE_RESPONSE_SHA
    &&t.id.endsWith(':'+t.index)&&t.index>0
    &&t.parentStart<=t.parentEnd&&t.parentReceived>=t.parentEnd
    &&t.parentPdfSha!==undefined&&t.parentPdfSha.length===64));
  for(const t of targets){
    const ref=sd29AmendmentRef(t);
    assert.equal(ref.year,'25');assert.equal(ref.type,'pcc');
    assert.equal(ref.registrationNumber,'19229');
    assert.equal(ref.period,t.period);assert.equal(ref.se,t.se);
    assert.equal(ref.amendment,t.index);
  }
});
test('current source changes and invented never-served committee PDF target fail before source network fetch',()=>{
  assert.throws(()=>selectSd29SevenAmendmentTargets({...data,
    queuePsv:data.queuePsv.replace('Michael Holmstrom Jr','Never Served')}),/changed/);
  assert.throws(()=>selectSd29SevenAmendmentTargets({...data,
    viewerLedgerPsv:data.viewerLedgerPsv.replace(SD29_2025_SOURCE_RESPONSE_SHA,'0'.repeat(64))}),/changed/);
  assert.throws(()=>selectSd29SevenAmendmentTargets({...data,
    specialFinalPsv:data.specialFinalPsv.replace(
      '0cecaf71ada09c3cb7d12dd439438dc432c7998159250b7c62e85bfdb0e383b2',
      'f'.repeat(64))}),/parent ledger invalid/);
  assert.throws(()=>selectSd29SevenAmendmentTargets({...data,
    ordinaryYePsv:data.ordinaryYePsv.replace('2025-12-31','2025-11-30')}),/parent ledger invalid/);
});
test('synthetic original first-page identity must match exact coverage, senator district, registration and filing receipt',()=>{
  const t=targets[0]!;
  assert.equal(parseSd29AmendmentPdfHeader(t,syntheticText(t)).verified,true);
  assert.equal(parseSd29AmendmentPdfHeader(t,syntheticText(t).replace('19229','99999')).verified,false);
  assert.equal(parseSd29AmendmentPdfHeader(t,syntheticText(t).replace('District: 29','District: 30')).verified,false);
  assert.equal(parseSd29AmendmentPdfHeader(t,syntheticText(t).replace(
    'for Principal Campaign Committee','for Nonprofit')).verified,false);
  assert.equal(parseSd29AmendmentPdfHeader(t,syntheticText(t).replace(
    displayDate(t.parentEnd),'12/31/2024')).verified,false);
  assert.equal(parseSd29AmendmentPdfHeader(t,syntheticText(t,'January 01, 2025')).verified,false);
  assert.equal(parseSd29AmendmentPdfHeader(t,syntheticText(t).replace(
    'Registration Number:','Registration:')).verified,false);
});
test('source provenance, binary distinctness and duplicate amendment hashes fail closed',()=>{
  const texts=targets.map((t,i)=>auditSd29Amendment(t,mockSource(t,
    (i+1).toString(16).padStart(64,'0'),
    syntheticText(t,'February 27, 2026'))));
  assert.ok(texts.every(x=>x.status==='source_pdf_identity_authenticated'));
  const check=classifySd29AmendmentSequence(texts);
  assert.equal(check.strictSevenDistinctFormsVerified,true);
  assert.equal(check.uniqueAuthenticatedPdfHashes,7);
  assert.equal(check.legallyOwedReportDenominator,null);
  const fakeAlias=texts.map((x,i)=>i===6?{...x,pdfSha256:texts[0]!.pdfSha256}:x);
  const aliasCheck=classifySd29AmendmentSequence(fakeAlias);
  assert.equal(aliasCheck.strictSevenDistinctFormsVerified,false);
  assert.equal(aliasCheck.unexpectedBinaryAliases.length,1);
  assert.equal(aliasCheck.uniqueAuthenticatedPdfHashes,6);
  const t=targets[0]!;
  const identical=auditSd29Amendment(t,mockSource(t,t.parentPdfSha));
  assert.equal(identical.status,'source_pdf_equals_original_parent');
  const wrong=auditSd29Amendment(t,{...mockSource(t,'a'.repeat(64)),
    sourceUrl:'https://thirdparty.example/invalid'});
  assert.equal(wrong.status,'source_pdf_provenance_unverified');
  const failed=auditSd29Amendment(t,null,'official_source_http_timeout');
  assert.equal(failed.status,'source_fetch_failed');
  assert.ok(texts.every(x=>x.actualHistoricalPublicByProven===null
    &&x.legallyOwedReportCount===null&&!x.historicalForecastEligible));
});

test('permanent seven-row original PDF evidence has exactly six new binary hashes and one parent alias',()=>{
  const P='docs/evaluation/source-proof/';
  const c=JSON.parse(readFileSync(P+
    'cfb-2025-served-sd29-seven-amended-version-source-checkpoint.json','utf8'));
  const content=readFileSync(c.permanentPdfLedger.path,'utf8');
  const records=content.trimEnd().split('\n').map((x:string)=>x.split('|'));
  assert.equal(c.issue,864);
  assert.equal(c.independentOriginalSourceRuns.length,2);
  assert.equal(c.comparison.all7PdfBinarySha256AndByteLengthsIdenticalAcrossRuns,true);
  assert.equal(c.comparison.distinctAmendmentPdfsNewlyAuthenticated,6);
  assert.equal(c.comparison.documentedOriginalParentBinaryAliases,1);
  assert.equal(c.alias.bothPdfBytes,18020);
  assert.equal(content.endsWith('\n'),true);
  assert.equal(Buffer.byteLength(content,'utf8'),1984);
  assert.equal(records.length,7);
  const observed=new Map(records.map((r:string[])=>[r[0]!,r]));
  assert.deepEqual([...observed.keys()].sort(),[...SD29_2025_AMENDMENT_KEYS].sort());
  const expected={
    '19229:25:pcc:C:1:1':['5e429b554af43ba0fa4546105179d062e4ee0aff2676a3498ab8ff12096460a0','17178','2025-08-25'],
    '19229:25:pcc:E:1:1':['3ec7deef8d3d10f87e0ae05caa80bce1c992a7f1cc19ce741ff93a15a14581c0','29924','2025-10-30'],
    '19229:25:pcc:YE:0:1':['115af8ec4d2fcf19323ae88cc2e858f1d1cda00c03e9ca994bf31e2070335289','18020','2026-02-01'],
    '19229:25:pcc:YE:1:1':['852e9803f0bbbdafd0c5215f0ad1bffb10a45f8be50a06f66703a113ac136504','35139','2026-03-15'],
    '19229:25:pcc:YE:1:2':['9441f0b745bd36c4dec071148bc01a19e21aa627bb7614f7b3560390d1fb0264','35001','2026-04-13'],
    '19229:25:pcc:YE:1:3':['6c4a10ea4be1dc900e1d619f7e6bd168b3d37bd12b06ff65c640093582a31f01','34189','2026-06-04'],
    '19229:25:pcc:YE:1:4':['edd5753d076bb913636aef81a9a3779825ba51a0232c08ed64bad9cde3047ac6','34330','2026-06-05'],
  } as const;
  for(const t of targets){
    const row=observed.get(t.id)!;
    assert.ok(row,'Exact report version missing from original PDF proof ledger');
    assert.equal(row.length,14);
    assert.equal(row[0],t.id);
    assert.equal(row[1],t.actualSenator);
    assert.equal(row[2],String(t.district));
    assert.equal(row[3],t.parentId);
    assert.equal(row[4],t.parentPdfSha);
    assert.deepEqual(row.slice(5,7),expected[t.id as keyof typeof expected].slice(0,2));
    assert.equal(row[7],t.parentStart);assert.equal(row[8],t.parentEnd);
    assert.equal(row[9],expected[t.id as keyof typeof expected][2]);
    assert.equal(row[10],t.dueOn);
    const isAlias=t.id==='19229:25:pcc:YE:0:1';
    assert.equal(row[12],isAlias?'reviewed_official_index_aliases_original_pdf':'distinct_amended_pdf');
    assert.equal(row[13],isAlias?t.parentId:'-');
    assert.equal(row[4]===row[5],isAlias);
    assert.ok(row[11]>=row[9]&&row[11]>=row[10]);
  }
  assert.equal(new Set(records.map((r:string[])=>r[5])).size,7);
  assert.equal(records.filter((r:string[])=>r[12]==='distinct_amended_pdf').length,6);
  assert.equal(c.safeguards.historicallyPublicByProvenCount,0);
  assert.equal(c.safeguards.statutoryLegalDutyDenominator,null);
  assert.equal(c.safeguards.noProductionWritesOrReads,true);
});

test('exact real-world original parent alias can be accepted only at its reviewed id/hash/receipt/bytes',()=>{
  const reports=targets.map((t,i)=>{
    const alias=t.id==='19229:25:pcc:YE:0:1';
    const sha=alias?t.parentPdfSha:(i+2).toString(16).padStart(64,'0');
    const pdf=mockSource(t,sha,syntheticText(t,alias?'February 1, 2026':'June 6, 2026'));
    return auditSd29Amendment(t,{...pdf,bytes:alias?18020:2000});
  });
  const check=classifySd29AmendmentSequence(reports);
  assert.equal(check.sourceAcquisitionAcceptedWithExactReviewedParentAlias,true);
  assert.equal(check.sourcePdfIdentityAuthenticated,6);
  assert.equal(check.uniqueAuthenticatedPdfHashes,6);
  assert.equal(check.verifiedOfficialReferencesIncludingExactParentAlias,7);
  assert.equal(check.documentedOriginalParentAliases.length,1);
  assert.equal(check.sourceHolds.length,0);
  assert.equal(check.canClaimSevenDistinctNewPdfs,false);
  const broken=reports.map(x=>x.id==='19229:25:pcc:YE:0:1'?
    {...x,pdfBytes:18021}:x);
  assert.equal(classifySd29AmendmentSequence(broken)
    .sourceAcquisitionAcceptedWithExactReviewedParentAlias,false);
});
