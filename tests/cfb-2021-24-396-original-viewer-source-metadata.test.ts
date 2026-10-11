import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root='docs/evaluation/source-proof/';
const psvPath=root+'cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const sourcePath=root+'cfb-2021-24-senate-396-original-viewer-source-observations-checkpoint.json';
const precedingPath=root+'cfb-2021-24-senate-396-source-viewer-count-checkpoint.json';
const psv=readFileSync(psvPath,'utf8');
const preserved=JSON.parse(readFileSync(sourcePath,'utf8')) as Record<string,any>;
const preceding=JSON.parse(readFileSync(precedingPath,'utf8')) as Record<string,any>;
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const SOURCE_SHA='6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9';

function rows(){
  assert.equal(psv.endsWith('\n'),false,'canonical original source rows do not have trailing newline');
  assert.equal(Buffer.byteLength(psv,'utf8'),49059);
  assert.equal(sha(psv),SOURCE_SHA);
  const all=psv.split('\n');
  assert.equal(all.length,396);
  const seen=new Set<string>(),regs=new Set<string>();
  const ids=new Set<string>(),versions:{year:number;original:boolean;period:string}[]=[];
  const ancillary:string[]=[];
  let previous='';
  for(const line of all){
    const c=line.split('|');
    assert.equal(c.length,4,'segment|registration|originalAPIbodySHA|exactRefs');
    const [segment,reg,hash,documents]=c;
    assert.ok(segment==='2022'||segment==='2024');
    assert.match(reg!,/^\d{4,5}$/);
    assert.match(hash!,/^[0-9a-f]{64}$/);
    const k=segment+'|'+reg;
    assert.ok(k>previous,'original 396 observations canonical segment/reg lexical order');
    assert.ok(!seen.has(k));
    seen.add(k);regs.add(reg!);previous=k;
    for(const token of (documents?documents.split(','):[])){
      const id=reg+':'+token;
      assert.ok(!ids.has(id),'unique report-version key across segment cohort');
      ids.add(id);
      const p=token.split(':');
      assert.equal(p.length,5,'year:type:period:se:amendment');
      const [year,type,period,special,amend]=p;
      assert.ok(['21','22','23','24'].includes(year!));
      assert.ok(['pcc','aoc'].includes(type!));
      assert.ok(['C','E','YE'].includes(period!));
      assert.ok(special==='0'||special==='1');
      assert.match(amend!,/^\d+$/);
      if(type==='aoc'){
        assert.equal(year,'22');assert.equal(period,'C');assert.equal(amend,'0');
        ancillary.push(id);
      }else versions.push({year:2000+Number(year),original:amend==='0',period:period!});
    }
  }
  return {all,seen,regs,ids,versions,ancillary};
}
test('original 396 CFB viewer API metadata responses recovered exactly before artifact expiry',()=>{
  const x=rows();
  assert.equal(preserved.schemaVersion,'cfb-senate-2021-24-396-original-viewer-source-metadata-preservation-v1');
  assert.equal(preceding.provenance.officialSourceArtifactId,11683227803);
  assert.equal(preserved.originalArtifact.artifactId,11683227803);
  assert.equal(preserved.originalArtifact.githubRun,preceding.provenance.verifiedSourceWorkflowRun);
  assert.equal(preserved.originalArtifact.originalZipSha256,
    preceding.provenance.artifactZipSha256IndependentlyRechecked);
  assert.equal(preserved.originalArtifact.originalJsonSha256,
    preceding.provenance.sourceArtifactJsonSha256IndependentlyRechecked);
  assert.equal(preserved.originalArtifact.originalJsonBytes,
    preceding.provenance.sourceArtifactJsonBytes);
  assert.equal(preserved.originalArtifact.originalSourceCapturedAt,'2026-10-10T21:52:48.211Z');
  assert.equal(preserved.permanentPsv.sha256,SOURCE_SHA);
  assert.equal(preserved.permanentPsv.bytes,49059);
  assert.equal(preceding.provenance.metadataOnly396SourceRowsCanonicalPsvSha256WithoutTrailingNewline,SOURCE_SHA);
  assert.equal(preceding.provenance.metadataOnly396SourceRowsCanonicalPsvBytesWithoutTrailingNewline,49059);
  assert.equal(x.seen.size,396);
  assert.equal(x.regs.size,275);
  assert.equal(x.ids.size,1382);
  assert.equal(x.versions.length,1378);
  assert.deepEqual(x.ancillary.sort(),
    [...preceding.observations.excludedAffidavitVersionIds].sort());
  assert.equal(x.ancillary.length,4);
  assert.equal(x.versions.filter(x=>x.original).length,941);
  assert.equal(x.versions.filter(x=>!x.original).length,437);
  assert.equal(preserved.permanentPsv.originalViewerVersions,941);
  assert.equal(preserved.permanentPsv.amendmentViewerVersions,437);
});
test('four source years have original/amended report version counts, NOT legal requirements',()=>{
  const {versions}=rows();
  const expect=[[2021,165,70],[2022,524,247],[2023,118,51],[2024,134,69]];
  for(const [year,original,amended] of expect){
    const v=versions.filter(x=>x.year===year);
    assert.equal(v.filter(x=>x.original).length,original);
    assert.equal(v.filter(x=>!x.original).length,amended);
    const p=preserved.permanentPsv.byYear.find((x:any)=>x.reportYear===year);
    const old=preceding.byReportYear.find((x:any)=>x.reportYear===year);
    assert.equal(p.viewerOriginalVersionReferences,original);
    assert.equal(p.viewerAmendmentVersionReferences,amended);
    assert.equal(old.pccOriginalVersionReferences,original);
    assert.equal(old.pccAmendmentVersionReferences,amended);
  }
  assert.equal(preserved.scope.requiredSenateLegislatorReportDenominator,null);
  assert.equal(preserved.scope.actualSenateMemberFilerYearDenominator,null);
  assert.equal(preserved.scope.allStateSenateHistoricalFilingDenominator,null);
  assert.equal(preserved.scope.historicalPublicByCount,0);
  assert.equal(preserved.scope.thisIsA2026ViewerObservationNotHistoricallyProvenCommitteeRegistration,true);
  assert.equal(preserved.scope.includesSomeRegistrationsOfNonServingCandidates,true);
  assert.equal(preserved.scope.noIndividualCandidateNamesOrRawFinancialDetailsRetained,true);
  assert.equal(preserved.scope.neverImputeLegalReportingDenominatorFromViewerSnapshot,true);
  assert.equal(preserved.safeguards.noProductionAccess,true);
  assert.equal(preserved.safeguards.issue864RemainsOpen,true);
});
