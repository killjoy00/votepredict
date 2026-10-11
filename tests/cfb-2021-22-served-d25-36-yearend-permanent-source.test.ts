import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {cfbElectronicReportAvailableOn}
  from '../src/evidence/cfb-report-availability.js';

const P='docs/evaluation/source-proof/';
const checkpoint=JSON.parse(readFileSync(P+'cfb-2021-22-served-d25-36-18-original-yearend-source-checkpoint.json','utf8'));
const psv=readFileSync(P+'cfb-2021-22-served-d25-36-18-original-yearend-pdfs.psv','utf8');
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const rows=psv.trimEnd().split('\n').map(line=>{
  const a=line.split('|');assert.equal(a.length,12,'Strict metadata-only original PDF fields');
  const [id,name,election,printed,binary,bytes,acquired,start,end,received,due,floor]=a;
  return {id:id!,name:name!,election:Number(election),printed:Number(printed),
    binary:binary!,bytes:Number(bytes),acquired:acquired!,start:start!,
    end:end!,received:received!,due:due!,floor:floor!};
});
const before22=new Set(readFileSync(P+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8')
  .trim().split('\n').map(line=>line.split('|')[0]!));
const older=new Set([
  ...readFileSync(P+'cfb-2022-senate-24-original-ce-pdf-headers.psv','utf8').trim().split('\n'),
  ...readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8').trim().split('\n'),
  ...readFileSync(P+'cfb-2021-22-served-11-20-original-ye-pdf-proof.psv','utf8').trim().split('\n'),
].map(row=>row.split('|')[0]!));
const observations=new Map(readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8')
  .split('\n').filter(line=>line.startsWith('2022|'))
  .map(line=>{const x=line.split('|');return [x[1]!,new Set((x[3]??'').split(','))]}));

test('18 SHA-pinned original annual PDFs came from exact merged 2021-22 official-source and full CI runs',()=>{
  assert.equal(checkpoint.schemaVersion,'cfb-2021-22-sd25-36-eleven-senate-senators-18-original-ye-permanent-source-v1');
  assert.equal(Buffer.byteLength(psv),3482);
  assert.equal(sha(psv),'8c3278b1e7dfe4fff3c768308d4d8328a0af065fa2b270406257d49e5aa716db');
  assert.equal(checkpoint.permanentSourceLedger.sha256,sha(psv));
  assert.equal(checkpoint.permanentSourceLedger.bytes,3482);
  assert.equal(rows.length,18);
  assert.equal(new Set(rows.map(r=>r.id)).size,18);
  assert.equal(new Set(rows.map(r=>r.binary)).size,18);
  assert.equal(new Set(rows.map(r=>r.name)).size,11);
  const a=checkpoint.sourceAcquisition;
  assert.equal(a.pr,1051);
  assert.equal(a.mergeCommit,'8415453d3ceeebb3bae1cd0a1e8a9f5eddcf4e05');
  assert.equal(a.exactHead,'b6444418e4309dd3d74d40e1249aa4c7a169367d');
  assert.equal(a.fullCiRunId,38112505379);
  assert.equal(a.fullCiConclusion,'success');
  assert.equal(a.originalSourceRunId,38112505375);
  assert.equal(a.originalSourceConclusion,'success');
  assert.equal(a.artifactId,11691633889);
  assert.equal(a.zipBytes,5789);
  assert.equal(a.zipSha256,'0b1f194a980973b75cb8c4c4a40c9d5f782c7dcc3df3af155236bf6f6186f720');
  assert.equal(a.sourceJsonBytes,49140);
  assert.equal(a.sourceJsonSha256,'ef758f07253eb0aa2eba0fd8fd01ce7056186f7996a673cc595d36058f7a5758');
});

test('each 2021/22 annual original has authentic source-id year, committee Senate person, reporting dates and legally conservative next-day bound',()=>{
  assert.equal(before22.size,22);
  assert.equal(rows.filter(r=>r.id.split(':')[1]==='21').length,7);
  assert.equal(rows.filter(r=>r.id.split(':')[1]==='22').length,11);
  assert.equal(checkpoint.population.sourceOriginal2021YearEndReferences,7);
  assert.equal(checkpoint.population.sourceOriginal2022YearEndReferences,11);
  assert.equal(checkpoint.population.authenticatedDistinctOriginalPdfBinaries,18);
  assert.equal(checkpoint.population.failures,0);
  for(const r of rows){
    assert.match(r.id,/^\d{4,8}:(21|22):pcc:YE:0:0$/);
    assert.match(r.binary,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(r.bytes)&&r.bytes>=300);
    assert.ok(!before22.has(r.id)&&!older.has(r.id),'No earlier authenticated report version double-counted');
    assert.ok(r.name.length>3&&!r.name.includes('@'));
    const segments=r.id.split(':'),year=2000+Number(segments[1]);
    assert.equal(r.start,year+'-01-01');
    assert.equal(r.end,year+'-12-31');
    assert.equal(r.due,(year+1)+'-01-31');
    assert.ok(r.received>=r.end);
    assert.equal(r.floor,cfbElectronicReportAvailableOn(r.received,r.due));
    assert.ok(r.election>=25&&r.election<=36&&r.election!==31);
    assert.ok(r.printed>=1&&r.printed<=67);
    assert.match(r.acquired,/^2026-10-11T\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(observations.get(segments[0]!)?.has(segments.slice(1).join(':')));
  }
  assert.equal(checkpoint.population.independentlyVerifiedHistoricalPublicByCount,0);
  assert.equal(checkpoint.nextFinanceEvidence.historicalCFBActualPublicByProven,false);
  assert.equal(checkpoint.nextFinanceEvidence.statewideLegallyOwedSenateReportCount,null);
});

test('same-person independently sourced older Senate district remains different from 2022 ballot district',()=>{
  const olderDistrict=rows.filter(r=>r.election!==r.printed);
  assert.equal(olderDistrict.length,7);
  const persons=new Map(olderDistrict.map(r=>[r.name,new Set(olderDistrict
    .filter(v=>v.name===r.name).map(v=>v.printed))]));
  assert.equal(persons.size,5);
  assert.deepEqual([...persons.keys()].sort(),[
    'Andrew Mathews','Jeremy R. Miller','John A. Hoffman','Karin Housley','Mark W. Koran'].sort());
  assert.equal(checkpoint.population.redistrictedPdfPrintedHistoricalDistrictCount,7);
});

test('official LRL/SOS/CFB calendar source hashes are independently dated 2026 and no database operations were performed',()=>{
  const o=checkpoint.independentlyObservedOriginalSources;
  assert.equal(o.lrl.sha256,'09e9adeb2c014853ec822cb63b88b1a0d550911c62cb16c7a95cea59647590b1');
  assert.equal(o.sos.sha256,'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74');
  assert.equal(o.cfb2022Calendar.sha256,'3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25');
  assert.ok(o.lrl.observedAt.startsWith('2026-10-11T'));
  assert.ok(o.sos.observedAt.startsWith('2026-10-11T'));
  assert.ok(o.cfb2022Calendar.observedAt.startsWith('2026-10-11T'));
  assert.equal(checkpoint.population.priorOriginalCOrEIdentitiesExcluded,68);
  assert.equal(checkpoint.nextFinanceEvidence.originalAndAmendedReportVersionsForTheseElevenActuallyAuthenticated,40);
  assert.equal(checkpoint.nextFinanceEvidence.otherAmendmentVersionReferencesInPinnedViewerNotAuthenticated,30);
  assert.equal(checkpoint.nextFinanceEvidence.sourceToProductionFinancialRecordsChecked,false);
  assert.equal(checkpoint.safeguards.noPdfBodiesStored,true);
  assert.equal(checkpoint.safeguards.noDonorContactOrTransactionDataStored,true);
  assert.equal(checkpoint.safeguards.noProductionDatabaseReadOrWrite,true);
  assert.equal(checkpoint.safeguards.keepIssue864Open,true);
});
