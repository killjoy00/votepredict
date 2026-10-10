/**
 * #864: independently inspect official LRL date-filtered committee pages for
 * every original 2022-25 indexed meeting without a linked Minutes PDF.
 *
 * The original index JSON SHA is mandatory and 141-meeting denominator fixed.
 * Report official alternate document link/recording candidate categories,
 * never pretend agendas, recordings or media links prove recorded member votes.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  SENATE_MISSING_MINUTES_SOURCE,
  officialMissingMinutesMeetingPage,
  selectMissingMinutesFromExactIndex,
  type IndexedMissingMinutes,
  type MissingSenateMinutesYear,
} from '../src/evidence/senate-committee-missing-minutes-official-queue.js';

const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
function safe(e:unknown) {
  return (e instanceof Error ? e.message : String(e))
    .replace(/https?:\/\/\S+/gi,'[official LRL page]').slice(0,180);
}
function getOptions(){
  const a=process.argv.slice(2);
  if(a.length!==6 || a[0]!=='--year'||a[2]!=='--source-json'||a[4]!=='--output')
    throw Error('Use exact --year 2022|2023|2024|2025 --source-json PATH --output PATH');
  const year=Number(a[1]);
  if (![2022,2023,2024,2025].includes(year)) throw Error('Unknown or out-of-scope original year');
  return {year:year as MissingSenateMinutesYear,source:resolve(a[3]!),output:resolve(a[5]!)};
}
function normalized(html:string){
  return html.replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&#(\d+);/g,(_m,n:string)=>String.fromCodePoint(Number(n)))
    .replace(/\s+/g,' ').trim();
}
function extractAnchors(html:string,base:string){
  const rows:Array<{text:string;url:string}>=[];
  for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    try {
      const u=new URL(match[1]!.replace(/&amp;/gi,'&'),base);
      if (!['http:','https:'].includes(u.protocol))continue;
      rows.push({text:normalized(match[2]!).toLowerCase(),url:u.toString()});
    } catch { /* discard malformed official link */ }
  }
  return rows;
}
function analyzeHtml(row:IndexedMissingMinutes,html:string,pageUrl:string){
  const plain=normalized(html);
  const [y,m,d]=row.meetingDate.split('-');
  const visibleDay=Number(m)+'/'+Number(d)+'/'+y;
  const dateSeen=plain.includes(visibleDay);
  const actualCommitteeNameSeen=plain.toLowerCase().includes(row.committeeName.toLowerCase());
  const a=extractAnchors(html,pageUrl);
  const agenda=a.filter(x=>/\bagenda\b/i.test(x.text));
  const media=a.filter(x=>/audio|video|webcast|watch|listen|recording/i.test(x.text)||/granicus\.com/i.test(x.url));
  const minutes=a.filter(x=>/\bminutes?\b/i.test(x.text)||/_minutes\.pdf(\?|$)/i.test(x.url));
  const allMeetingDocs=a.filter(x=>/all meeting documents|all documents/i.test(x.text));
  const sourceDocs=a.filter(x=>/\.pdf(?:\?|$)/i.test(x.url) && !/_minutes\.pdf(?:\?|$)/i.test(x.url));
  const explicitMinutesOriginalForDay=minutes.some(x=>
    /\/archive\/minutes\/senate\/202[2-5]\//i.test(x.url)
    && x.url.includes('/'+row.meetingDate.replaceAll('-','')+'/')
    && /_minutes\.pdf(?:\?|$)/i.test(x.url));
  const flags={
    sourcePageContainsTargetDate:dateSeen,
    sourcePageContainsCommitteeName:actualCommitteeNameSeen,
    pageMayContainOtherMeetingDates:true,
    agendaAnchorCandidates:agenda.length,
    mediaAnchorCandidates:media.length,
    minutesAnchorCandidates:minutes.length,
    otherPdfAnchorCandidates:sourceDocs.length,
    allMeetingDocumentsAnchorCandidates:allMeetingDocs.length,
    exactDayOfficialMinutesLinkNowDetected:explicitMinutesOriginalForDay,
  };
  // Candidate links may be page-level, not proved to belong to target date.
  // False-positive source candidates cannot become recorded votes.
  const triage=explicitMinutesOriginalForDay ? 'possible_minutes_index_drift_needs_pdf_proof'
    : !dateSeen ? 'date_not_confirmed_on_current_page'
    : media.length>0 && agenda.length>0 ? 'media_and_agenda_candidate'
    : media.length>0 ? 'media_candidate'
    : agenda.length>0 ? 'agenda_candidate'
    : sourceDocs.length>0 ? 'other_official_document_candidate'
    : 'no_alternate_document_candidate_on_page';
  return { flags,triage,
    candidateLinkSha256:{
      agenda:agenda.map(x=>sha(x.url)).sort(),
      media:media.map(x=>sha(x.url)).sort(),
      minutes:minutes.map(x=>sha(x.url)).sort(),
    },
  };
}
async function fetchDatePage(url:string){
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'
     ||u.pathname!=='/minutes/comm.aspx'||u.searchParams.size!==4)
    throw Error('Refusing unscoped or unexpected committee page');
  const res=await fetch(url,{
    redirect:'manual',
    headers:{accept:'text/html,application/xhtml+xml',
      'user-agent':'VotePredict/2.0 historical-Senate-committee-minutes-source-audit'},
    signal:AbortSignal.timeout(45_000),
  });
  if(res.status!==200) throw Error('Original date-filtered LRL page HTTP status '+res.status);
  const header=res.headers.get('content-length');
  if(header!==null&&Number.isFinite(Number(header))&&Number(header)>2_000_000)
    throw Error('Original committee page oversized');
  const reader=res.body?.getReader();
  if(!reader)throw Error('Original committee page had no response body');
  let total=0;
  const chunks:Uint8Array[]=[];
  try{
    for(;;){
      const p=await reader.read();
      if(p.done)break;
      total+=p.value.byteLength;
      if(total>2_000_000)throw Error('Original LRL page exceeded streamed byte cap');
      chunks.push(p.value);
    }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(total);
  let i=0;
  for(const c of chunks){bytes.set(c,i);i+=c.byteLength}
  const html=new TextDecoder().decode(bytes);
  if(!/<html|<main|<h[1-6]/i.test(html))throw Error('Official committee source did not resemble HTML');
  return {html,rawHtmlSha256:sha(bytes),bytes:bytes.length};
}
async function main(){
  const {year,source,output}=getOptions();
  const indexed=selectMissingMinutesFromExactIndex(readFileSync(source,'utf8'));
  const selected=indexed.filter(row=>row.year===year);
  if(selected.length!==SENATE_MISSING_MINUTES_SOURCE.perYear[year])
    throw Error('Original official missing-minutes year denominator drifted');
  const groupCounts=new Map<string,number>();
  for(const row of selected)groupCounts.set(row.committeeName,(groupCounts.get(row.committeeName)??0)+1);

  const results:Array<Record<string,unknown>>=[];
  const failures:Array<{committeeName:string;meetingDate:string;pageUrlSha256:string;category:string}>=[];
  let next=0;
  const workers=Array.from({length:2},async()=>{
    for(;;){
      const ix=next++;
      const row=selected[ix];
      if(!row)return;
      const pageUrl=officialMissingMinutesMeetingPage(row);
      try{
        const page=await fetchDatePage(pageUrl);
        const flags=analyzeHtml(row,page.html,pageUrl);
        results.push({
          year:row.year,committeeName:row.committeeName,meetingDate:row.meetingDate,
          originalIndexCommitteeUrl:row.committeeUrl,dateFilteredOfficialPage:pageUrl,
          datePageHtmlSha256:page.rawHtmlSha256,datePageBytes:page.bytes,
          indexedOriginalMinutesPdfLinks:0,
          committeeMissingMinutesLinkCount:groupCounts.get(row.committeeName),
          ...flags,sourceDocumentaryVoteChoicesVerified:false,
          alternateLinkCandidatesAreNotExactRecordedVoteProof:true,
        });
      }catch(e){
        failures.push({committeeName:row.committeeName,meetingDate:row.meetingDate,
          pageUrlSha256:sha(pageUrl),category:safe(e)});
      }
    }
  });
  await Promise.all(workers);
  const score=(x:Record<string,unknown>)=>
    Number(x.committeeMissingMinutesLinkCount)*10
    + (String(x.triage).includes('minutes_index_drift')?20:0)
    + (String(x.triage).includes('media')?5:0);
  results.sort((a,b)=>score(b)-score(a)
    || String(a.committeeName).localeCompare(String(b.committeeName))
    || String(a.meetingDate).localeCompare(String(b.meetingDate)));
  const hist:Record<string,number>={};
  for(const r of results){const k=String(r.triage);hist[k]=(hist[k]??0)+1}
  const outputPayload={
    schemaVersion:'senate-2022-25-missing-minutes-alternate-source-triage-v1',
    issue:864,sourceAuthority:'Minnesota Legislative Reference Library',
    officialIndexSourceRunId:SENATE_MISSING_MINUTES_SOURCE.originalRunId,
    officialIndexArtifactId:SENATE_MISSING_MINUTES_SOURCE.originalArtifactId,
    officialIndexJsonSha256:SENATE_MISSING_MINUTES_SOURCE.originalJsonSha256,
    exactOriginal141MissingMeetingRowsSha256:SENATE_MISSING_MINUTES_SOURCE.missingOrderedRowsSha256,
    year,expectedIndexedMeetingsWithoutMinutes:selected.length,
    sourcePagesFetched:results.length,sourcePagesUnresolved:failures.length,
    candidateTriageCounts:hist,priorityQueue:results,
    failedSourcePages:failures,
    alternatePageLinksAreNotVerifiedRecordedVotes:true,
    noOriginalMinutesPdfLinkDoesNotMeanNoMeetingOrVote:true,
    dateSelectedPageLinksRequireMeetingSpecificValidation:true,
    year2021PrintOnlyMinutesUnknown:true,year2022PrintAndElectronicCanDiffer:true,
    noPrivateDbOrForecastModelSchedulerReadWrite:true,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(outputPayload,null,2)+'\n');
  console.log(JSON.stringify({year,expected:selected.length,sourcePagesFetched:results.length,
    unresolved:failures.length,triage:hist,output},null,2));
  if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
