import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const CHECKPOINT='docs/evaluation/source-proof/cfb-2021-22-served-11-20-original-ye-source-checkpoint.json';
const LEDGER='docs/evaluation/source-proof/cfb-2021-22-served-11-20-original-ye-pdf-proof.psv';
const CE22='docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv';
const CE24='docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv';
const SERVED='docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-source-checkpoint.json';
const checkpoint=JSON.parse(readFileSync(CHECKPOINT,'utf8'));
const s=readFileSync(LEDGER,'utf8');
const originalSha=(b:string)=>createHash('sha256').update(b,'utf8').digest('hex');
const reports=s.trimEnd().split('\n').map(line=>{
  const [id,name,election,printed,sha,size,acquired,start,end,received,due,floor,...rest]=line.split('|');
  assert.equal(rest.length,0,'No donor or report transaction detail columns');
  return {id:id!,name:name!,election:Number(election),printed:Number(printed),
    sha:sha!,size:Number(size),acquired:acquired!,start:start!,end:end!,
    received:received!,due:due!,floor:floor!};
});
const earlier=[...readFileSync(CE22,'utf8').trim().split('\n'),
  ...readFileSync(CE24,'utf8').trim().split('\n')];
const previousIds=new Set(earlier.map(line=>line.split('|')[0]!));

