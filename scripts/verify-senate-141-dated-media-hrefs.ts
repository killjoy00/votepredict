/** One-time #864 link-level audit of 141 date-scoped LRL missing-minute pages. */
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import {
  MISSING_MEDIA_EXPECTED,
  MISSING_MEDIA_PRIOR_RUN,
  inspectPinnedDateMediaAnchors,
  loadPinnedDatedMissingMediaYear,type MissingMediaYear,
  type PriorMeetingSourceRow,
} from '../src/evidence/senate-committee-dated-media-link-proof.js';

const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const CAP=2_000_000;
function options(){
  const a=process.argv.slice(2);
  if(a.length!==6 || a[0]!=='--year'||a[2]!=='--source-json'||a[4]!=='--output')
    throw Error('Exact args: --year 2022|2023|2024|2025 --source-json PATH --output PATH');
  const y=Number(a[1]);
  if(![2022,2023,2024,2025].includes(y))throw Error('Not historical scoped Senate year');
  return {year:y as MissingMediaYear,input:resolve(a[3]!),output:resolve(a[5]!)};
}
function safe(error:unknown){
  return (error instanceof Error?error.message:String(error))
    .replace(/https?:\/\/\S+/gi,'[official LRL]').slice(0,180);
}
async function fetchOriginalOfficialPage(url:string):Promise<string>{
  const u=new URL(url);
  if(u.protocol!=='https:' || !['lrl.mn.gov','www.lrl.mn.gov'].includes(u.hostname) ||
     !['/minutes/comm','/minutes/comm.aspx'].includes(u.pathname) ||
     u.searchParams.get('body')!=='senate')
    throw Error('Refusing unofficial Senate page');
  const res=await fetch(url,{
    redirect:'manual',signal:AbortSignal.timeout(45_000),
    headers:{accept:'text/html,application/xhtml+xml',
      'user-agent':'VotePredict/2.0 Senate-historical-missing-minutes-media-validation'},
  });
  if(res.status!==200||res.url!==url)
    throw Error('Canonical Senate LRL page failed exact HTTP 200');
  const header=res.headers.get('content-length');
  if(header && Number(header)>CAP)throw Error('LRL HTML source exceeds cap');
  const reader=res.body?.getReader();
  if(!reader)throw Error('Official source HTML response body missing');
  const chunks:Uint8Array[]=[];
  let bytes=0;
  try{
    for(;;){
      const p=await reader.read();
      if(p.done)break;
      bytes+=p.value.byteLength;
      if(bytes>CAP)throw Error('LRL HTML streamed body exceeds cap');
      chunks.push(p.value);
    }
  }finally{reader.releaseLock()}
  const buf=new Uint8Array(bytes);
  let off=0;
  for(const c of chunks){buf.set(c,off);off+=c.length}
  const text=new TextDecoder().decode(buf);
  if(!/<html|<h[1-6]/i.test(text))throw Error('Official source is not meeting HTML');
  return text;
}
async function main(){
  const opt=options();
  const source=loadPinnedDatedMissingMediaYear(opt.year,readFileSync(opt.input,'utf8'));
  const results:Array<Record<string,unknown>>=[];
  const failures:Array<{meetingDate:string;committeeName:string;pageHash:string;reason:string}>=[];
  let next=0;
  const workers=Array.from({length:2},async()=>{
    for(;;){
      const row:PriorMeetingSourceRow|undefined=source[next++];
      if(!row)return;
      try{
        const html=await fetchOriginalOfficialPage(row.canonicalOfficialMeetingPage);
        const data=inspectPinnedDateMediaAnchors(
          row,html,row.canonicalOfficialMeetingPage);
        results.push({
          year:row.year,meetingDate:row.meetingDate,committeeName:row.committeeName,
          officialDatePage:row.canonicalOfficialMeetingPage,
          officialHtmlSha256:data.sourcePageHtmlSha256,
          exactHearingSectionSha256:data.sectionHtmlSha256,
          sourceHasOriginalMinutesPdfLink:false,
          mediaCandidates:data.anchors,
          mediaCandidateCount:data.anchors.length,
          exactRecordingAndVotesVerified:false,
        });
      }catch(e){
        failures.push({meetingDate:row.meetingDate,committeeName:row.committeeName,
          pageHash:sha(row.canonicalOfficialMeetingPage),reason:safe(e)});
      }
    }
  });
  await Promise.all(workers);
  results.sort((a,b)=>String(a.meetingDate).localeCompare(String(b.meetingDate))
    ||String(a.committeeName).localeCompare(String(b.committeeName)));
  const counts:Record<string,number>={};
  for(const item of results){
    for(const candidate of (item.mediaCandidates as Array<{category:string}>)){
      counts[candidate.category]=(counts[candidate.category]??0)+1;
    }
  }
  const pagesWithCandidate=results.filter(x=>Number(x.mediaCandidateCount)>0).length;
  const out={
    schemaVersion:'senate-141-date-scoped-media-links-exact-source-href-audit-v1',
    issue:864,year:opt.year,sourceRun:MISSING_MEDIA_PRIOR_RUN,
    fixedOfficialOriginalMeetingPageCount:MISSING_MEDIA_EXPECTED[opt.year].pages,
    pagesFetchedAndShaVerified:results.length,
    failedPages:failures.length,
    pagesWithMediaCandidates:pagesWithCandidate,
    expectedCandidatePages:MISSING_MEDIA_EXPECTED[opt.year].mediaPages,
    mediaCategories:counts,
    exactMeetingLinks:results,errors:failures,
    mediaHrefNotMediaPlaybackVerified:true,
    mediaAnchorNotNamedVote:true,
    noOriginalMinutesOrVoteExtracted:true,
    noPrivateDbOrModelChange:true,
  };
  mkdirSync(dirname(opt.output),{recursive:true});
  writeFileSync(opt.output,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({year:opt.year,verifiedPages:results.length,
    failures:failures.length,pagesWithMediaCandidates,mediaCategories:counts},null,2));
  if(failures.length || pagesWithCandidate!==MISSING_MEDIA_EXPECTED[opt.year].mediaPages)
    process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
