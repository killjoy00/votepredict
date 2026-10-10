/**
 * Issue #864 — 138 distinct original Senate hearing-section LRL media record
 * URLs (media/file?mtgid=...). Archive identifiers are NOT recordings/votes.
 *
 * Verify exact earlier URL/JSON hashes before doing HTTP HEAD only. Never
 * download media, follow redirects, or call private database or model.
 */
import { createHash } from 'node:crypto';
export type MediaYear = 2022|2023|2024|2025;
export const PINNED_ORIGINAL_MEDIA_YEAR = {
  2022:{artifactId:11679835908,jsonSha256:'f0ab42ba46eca582739896956b5dc32a81e6c93b9b834e45eb539c49f19cfd4f',pages:12,mediaRecords:11},
  2023:{artifactId:11679855972,jsonSha256:'dbc2cea3cc58f5bbbde89d143456eddb3086050934d058ac499cbb3a29faa4b1',pages:64,mediaRecords:64},
  2024:{artifactId:11679701503,jsonSha256:'fd09197149998c792bb6c6195c59811d6b14cb4cdcd9f783055bff287035eef2',pages:42,mediaRecords:41},
  2025:{artifactId:11680255323,jsonSha256:'efd55fe0a59b949270029da71d40d906b8d4212aa1dc2fc9b93d3bac813ee159',pages:23,mediaRecords:22},
} as const;
const sha=(raw:string|Uint8Array)=>createHash('sha256').update(raw).digest('hex');
export type CandidateRecord={
  year:number;meetingDate:string;committeeName:string;officialDatePage:string;
  mediaCandidates:Array<{href:string;urlSha256:string}>;
};
export function selectPinnedMtgidRecords(year:MediaYear,raw:string):Array<{
  year:MediaYear;meetingDate:string;committeeName:string;originalCommitteeUrl:string;
  mediaUrl:string;originalMediaUrlSha256:string;mtgid:string;
}>{
  const cfg=PINNED_ORIGINAL_MEDIA_YEAR[year];
  if(sha(raw)!==cfg.jsonSha256)
    throw Error('Original 138-media href audit JSON SHA256 changed');
  const source=JSON.parse(raw) as {
    year:number;sourceRun:number;pagesFetchedAndShaVerified:number;
    pagesWithMediaCandidates:number;failedPages:number;
    exactMeetingLinks:CandidateRecord[];
  };
  if(source.year!==year||source.sourceRun!==38076153790||
    source.pagesFetchedAndShaVerified!==cfg.pages||
    source.pagesWithMediaCandidates!==cfg.mediaRecords||
    source.failedPages!==0||source.exactMeetingLinks.length!==cfg.pages)
    throw Error('Official source media meeting census drifted');
  const result:Array<{
    year:MediaYear;meetingDate:string;committeeName:string;originalCommitteeUrl:string;
    mediaUrl:string;originalMediaUrlSha256:string;mtgid:string;
  }>=[];
  for(const row of source.exactMeetingLinks){
    if(row.year!==year||!row.meetingDate.startsWith(String(year)+'-')||
      !row.committeeName.trim()||!row.officialDatePage.startsWith('https://www.lrl.mn.gov/minutes/'))
      throw Error('Invalid independently archived meeting-date identity');
    for(const record of row.mediaCandidates){
      const u=new URL(record.href);
      if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||
        u.pathname!=='/media/file'||u.searchParams.size!==1||
        !/^\d{5,12}$/.test(u.searchParams.get('mtgid')??'')||
        u.hash||sha(u.toString())!==record.urlSha256)
        throw Error('Media link not exact Senate official indexed mtgid source record');
      result.push({
        year,meetingDate:row.meetingDate,committeeName:row.committeeName,
        originalCommitteeUrl:row.officialDatePage,
        mediaUrl:u.toString(),originalMediaUrlSha256:record.urlSha256,
        mtgid:u.searchParams.get('mtgid')!,
      });
    }
  }
  if(result.length!==cfg.mediaRecords||
    new Set(result.map(x=>x.mediaUrl)).size!==cfg.mediaRecords)
    throw Error('Duplicate, missing or extra original Senate media record identifiers');
  return result;
}
export function classifyLrlMtgidHeadResponse(
  source:string,status:number,location:string|null,contentType:string|null,
  contentLength:string|null,
):{
  httpStatus:number;discoveryCategory:
    'official_media_record_http_ok'|'official_redirect_to_allowed_media_host'|
    'redirect_not_verified'|'http_unavailable'|'unsupported_http_status';
  contentType:string|null;contentLengthBytes:number|null;
  redirectHost:string|null;redirectPathSha256:string|null;
  mediaPlaybackConfirmed:false;recordedVoteConfirmed:false;
}{
  const media=new URL(source);
  if(media.protocol!=='https:'||media.hostname!=='www.lrl.mn.gov'||media.pathname!=='/media/file')
    throw Error('Source HEAD did not match official LRL mtgid media record');
  let redirectHost:null|string=null,redirectPathSha256:null|string=null;
  let approved=false;
  if([301,302,303,307,308].includes(status) && location){
    const next=new URL(location,media);
    redirectHost=next.hostname;
    redirectPathSha256=sha(next.pathname);
    approved=next.protocol==='https:'&&[
      'www.lrl.mn.gov','lrl.mn.gov',
      'mnsenate.granicus.com','archive-video.granicus.com',
    ].includes(next.hostname);
  }
  const n=contentLength!==null?Number(contentLength):NaN;
  const length=Number.isInteger(n)&&n>=0?n:null;
  const cat=status===200?'official_media_record_http_ok'
    :[301,302,303,307,308].includes(status)
      ?approved?'official_redirect_to_allowed_media_host':'redirect_not_verified'
    :[403,404,410,405].includes(status)?'http_unavailable':'unsupported_http_status';
  return {
    httpStatus:status,discoveryCategory:cat,contentType:contentType?.slice(0,80)??null,
    contentLengthBytes:length,redirectHost,redirectPathSha256,
    mediaPlaybackConfirmed:false,recordedVoteConfirmed:false,
  };
}
