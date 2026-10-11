/**
 * #864, 2021 April 8 historical COMMITTEE media sources.
 *
 * Original April 12 Journal (report day) has three separately authenticated
 * committee amendments; original April 8 bill logs authenticate two bill-level
 * actions, NOT any specific amendment's hearing day.
 *
 * This module deliberately finds source-access and possible caption cues only.
 * A listed audio/video, published agenda, automatic caption, or name match
 * NEVER verifies a named recorded roll, its hearing clock, or original public-by.
 */
import {extractSenateCaptionRequests, summarizeSenateCaptionPayload} from
  './minnesota-senate-media.js';
import {APR12_THREE_STRICT_ORIGINAL} from
  './senate-2021-apr12-three-strict-original-committee-amendments.js';

export const APR08_ORIGINAL_MEDIA = {
  schemaVersion:'senate-2021-apr08-original-lrl-granicus-media-selfservice-v1',
  eventDay:'2021-04-08',
  journalReportDay:'2021-04-12',
  cases:[
    {
      bill:'SF1159',
      committee:'Transportation Finance and Policy',
      lrlCID:3102,
      lrlURL:'https://www.lrl.mn.gov/media/file?body=s&cid=3102&date=04%2F08%2F2021',
      sourceMovers:['Dibble','McEwen'],
      agendas:[
        {clipId:6934,
         url:'https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6934&view_id=2',
         audio:'https://archive-video.granicus.com/mnsenate/mnsenate_b2093896-2a28-44fd-9393-33fa3744382e.mp3'}
      ]
    },
    {
      bill:'SF970',
      committee:'Judiciary and Public Safety Finance and Policy',
      lrlCID:3099,
      lrlURL:'https://www.lrl.mn.gov/media/file?body=s&cid=3099&date=04%2F08%2F2021',
      sourceMovers:['Pappas'],
      agendas:[
        {clipId:6938,
         url:'https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6938&view_id=2',
         audio:'https://archive-video.granicus.com/mnsenate/mnsenate_20d7c6b1-a4bc-4c26-ba19-5add98aa58fb.mp3'},
        {clipId:6939,
         url:'https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6939&view_id=2',
         audio:'https://archive-video.granicus.com/mnsenate/mnsenate_8385ded0-146c-41c5-a50e-52056c5596ae.mp3'}
      ]
    }
  ]
} as const;

export type April08MediaCase=(typeof APR08_ORIGINAL_MEDIA.cases)[number];
export type April08Agenda=(typeof APR08_ORIGINAL_MEDIA.cases)[number]['agendas'][number];

function decoded(html:string){
  return html.replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&ndash;|&mdash;/gi,'-')
    .replace(/&#0*39;|&apos;/gi,"'")
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}

const originalJournal=APR12_THREE_STRICT_ORIGINAL;

function verifyCanonicalJournalMotionLink(spec:April08MediaCase){
  const motions=originalJournal.motions.filter(m=>m.bill===spec.bill);
  if(motions.length!==spec.sourceMovers.length||
    motions.some((m,i)=>m.mover!==spec.sourceMovers[i]))
    throw Error('Unverifiable original April 12 Journal motion linkage');
  return motions.length;
}

/** Media archive page is a lead; we require exact event title and meeting day. */
export function inspectApril08LrlMediaPage(html:string,spec:April08MediaCase){
  if(Buffer.byteLength(html,'utf8')<400||Buffer.byteLength(html,'utf8')>2_000_000)
    throw Error('Historical LRL media HTML out of bounded size');
  const h1=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const h2s=[...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map(x=>decoded(x[1]??''));
  if(!h1||!decoded(h1[1]??'').toLowerCase()
       .includes(spec.committee.toLowerCase()))
    throw Error('LRL source page not demonstrably the exact historical committee');
  if(!h2s.some(x=>x.includes('04/08/2021')))
    throw Error('LRL source page does not establish April 8 2021 meeting date');
  const captionRequests=extractSenateCaptionRequests(html,spec.lrlURL);
  const motionCount=verifyCanonicalJournalMotionLink(spec);
  return {
    sourceURL:spec.lrlURL,
    committee:spec.committee,bill:spec.bill,
    lrlDateHeading:'04/08/2021',
    lrlPageCommitteeIdentityVerified:true,
    lrlPageMeetingDayVerified:true,
    distinctJournalReportedCommitteeAmendments:motionCount,
    audioTagCount:(html.match(/<audio\b/gi)??[]).length,
    videoTagCount:(html.match(/<video\b/gi)??[]).length,
    captionRequestCount:captionRequests.length,
    candidateCaptionRequests:captionRequests.slice(0,3),
    actualRecordingAudioBytesRead:false,
    motionHeardOrTimestampVerified:false,
    independentOriginalMotionDate:null,
    historicalPublicBy:null
  };
}

/** Date+committee+bill must all attach to the very same original agenda. */
export function inspectApril08OriginalAgenda(html:string,spec:April08MediaCase,clip:April08Agenda){
  if(Buffer.byteLength(html,'utf8')<350||Buffer.byteLength(html,'utf8')>1_500_000)
    throw Error('Original Granicus agenda HTML outside strict bound');
  const text=decoded(html);
  if(!/\bApril\s+8(?:th)?,?\s+2021\b/i.test(text))
    throw Error('Original Granicus agenda is not April 8 2021');
  if(!text.toLowerCase().includes(spec.committee.toLowerCase()))
    throw Error('Original Granicus agenda attached to wrong Senate committee');
  const number=spec.bill.slice(2);
  const billReg=new RegExp('\\b(?:S\\s*\\.?\\s*F\\s*\\.?\\s*0?'+number+
    '|Senate\\s+File\\s+0?'+number+')\\b','i');
  if(!billReg.test(text))throw Error('Original Granicus agenda does not list target bill');
  return {
    url:clip.url,clipId:clip.clipId,committee:spec.committee,
    bill:spec.bill,datedHearing:'2021-04-08',
    exactOriginalAgendaDayCommitteeBillVerified:true,
    audioURLIsOnlyIndexLead:true,
    amendmentMotionHeard:false,independentMotionOccurredOn:null,
    noNamedSenatorVoteInferred:true
  };
}

/** Extract ONLY hashed caption payload and nonattributable review counters. */
export function summarizeUntrustedOriginalCaption(html:string,movers:readonly string[]){
  if(Buffer.byteLength(html,'utf8')>5_000_000)
    throw Error('Automatic caption payload exceeds 5 MB source cap');
  const info=summarizeSenateCaptionPayload(html);
  const lines=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>x[1]??'');
  const apparentRows=lines.filter(line=>{
    const text=decoded(line);
    return /\bamendment\b|\broll\s*call\b/i.test(text)&&
      movers.some(name=>new RegExp('\\b'+name+'\\b','i').test(text));
  });
  return {
    ...info,
    unverifiedSameRowMoverAndAmendmentOrRollCallCaptionCues:apparentRows.length,
    automaticCaptionIsNotVerifiedRecordingOrVote:true,
    captionTextOrNamedSidesNotPersisted:true,
    specificAmendmentDayProven:false
  };
}