test('pin exact official-source artifact bytes, implementation head and successful CI',()=>{
  const a=checkpoint.acquisition;
  assert.equal(checkpoint.schemaVersion,'cfb-2021-22-eleven-ever-served-senators-20-original-yearend-pdf-permanent-source-v1');
  assert.equal(a.pr,1022);
  assert.equal(a.mergedSquashSha,'68327ba774eea01b9bf69b566a8ea3f92efb2a29');
  assert.equal(a.exactHeadSha,'972255cf4f7ebeb8bce186470b2c541d7df78897');
  assert.equal(a.fullCiRunId,38108797364);
  assert.equal(a.fullCiConclusion,'success');
  assert.equal(a.originalSourceRunId,38108797322);
  assert.equal(a.originalSourceConclusion,'success');
  assert.equal(a.originalArtifactId,11690796660);
  assert.equal(a.originalMetadataZipSha256,'d12f7d9ea00ef46a4299382adfd9bcf8f523322ddd02ae3ffc8eedbfa609a850');
  assert.equal(a.originalMetadataJsonSha256,'cb3b9bf86be292f086e5e7cf3cb93a72b6c662e814611cb71b596404775002e6');
  assert.equal(a.originalMetadataJsonBytes,52839);
  assert.ok(a.sourceObservedAt.startsWith('2026-10-11T'));
});
test('independent official LRL, SOS, calendar source hashes and dates are original 2026 observations',()=>{
  const o=checkpoint.originalOfficialSources;
  assert.equal(o.sosFileSha256,'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74');
  assert.equal(o.calendarPdfSha256,'3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25');
  assert.equal(o.lrlHtmlSha256,'d2e66e7881809a0814050c5bbcd0eef87bc096a22009db7c2831a03fdd09b52e');
  assert.ok(o.lrlOriginalObservedAt.startsWith('2026-10-11T'));
  assert.ok(o.sosOriginalObservedAt.startsWith('2026-10-11T'));
  assert.ok(o.calendarOriginalObservedAt.startsWith('2026-10-11T'));
  assert.equal(o.candidateViewerAndRosterSourceIdentityFromEarlierPreservedCheckpoint,SERVED);
  assert.deepEqual(checkpoint.originalYearEndCalendarDueOn,{'2021':'2022-01-31','2022':'2023-01-31'});
});
test('twenty original report binary fingerprints and individual actual acquisition dates are preserved',()=>{
  const m=checkpoint.originalPdfReportLedger;
  assert.equal(s.endsWith('\n'),true);
  assert.equal(originalSha(s),'1a7a71108b66a5aafd34db0844f5a28c7f6d0dc357856203215f16b2044f44fd');
  assert.equal(originalSha(s),m.withFinalNewlineSha256);
  assert.equal(originalSha(s.slice(0,-1)),'25658d719937b654fab5e74f7b51d2b605bbfaf673396a91239210787110e8fb');
  assert.equal(originalSha(s.slice(0,-1)),m.canonicalWithoutTrailingNewlineSha256);
  assert.equal(Buffer.byteLength(s.slice(0,-1)),3845);
  assert.equal(m.canonicalWithoutTrailingNewlineByteCount,3845);
  assert.equal(reports.length,20);
  assert.equal(m.reportCount,20);
  assert.equal(new Set(reports.map(r=>r.id)).size,20);
  assert.equal(new Set(reports.map(r=>r.sha)).size,20);
  assert.equal(new Set(reports.map(r=>r.name)).size,11);
  assert.equal(m.distinctPdfBinaryHashes,20);
  assert.equal(reports.filter(r=>r.id.split(':')[1]==='21').length,9);
  assert.equal(reports.filter(r=>r.id.split(':')[1]==='22').length,11);
  assert.equal(previousIds.size,46);
  for(const r of reports){
    assert.match(r.id,/^\d{3,8}:(21|22):pcc:YE:0:0$/);
    assert.ok(!previousIds.has(r.id));
    assert.ok(r.name.length>=4&&!r.name.includes('|'));
    assert.ok(Number.isInteger(r.election)&&r.election>=14&&r.election<=24);
    assert.ok(Number.isInteger(r.printed)&&r.printed>=1&&r.printed<=67);
    assert.match(r.sha,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(r.size)&&r.size>300);
    assert.match(r.acquired,/^2026-10-11T\d\d:\d\d:\d\d\.\d{3}Z$/);
    const y=Number(r.id.split(':')[1])+2000;
    assert.equal(r.start,y+'-01-01');
    assert.equal(r.end,y+'-12-31');
    assert.equal(r.due,(y+1)+'-01-31');
    assert.equal(r.received>=r.end,true);
    assert.equal(r.floor>=r.due,true);
  }
  assert.equal(m.reportYear2021OriginalYE,9);
  assert.equal(m.reportYear2022OriginalYE,11);
  assert.equal(m.actualSenatorsWithOfficialServiceAndRegistration,11);
  assert.equal(m.originalFirstPageIdentityAndPeriodVerified,20);
  assert.equal(m.originalSourceFailures,0);
  assert.equal(m.independentlyProvenHistoricalPublicBy,0);
  assert.equal(m.legalSenateRequiredReportDenominator,null);
  assert.equal(m.sourceToProductionFinancialRowsReconciled,false);
});
test('original YE registration/member matches same exact 11 Senate-serving source identities',()=>{
  const c=JSON.parse(readFileSync(SERVED,'utf8'));
  const roster=c.pinnedOriginalRegistrationApiAndDistrictSources as Array<{
    registrationNumber:string;senateElectionDistrict:number;
  }>;
  assert.equal(roster.length,11);
  for(const v of roster){
    const got=reports.filter(r=>r.id.split(':')[0]===v.registrationNumber);
    assert.ok(got.length===1||got.length===2);
    assert.ok(got.every(r=>r.election===v.senateElectionDistrict));
    assert.ok(got.every(r=>r.name===got[0]!.name));
  }
  assert.equal(reports.filter(r=>r.election!==r.printed).length,12);
  assert.equal(reports.filter(r=>r.election!==r.printed).filter(r=>r.id.includes(':21:')).length,8);
});
test('source proved exactly one Board receipt after yearend due; legal floor is later without historic public-by',()=>{
  const after=reports.filter(r=>r.received>r.due);
  assert.deepEqual(after.map(r=>r.id),['17910:22:pcc:YE:0:0']);
  assert.equal(after[0]!.received,'2023-02-01');
  assert.equal(after[0]!.due,'2023-01-31');
  assert.equal(after[0]!.floor,'2023-02-02');
  assert.ok(reports.filter(r=>r.received<=r.due).every(r=>
    r.floor===r.due.replace(/31$/,'01').replace(/-(01|02)-01$/,(match)=>match)));
  const event=checkpoint.separatelyProvenLaterReceipt;
  assert.equal(event.reportId,after[0]!.id);
  assert.equal(event.conservativeLegallyPossiblePublicNotBeforeOn,'2023-02-02');
  assert.equal(event.actualPublicByIndependentlyEstablished,false);
  assert.equal(event.proofOfLegalNonfiler,false);
  assert.equal(checkpoint.unresolved.historicalPublicByForTwentyReports,null);
  assert.equal(checkpoint.unresolved.legallyRequiredSenateReportCount,null);
  assert.equal(checkpoint.safety.noRawOriginalPdfs,true);
  assert.equal(checkpoint.safety.noDonorNamesOrTransactions,true);
  assert.equal(checkpoint.safety.noUnservedCandidateNames,true);
  assert.equal(checkpoint.safety.noSourceToDatabaseReadOrWrite,true);
  assert.equal(checkpoint.safety.keepIssue864Open,true);
});
