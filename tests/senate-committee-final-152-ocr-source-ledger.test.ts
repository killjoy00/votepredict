import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const raw=readFileSync(new URL('../docs/evaluation/source-proof/senate-committee-final-152-ocr-source-ledger.json',import.meta.url),'utf8');
const ledger=JSON.parse(raw);
const sha1=()=>createHash('sha1').update('blob '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex');

test('final 152 Senate scanned original recovery proof is permanent and source-bound',()=>{
  assert.equal(sha1(),'f486998fb0000a83c0346d51b8a62c90eb5f9e78');
  assert.equal(ledger.schemaVersion,'senate-committee-original-final-152-ocr-artifact-source-ledger-v1');
  assert.equal(ledger.issue,864);
  assert.equal(ledger.originalSourceRun,38066441841);
  assert.equal(ledger.sourceOcrRun,38075234242);
  assert.equal(ledger.mergedOcrPr,888);
  assert.equal(ledger.mergedMainSha,'3bc42308b3a49984d149ffc9f0f2afd363c0ade0');
  assert.equal(ledger.premergeCI,38075059670);
  assert.equal(ledger.postmergeCI,38075234237);
  assert.equal(ledger.original2022AuditArtifactId,11674729430);
  assert.equal(ledger.original2025AuditArtifactId,11675014092);
  assert.deepEqual(ledger.selectedOriginalUrlListSha256,{
    '2022':'794bd1003290f13e5c44e1ab27b545eee9632f8a09c09b0ed6080afa275b3be9',
    '2025':'29d0656929dc92be4b283b296f1101cbbf6ad90ef991e31c6e1b30ceb6fee515',
  });
});

test('nine exact original Actions OCR artifacts independently account for all 152 recovered PDFs',()=>{
  const batches=ledger.batchProofs;
  assert.equal(batches.length,9);
  assert.deepEqual(batches.map((b:any)=>[b.year,b.batch]),[
    [2022,0],[2022,1],[2022,2],[2022,3],[2022,4],[2022,5],
    [2025,0],[2025,1],[2025,2],
  ]);
  const sum=(key:string)=>batches.reduce((n:number,b:any)=>n+b[key],0);
  assert.equal(sum('ocrRecovered'),152);
  assert.equal(sum('originalPdfFailures'),0);
  assert.equal(sum('parserNamedRolls'),14);
  assert.equal(sum('parserNamedChoices'),126);
  assert.equal(sum('parserCountOnlyRolls'),3);
  assert.equal(sum('parserVoiceContext'),64);
  assert.equal(sum('parserResultOnlyContext'),166);
  assert.equal(sum('possibleUnparsedRollSignal'),4);
  assert.equal(sum('noSupportedActionPdfs'),78);
  assert.equal(batches.filter((b:any)=>b.year===2022).reduce((n:number,b:any)=>n+b.ocrRecovered,0),110);
  assert.equal(batches.filter((b:any)=>b.year===2025).reduce((n:number,b:any)=>n+b.ocrRecovered,0),42);
  assert.equal(new Set(batches.map((b:any)=>b.artifactId)).size,9);
  assert.equal(batches.every((b:any)=>
    Number.isInteger(b.artifactId) && b.artifactId>0 &&
    /^[a-f0-9]{64}$/.test(b.zipSha256)&&
    /^[a-f0-9]{64}$/.test(b.jsonSha256)),true);
});

test('named-roll original highlights are exact official Senate original PDF sources only',()=>{
  const rows=ledger.namedSourceHighlights;
  assert.equal(rows.length,9);
  const sum=(k:string)=>rows.reduce((n:number,r:any)=>n+r[k],0);
  assert.equal(sum('namedRolls'),14);
  assert.equal(sum('namedChoices'),126);
  assert.equal(new Set(rows.map((r:any)=>r.officialPdfUrl)).size,9);
  for (const row of rows){
    assert.match(row.pdfSha256,/^[a-f0-9]{64}$/);
    assert.match(row.ocrTextSha256,/^[a-f0-9]{64}$/);
    const url=new URL(row.officialPdfUrl);
    assert.equal(url.protocol,'https:');
    assert.equal(url.hostname,'www.lrl.mn.gov');
    assert.match(url.pathname,/^\/archive\/minutes\/senate\/(2022|2025)\//);
    assert.ok(url.pathname.includes('/'+row.meetingDate.replaceAll('-','')+'/'));
    assert.equal(url.search,'');
    assert.ok(row.namedRolls>=1 && row.namedChoices>=row.namedRolls);
  }
});

test('207/207 is electronic low-text extraction coverage only, not all recorded Senate committee votes',()=>{
  const a=ledger.aggregateNewBatch,c=ledger.allOcrCohorts,l=ledger.limitations;
  assert.deepEqual([a.originalsAttempted,a.originalsOcrRecovered,a.sourceFailures],[152,152,0]);
  assert.deepEqual([a.namedRolls,a.namedMemberChoices,a.countOnlyRolls],[14,126,3]);
  assert.deepEqual([a.contextActionCandidates,a.voiceContext,a.resultOnlyContext],[230,64,166]);
  assert.deepEqual([c.initialScannedOriginals,c.previousOcrRecovered,c.newOcrRecovered,
    c.finalOcrRecovered,c.remainingScannedOriginals],[207,55,152,207,0]);
  assert.deepEqual(c.yearStatus,{
    '2022':{'originalLowText':121,'recovered':121},
    '2023':{'originalLowText':22,'recovered':22},
    '2024':{'originalLowText':13,'recovered':13},
    '2025':{'originalLowText':51,'recovered':51},
  });
  assert.match(ledger.fullPerOriginalMetadataJsonSha256,/^[a-f0-9]{64}$/);
  assert.equal(l.original2021PrintSenateMeetingAndVoteDenominator,null);
  assert.equal(l.year2022PrintElectronicMayDiffer,true);
  assert.equal(l.indexedMeetingsWithoutMinutesLink,141);
  assert.equal(l.originalEmbeddedTextParsedButUnparsedRollCuePdfs,141);
  assert.equal(l.parserCandidateActionsAreHumanVerifiedDistinctMotions,false);
  assert.equal(l.sourceToPrivateDbReconciliationPerformed,false);
  assert.equal(l.productionHistoricalEvidenceChanges,false);
  assert.equal(l.all2021_2025OfficialMeetingsDenominator,null);
  assert.equal(l.all2021_2025RecordedVoteDenominator,null);
  assert.equal(l.noProductionDbOrModelSchedulerChanges,true);
});
