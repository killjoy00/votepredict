/**
 * #864. Recover the ORIGINAL Oct 10 2026 CFB 396-response metadata artifact.
 * This never re-queries CFB, never reads any donors/PDFs, and cannot impute
 * historical CFB report filing obligations. The source artifact ZIP must be
 * independently checked by the PR-only runner BEFORE extraction.
 *
 * Usage: node --import tsx scripts/preserve-cfb-2021-24-396-viewer-metadata.ts
 *   --input artifacts/original-396-source.json
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
const ORIGINAL_JSON_SHA='933f9c55c71da049a4a9af21574f562676e8e930f0cb6be6883e50b5f8901da0';
const ORIGINAL_JSON_BYTES=562731;
const PSV_SHA='6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9';
const PSV_BYTES=49059;
const ZIP_SHA='5516f3863ae9e5122df923b2d0f7f1fc88b5a5af3ddcb6dba2d3160570844914';
const ROOT='docs/evaluation/source-proof/';
const LEDGER=ROOT+'cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const CHECKPOINT=ROOT+'cfb-2021-24-senate-396-original-viewer-source-observations-checkpoint.json';
const SOURCE_URL='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/';
const SHA=/^[0-9a-f]{64}$/;
function hash(value:Buffer|string){return createHash('sha256').update(value).digest('hex');}
function goodDate(s:string){const d=new Date(s);
  return /^2026-10-10T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(d.getTime())&&d.toISOString()===s;
}
function toLedger(source:unknown){
  if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Invalid original JSON');
  const original=source as Record<string,any>;
  if(original.schemaVersion!=='cfb-senate-2021-24-396-source-viewer-snapshot-counts-v1'
    ||original.capturedAt!=='2026-10-10T21:52:48.211Z'
    ||!Array.isArray(original.sourceObservations)||original.sourceObservations.length!==396
    ||original.audit?.totals?.viewerReportVersionReferences!==1378
    ||original.audit?.totals?.originalViewerVersionReferences!==941
    ||original.audit?.totals?.amendmentVersionReferences!==437
    ||original.audit?.totals?.sourceSegmentFailures!==0
    ||original.statewideLegallyActiveSenateCommitteeYears!==null
    ||original.senateCandidateLegallyOwedReportDenominator!==null
    ||original.senateCandidateActuallyFiledOriginalReportDenominator!==null)
    throw Error('Original CFB source artifact scope, counts or unknown denominators changed');
  const lines:string[]=[];
  const unique=new Set<string>(),seen=new Set<string>();
  const reports:string[]=[];
  for(const x of original.sourceObservations as Array<Record<string,unknown>>){
    const reg=x.registrationNumber,segment=x.segmentEndYear,date=x.fetchedAt,
      sourceSha=x.sourceApiBodySha256,refs=x.sourceReportVersionIds;
    if(typeof reg!=='string'||!/^\d{4,5}$/.test(reg)
      ||!(segment===2022||segment===2024)
      ||x.status!=='acquired'
      ||typeof date!=='string'||!goodDate(date)
      ||typeof sourceSha!=='string'||!SHA.test(sourceSha)
      ||!Array.isArray(refs)
      ||x.referencesExtractedForTwoYearSegment!==refs.length
      ||x.sourceUrl!==SOURCE_URL+reg+'/'+segment+'/')
      throw Error('Invalid original source 2026 observation row');
    const key=reg+':'+segment;
    if(seen.has(key))throw Error('Duplicate exact original candidate viewer segment observation');
    seen.add(key);unique.add(reg);
    const tokens:string[]=[];
    for(const ref of refs){
      if(typeof ref!=='string')throw Error('Malformed original CFB viewer reference token');
      const p=ref.split(':');
      if(p.length!==6||p[0]!==reg||!['21','22','23','24'].includes(p[1]!)
        ||!['pcc','aoc'].includes(p[2]!)||!['C','E','YE'].includes(p[3]!)
        ||!['0','1'].includes(p[4]!)||!/^\d+$/.test(p[5]!))
        throw Error('Invalid report-version identity in original source');
      if(p[2]==='aoc'&&!(p[1]==='22'&&p[3]==='C'&&p[4]==='0'&&p[5]==='0'))
        throw Error('Unexpected ancillary AOC classification');
      tokens.push(p.slice(1).join(':'));
      reports.push(ref);
    }
    lines.push([String(segment),reg,sourceSha,tokens.join(',')].join('|'));
  }
  lines.sort((a,b)=>{
    const ka=a.split('|'),kb=b.split('|');
    const aa=ka[0]!,bb=kb[0]!,as=ka[1]!,bs=kb[1]!;
    // Canonical original source hash: segment-year ascending then reg lexical.
    return aa<bb?-1:aa>bb?1:as<bs?-1:as>bs?1:0;
  });
  if(unique.size!==275||seen.size!==396||lines.length!==396||reports.length!==1382)
    throw Error('Original CFB response/cohort cardinality mismatch');
  const pcc=reports.filter(x=>x.includes(':pcc:'));
  const aoc=reports.filter(x=>x.includes(':aoc:'));
  if(pcc.length!==1378||aoc.length!==4)throw Error('Ancillary AOC report false inclusion');
  const byYear=([21,22,23,24] as const).map(yy=>{
    const refs=pcc.filter(x=>x.split(':')[1]===String(yy));
    const originals=refs.filter(x=>x.split(':')[5]==='0');
    const amendments=refs.length-originals.length;
    return {reportYear:2000+yy,viewerOriginalVersionReferences:originals.length,
      viewerAmendmentVersionReferences:amendments,allViewerVersionReferences:refs.length};
  });
  const expected=[[165,70],[524,247],[118,51],[134,69]];
  if(byYear.some((r,i)=>r.viewerOriginalVersionReferences!==expected[i]![0]
    ||r.viewerAmendmentVersionReferences!==expected[i]![1]))
    throw Error('Yearly original/amendment viewer reference counts changed');
  const result=lines.join('\n');
  if(Buffer.byteLength(result)!==PSV_BYTES||hash(result)!==PSV_SHA)
    throw Error('Reconstructed 396-record source PSV canonical SHA mismatch');
  return {result,byYear};
}
function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--input'||!args[1])throw Error('Exactly --input <artifact JSON> required');
  const input=resolve(args[1]);
  if(!input.startsWith(resolve('artifacts')+sep)||!input.endsWith('.json'))
    throw Error('Only a local original artifact JSON file is accepted');
  const bytes=readFileSync(input);
  if(bytes.length!==ORIGINAL_JSON_BYTES||hash(bytes)!==ORIGINAL_JSON_SHA)
    throw Error('Original Actions source artifact JSON hash or size mismatch');
  const {result,byYear}=toLedger(JSON.parse(bytes.toString('utf8')));
  const manifest={
    schemaVersion:'cfb-senate-2021-24-396-original-viewer-source-metadata-preservation-v1',
    originalArtifact:{
      githubRun:'https://github.com/killjoy00/votepredict/actions/runs/38088965276',
      artifactId:11683227803,originalZipSha256:ZIP_SHA,
      originalJsonSha256:ORIGINAL_JSON_SHA,originalJsonBytes:ORIGINAL_JSON_BYTES,
      originalSourceAcquiredOn:'2026-10-10',
      originalSourceCapturedAt:'2026-10-10T21:52:48.211Z',
    },
    permanentPsv:{path:LEDGER,sha256:PSV_SHA,bytes:PSV_BYTES,
      observationRecords:396,uniqueCandidateRegistrationIds:275,
      observedRefsPcc:1378,observedRefsAncillaryAoc:4,
      originalViewerVersions:941,amendmentViewerVersions:437,
      byYear,
    },
    scope:{
      viewerSegments:[2022,2024],reportYears:[2021,2022,2023,2024],
      thisIsA2026ViewerObservationNotHistoricallyProvenCommitteeRegistration:true,
      includesSomeRegistrationsOfNonServingCandidates:true,
      noIndividualCandidateNamesOrRawFinancialDetailsRetained:true,
      neverImputeLegalReportingDenominatorFromViewerSnapshot:true,
      noSourcePdfOriginalAuthenticationByThisArtifact:true,
      noHistoricalPublicByProven:true,
      requiredSenateLegislatorReportDenominator:null,
      actualSenateMemberFilerYearDenominator:null,
      allStateSenateHistoricalFilingDenominator:null,
      historicalPublicByCount:0,
    },
    originalArtifactPreviouslyPreservedOnlyAsSummaryCheckpoint:
      'docs/evaluation/source-proof/cfb-2021-24-senate-396-source-viewer-count-checkpoint.json',
    safeguards:{noDonorNames:true,noReportBodies:true,noProductionAccess:true,
      noEligibilityPromotion:true,noSchedulerOrServingChange:true,issue864RemainsOpen:true},
  };
  mkdirSync(dirname(LEDGER),{recursive:true});
  // Idempotent ONLY if a previous commit preserved exactly the same authentic
  // original source bytes; never overwrite altered proof or silently drift.
  function preserveExact(path:string,body:string){
    if(existsSync(path)){
      if(readFileSync(path,'utf8')!==body)throw Error('Existing source proof file differs from original verified bytes');
      return;
    }
    writeFileSync(path,body,{flag:'wx'});
  }
  preserveExact(LEDGER,result);
  preserveExact(CHECKPOINT,JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({sourceRows:396,uniqueRegs:275,pccRefs:1378,
    ancillaryRefs:4,originalVersions:941,amendments:437,
    compressedSourceZipSha256:ZIP_SHA,preservedPsvSha256:PSV_SHA,
    legalDenominator:null,files:[LEDGER,CHECKPOINT]},null,2));
}
main();
