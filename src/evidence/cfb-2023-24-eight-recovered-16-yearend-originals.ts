/**
 * #864 finance Track A: only sixteen 2023/24 original YE report PDFs for the
 * eight authenticated 2022-serving senators whose 2024 CFB viewer snapshots
 * were recovered separately. Never implies legal duty or 2023/24 service.
 */
import {createHash} from 'node:crypto';
import {selectEightPreviouslyUnobservedActualSenators}
  from './cfb-2024-eight-unobserved-verified-senator-viewers.js';
import type {Verified2023to24OriginalTarget}
  from './cfb-2023-24-served-28-yearend-originals.js';

export const EIGHT_NEW_2023_24_ORIGINALS_VERSION=
  'cfb-2023-24-eight-verified-2022-senators-sixteen-source-original-yearend-pdfs-v1' as const;
const records=(x:string)=>x.trimEnd().split('\n').filter(Boolean).map(y=>y.split('|'));
const gitBlobSha=(x:string)=>createHash('sha1')
  .update('blob '+Buffer.byteLength(x,'utf8')+'\0').update(x,'utf8').digest('hex');
const SHA=/^[a-f0-9]{64}$/;
export function selectEightRecoveredSenators16OriginalYearends(input:{
  firstCePsv:string;secondCePsv:string;previousViewerPsv:string;
  sourceSnapshotPsv:string;source27VersionPsv:string;sourceCheckpointJson:string;
}):Verified2023to24OriginalTarget[]{
  const members=selectEightPreviouslyUnobservedActualSenators({
    firstCfbOriginalCePsv:input.firstCePsv,
    secondCfbOriginalCePsv:input.secondCePsv,
    priorSampledViewerPsv:input.previousViewerPsv,
  });
  const cp=JSON.parse(input.sourceCheckpointJson);
  if(cp.schemaVersion!=='cfb-2024-eight-previously-unsampled-real-senator-original-api-source-checkpoint-v1'
    ||cp.issue!==864||cp.scope.independentlyVerifiedActuallyServingIn2022!==8
    ||cp.viewerSnapshotsLedger.rows!==8
    ||cp.exactNewViewerReferences.rows!==27
    ||gitBlobSha(input.sourceSnapshotPsv)!==cp.viewerSnapshotsLedger.gitBlobSha
    ||gitBlobSha(input.source27VersionPsv)!==cp.exactNewViewerReferences.gitBlobSha
    ||cp.independentOriginalSourceRecheck?.allEightOriginalCfbApiBodySha256Identical!==true
    ||cp.independentOriginalSourceRecheck?.allTwentySevenExactOriginalViewerReportVersionIdsIdentical!==true)
    throw Error('Original independent CFB 2024 viewer sources are not pinned and reverified');
  const sourceRecords=records(input.sourceSnapshotPsv);
  const versionRecords=records(input.source27VersionPsv);
  const memberByReg=new Map(members.map(x=>[x.reg,x]));
  const byReg=new Map(sourceRecords.map(x=>[x[0],x]));
  if(byReg.size!==8||sourceRecords.length!==8||versionRecords.length!==27)
    throw Error('Official 8 CFB viewer responses and 27 version references changed');
  for(const row of sourceRecords){
    const m=memberByReg.get(row[0]!);
    if(row.length!==10||!m||m.senator!==row[1]||m.district!==Number(row[2])
      ||!SHA.test(row[3]!)||!row[4]||row[5]!=='1'||row[7]!=='1')
      throw Error('Actual serving senator original CFB report viewer snapshot invalid');
    const ids=row[9]!.split(',');
    if(ids.length!==new Set(ids).size
      ||ids.length!==Number(row[5])+Number(row[6])+Number(row[7])+Number(row[8]))
      throw Error('CFB viewer reference count or uniqueness changed');
  }
  const originals:Verified2023to24OriginalTarget[]=[];
  const seen=new Set<string>();
  for(const row of versionRecords){
    const [id,senator,district,reg,viewerSha,viewedAt,className]=row;
    const m=memberByReg.get(reg!),viewer=byReg.get(reg!);
    const sourceParts=/^(\d+):(23|24):pcc:YE:0:(\d+)$/.exec(id??'');
    if(row.length!==7||!sourceParts||sourceParts[1]!==reg||!m||!viewer
      ||senator!==m.senator||Number(district)!==m.district
      ||viewerSha!==viewer[3]||viewedAt!==viewer[4]
      ||!viewer[9]!.split(',').includes(id!)||seen.has(id!))
      throw Error('Unverified exact serving-senator report identity in CFB source references');
    seen.add(id!);
    const original=sourceParts[3]==='0';
    if(className!==(original?'original_viewer_reference_not_yet_pdf_authenticated'
      :'amendment_viewer_reference_not_yet_pdf_authenticated'))
      throw Error('CFB PDF source status must not be assumed');
    if(!original)continue;
    originals.push({id:id!,reg:reg!,actualSenator:senator!,
      district2022:m.district,reportYear:sourceParts[2]==='23'?2023:2024,
      originalViewerApiSha256:viewerSha!,originalViewerSegment:2024,
      reportingPeriod:'YE',amendmentIndex:0,specialElectionFlag:'0'});
  }
  if(seen.size!==27||originals.length!==16
    ||new Set(originals.map(x=>x.id)).size!==16
    ||new Set(originals.map(x=>x.reg)).size!==8
    ||originals.filter(x=>x.reportYear===2023).length!==8
    ||originals.filter(x=>x.reportYear===2024).length!==8)
    throw Error('Exactly sixteen 2023/24 original PDF source references not independently proven');
  for(const reg of memberByReg.keys()){
    if(originals.filter(x=>x.reg===reg).length!==2)
      throw Error('Actual senator has no paired original YE viewer source references');
  }
  return originals.sort((a,b)=>a.district2022-b.district2022||a.reportYear-b.reportYear);
}
