/**
 * #864: Link-level inspection of dated Senate committee missing-Minutes
 * candidate media anchors. Historical exact official source identity is
 * independently pinned; a media link is NOT a verified recording or vote.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { findExactOfficialMeetingDateSection } from './senate-committee-date-section.js';

export type MissingMediaYear = 2022|2023|2024|2025;
export const MISSING_MEDIA_EXPECTED = {
  2022: {pages:12,mediaPages:11}, 2023:{pages:64,mediaPages:64},
  2024: {pages:42,mediaPages:41}, 2025:{pages:23,mediaPages:22},
} as const;
export const MISSING_MEDIA_PRIOR_RUN=38076153790;

const hash=(raw:string|Uint8Array)=>createHash('sha256').update(raw).digest('hex');
function clean(html:string):string{
  return html.replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&#(\d+);/g,(_m,n:string)=>String.fromCodePoint(Number(n)))
    .replace(/\s+/g,' ').trim();
}
export type MediaAnchor={
  href:string;urlSha256:string;label:string;
  hostname:string;category:
  'likely_specific_media_clip'|'date_parameter_candidate'|'archive_or_publisher_landing'|'other_unverified_media_link';
  recordingVerified:false;namedVoteVerified:false;
};
export type PriorMeetingSourceRow={
  year:number;meetingDate:string;committeeName:string;
  canonicalOfficialMeetingPage:string;
  datePageHtmlSha256:string;
  flags:{
    datedMeetingSectionHtmlSha256:string;
    exactDatedMeetingSectionVerified:boolean;
    mediaAnchorCandidates:number;
  };
  candidateLinkSha256:{media:string[]};
};
export function loadPinnedDatedMissingMediaYear(
  year:MissingMediaYear,raw:string,
):PriorMeetingSourceRow[]{
  const ledger=JSON.parse(readFileSync(new URL(
    '../../docs/evaluation/source-proof/senate-committee-141-dated-alternate-source-ledger.json',
    import.meta.url),'utf8')) as {
    scopedSourceRun:{runId:number;recordsByYear:Array<{
      year:number,jsonSha256:string,dateSectionsVerified:number,datedSectionMediaPages:number,
    }>};
  };
  const proof=ledger.scopedSourceRun.recordsByYear.find(x=>x.year===year);
  if(ledger.scopedSourceRun.runId!==MISSING_MEDIA_PRIOR_RUN || !proof ||
    hash(raw)!==proof.jsonSha256)
    throw Error('Official dated meeting page triage artifact digest did not match');
  const parsed=JSON.parse(raw) as {
    year:number;expectedIndexedMeetingsWithoutMinutes:number;
    priorityQueue:PriorMeetingSourceRow[];
    sourcePagesUnresolved:number;
  };
  if(parsed.year!==year || parsed.sourcePagesUnresolved!==0 ||
    parsed.expectedIndexedMeetingsWithoutMinutes!==MISSING_MEDIA_EXPECTED[year].pages ||
    !Array.isArray(parsed.priorityQueue) ||
    parsed.priorityQueue.length!==MISSING_MEDIA_EXPECTED[year].pages ||
    parsed.priorityQueue.filter(x=>x.flags.mediaAnchorCandidates>0).length!==
      MISSING_MEDIA_EXPECTED[year].mediaPages ||
    proof.dateSectionsVerified!==parsed.priorityQueue.length ||
    proof.datedSectionMediaPages!==MISSING_MEDIA_EXPECTED[year].mediaPages)
    throw Error('Original dated meeting page denominator changed');
  const seen=new Set<string>();
  for(const row of parsed.priorityQueue){
    const u=new URL(row.canonicalOfficialMeetingPage);
    if(row.year!==year || !row.meetingDate.startsWith(String(year)+'-') ||
      !row.committeeName.trim() ||
      u.protocol!=='https:'||!['lrl.mn.gov','www.lrl.mn.gov'].includes(u.hostname) ||
      !['/minutes/comm','/minutes/comm.aspx'].includes(u.pathname) ||
      u.searchParams.get('year')!==String(year) ||
      u.searchParams.get('body')!=='senate' ||
      !/^[a-f0-9]{64}$/.test(row.datePageHtmlSha256) ||
      !/^[a-f0-9]{64}$/.test(row.flags.datedMeetingSectionHtmlSha256) ||
      !row.flags.exactDatedMeetingSectionVerified ||
      row.flags.mediaAnchorCandidates!==(row.candidateLinkSha256.media?.length??-1) ||
      seen.has(row.canonicalOfficialMeetingPage))
      throw Error('Untrusted or duplicate official dated meeting source row');
    seen.add(row.canonicalOfficialMeetingPage);
    const [yy,mm,dd]=row.meetingDate.split('-');
    if(u.searchParams.get('date')!==Number(mm)+'/'+Number(dd)+'/'+yy)
      throw Error('Dated meeting link does not match original hearing date');
  }
  return parsed.priorityQueue;
}
function category(url:URL,hearingDate:string):MediaAnchor['category']{
  const p=url.pathname.toLowerCase();
  if((/\/mediaplayer\.php$/i.test(p)&&url.searchParams.has('clip_id'))||
    (url.hostname==='www.youtube.com'&&
      (p==='/watch'&&url.searchParams.has('v')||p.startsWith('/live/'))) ||
    (url.hostname==='youtu.be'&&p.length>2))
    return 'likely_specific_media_clip';
  if(url.searchParams.toString().includes(hearingDate) ||
    url.pathname.includes(hearingDate) ||
    url.searchParams.has('event_id')||url.searchParams.has('meeting_id'))
    return 'date_parameter_candidate';
  if(/viewpublisher|\bmedia\b|\barchive\b|\bindex\b|\bsearch\b/i.test(p))
    return 'archive_or_publisher_landing';
  return 'other_unverified_media_link';
}
export function inspectPinnedDateMediaAnchors(
  row:PriorMeetingSourceRow,html:string,finalUrl:string,
):{anchors:MediaAnchor[];sectionHtmlSha256:string;sourcePageHtmlSha256:string}{
  if(hash(html)!==row.datePageHtmlSha256)
    throw Error('Official original HTML source page changed; no source substitution');
  if(finalUrl!==row.canonicalOfficialMeetingPage)
    throw Error('Original canonical official page did not match');
  const section=findExactOfficialMeetingDateSection(html,row.meetingDate);
  if(!section.scopeVerified || !section.sectionHtml ||
    hash(section.sectionHtml)!==row.flags.datedMeetingSectionHtmlSha256)
    throw Error('Original date-isolated meeting section SHA changed');
  const anchors:MediaAnchor[]=[];
  for(const found of section.sectionHtml.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    let u:URL;
    try {u=new URL(found[1]!.replace(/&amp;/gi,'&'),finalUrl)}
    catch {continue}
    if(!['http:','https:'].includes(u.protocol))continue;
    const label=clean(found[2]!).toLowerCase();
    if(!(/audio|video|webcast|watch|listen|recording/i.test(label)||
      /granicus\.com/i.test(u.toString())))continue;
    anchors.push({
      href:u.toString(),urlSha256:hash(u.toString()),
      label:label.slice(0,100),hostname:u.hostname,
      category:category(u,row.meetingDate),
      recordingVerified:false,namedVoteVerified:false,
    });
  }
  const observed=anchors.map(x=>x.urlSha256).sort();
  const expected=[...row.candidateLinkSha256.media].sort();
  if(observed.length!==expected.length ||
    observed.some((value,index)=>value!==expected[index]))
    throw Error('Previously verified meeting-specific media anchor URL hash changed');
  return {anchors,sectionHtmlSha256:hash(section.sectionHtml),
    sourcePageHtmlSha256:hash(html)};
}
