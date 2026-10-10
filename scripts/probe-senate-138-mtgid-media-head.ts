/** One-time source-only metadata HEAD probe of exact 138 historical official LRL media mtgid URLs. */
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import {
  classifyLrlMtgidHeadResponse,PINNED_ORIGINAL_MEDIA_YEAR,
  selectPinnedMtgidRecords,type MediaYear,
} from '../src/evidence/senate-committee-138-mtgid-head-source.js';
const a=process.argv.slice(2);
if(a.length!==6||a[0]!=='--year'||a[2]!=='--source-json'||a[4]!=='--output')
  throw Error('Exact --year 2022|2023|2024|2025 --source-json --output required');
const y=Number(a[1]);
if(![2022,2023,2024,2025].includes(y))
  throw Error('Unlisted or nonhistorical Senate archive year');
const year=y as MediaYear,source=resolve(a[3]!),output=resolve(a[5]!);
function reason(e:unknown){
  return (e instanceof Error?e.message:String(e))
    .replace(/https?:\/\/\S+/gi,'[official source]').slice(0,150);
}
async function main(){
  const docs=selectPinnedMtgidRecords(year,readFileSync(source,'utf8'));
  const results:Array<Record<string,unknown>>=[];
  const errors:Array<{meetingDate:string;committeeName:string;mtgid:string;error:string}>=[];
  let cursor=0;
  const workers=Array.from({length:2},async()=>{
    for(;;){
      const row=docs[cursor++];
      if(!row)return;
      try{
        const resp=await fetch(row.mediaUrl,{
          method:'HEAD',redirect:'manual',
          signal:AbortSignal.timeout(30_000),
          headers:{
            'user-agent':'VotePredict/2.0 source-only-LRL-senate-media-metadata-check',
            accept:'text/html,audio/*,video/*,*/*',
          },
        });
        const proof=classifyLrlMtgidHeadResponse(row.mediaUrl,resp.status,
          resp.headers.get('location'),resp.headers.get('content-type'),
          resp.headers.get('content-length'));
        await resp.body?.cancel();
        results.push({
          year,meetingDate:row.meetingDate,committeeName:row.committeeName,
          originalOfficialCommitteeDatePage:row.originalCommitteeUrl,
          archivedPublicMediaRecordUrl:row.mediaUrl,
          mtgid:row.mtgid,archivedMediaUrlSha256:row.originalMediaUrlSha256,
          requestMethod:'HEAD',redirectFollowed:false,
          ...proof,
          notVerifiedPlaybackOrRecordedVote:true,
        });
      }catch(e){
        errors.push({meetingDate:row.meetingDate,committeeName:row.committeeName,
          mtgid:row.mtgid,error:reason(e)});
      }
    }
  });
  await Promise.all(workers);
  results.sort((a,b)=>String(a.meetingDate).localeCompare(String(b.meetingDate))
    ||String(a.mtgid).localeCompare(String(b.mtgid)));
  const statuses:Record<string,number>={},categories:Record<string,number>={};
  for(const rec of results){
    const s=String(rec.httpStatus),cat=String(rec.discoveryCategory);
    statuses[s]=(statuses[s]??0)+1;
    categories[cat]=(categories[cat]??0)+1;
  }
  const report={
    schemaVersion:'senate-138-official-lrl-mtgid-head-metadata-v1',
    issue:864,year,sourceAuthority:'Minnesota Legislative Reference Library',
    originalHrefArtifactId:PINNED_ORIGINAL_MEDIA_YEAR[year].artifactId,
    originalHrefArtifactJsonSha256:PINNED_ORIGINAL_MEDIA_YEAR[year].jsonSha256,
    selectedExactMtgidSourceRecords:docs.length,
    sourceHeadResponses:results.length,sourceHeadErrors:errors.length,
    statusCounts:statuses,categoryCounts:categories,
    sourceRecords:results,errors,
    methodHEADOnlyAndNoRedirects:true,noMediaDownload:true,
    statusDoesNotVerifyMediaContents:true,
    noTranscriptsOrNamedRecordedVoteClaims:true,
    noProductionDbModelServingOrSchedulerActions:true,
    unresolvedYear2021PrintOnlyAndYear2022PrintElectronic:true,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({year,expected:docs.length,headResponses:results.length,
    errors:errors.length,statuses,categories},null,2));
  if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(reason(e));process.exitCode=1});
