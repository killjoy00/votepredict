/**
 * #864. April 12, 2021 Rule 12.10 Journal = REPORT day, not vote day.
 *
 * 2021 Senate committee bill logs independently date the SF1159 and SF970
 * bill-level committee actions to April 8, while the committee-specific
 * motion clock/day remains unproved without the print minutes or audio.
 *
 * Research-only verification. It does NOT replace the authoritative
 * three-motion original-Journal verifier, set occurred_on, certify historical
 * public-by, infer attendance/member votes, or access a database.
 */
import {APR12_THREE_STRICT_ORIGINAL} from './senate-2021-apr12-three-strict-original-committee-amendments.js';

export const APR08_COMMITTEE_ACTION_CROSSCHECK = {
  version:'senate-2021-apr08-two-official-bill-logs-three-apr12-journal-motions-v1',
  journalReportDay:'2021-04-12',
  candidateHearingDay:'2021-04-08',
  granicusOfficialPublisherIndex:'https://mnsenate.granicus.com/ViewPublisher.php?view_id=2',
  cases:[
    {
      bill:'SF1159',
      committee:'Transportation Finance and Policy',
      source:'https://www.senate.mn/committees/committee_bill_log.html?cmte_id=3102&ls=92',
      discussionDay:'04/06/2021',
      committeeActionDay:'04/08/2021',
      recordedResult:'Amended, recommended to pass and re-referred to the Committee on Transportation Finance and Policy',
      journalAmendmentMovers:['Dibble','McEwen'],
      hearingAgenda:'https://mnsenate.granicus.com/AgendaViewer.php?clip_id=6934&view_id=2',
      hearingAudioLead:'https://archive-video.granicus.com/mnsenate/mnsenate_b2093896-2a28-44fd-9393-33fa3744382e.mp3'
    },
    {
      bill:'SF970',
      committee:'Judiciary and Public Safety Finance and Policy',
      source:'https://www.senate.mn/committees/committee_bill_log.html?cmte_id=3099&ls=92',
      discussionDay:'04/07/2021',
      committeeActionDay:'04/08/2021',
      recordedResult:'Amended and recommended to pass',
      journalAmendmentMovers:['Pappas'],
      hearingAgenda:'https://mnsenate.granicus.com/AgendaViewer.php?clip_id=6938&view_id=2',
      hearingAudioLead:'https://archive-video.granicus.com/mnsenate/mnsenate_20d7c6b1-a4bc-4c26-ba19-5add98aa58fb.mp3',
      continuedHearingAgenda:'https://mnsenate.granicus.com/AgendaViewer.php?clip_id=6939&view_id=2',
      continuedHearingAudioLead:'https://archive-video.granicus.com/mnsenate/mnsenate_8385ded0-146c-41c5-a50e-52056c5596ae.mp3'
    }
  ]
} as const;

export type HistoricalBillCase=(typeof APR08_COMMITTEE_ACTION_CROSSCHECK.cases)[number];

function visibleHtmlText(html:string){
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&rsquo;|&#8217;/gi,"'")
    .replace(/\s+/g,' ').trim();
}

/** Exact bill-local status; rejects a global page-wide date-only match. */
export function inspectOriginalApril08BillLog(html:string,spec:HistoricalBillCase){
  if(Buffer.byteLength(html,'utf8')<150||Buffer.byteLength(html,'utf8')>2_000_000)
    throw Error('Senate official HTML source size outside allowed bounds');
  const text=visibleHtmlText(html);
  const firstListedBill=text.search(/\bS\.F\.\s*\d{4}\s*:/i);
  if(firstListedBill<0||!text.slice(Math.max(0,firstListedBill-200),firstListedBill)
    .includes('Committee on '+spec.committee))
    throw Error('Wrong original Senate committee bill-log page');
  const billNumber=spec.bill.replace('SF','');
  const billStart=new RegExp('\\bS\\.F\\.0?'+billNumber+'\\s*:', 'gi');
  const intros=[...text.matchAll(billStart)];
  if(intros.length!==1||intros[0]?.index===undefined)
    throw Error('Senate bill identity not uniquely present on original committee page');
  const marker='DATE UNOFFICIAL STATUS FOR SF'+billNumber.padStart(4,'0');
  const at=text.indexOf(marker,intros[0].index);
  const afterStart=intros[0].index+intros[0][0].length;
  const nextBill=text.slice(afterStart).search(/\bS\.F\.\s*\d{4}\s*:/i);
  const end=nextBill<0?text.length:afterStart+nextBill;
  if(at<0||at>end)throw Error('Target committee status section missing or attached to another bill');
  const local=text.slice(at+marker.length,end);
  const dateTokens=[...local.matchAll(/\b\d{2}\/\d{2}\/2021\b/g)].map(m=>m[0]);
  if(dateTokens.filter(d=>d===spec.discussionDay).length!==1||
     dateTokens.filter(d=>d===spec.committeeActionDay).length!==1)
    throw Error('Original discussion and action date identities missing or nonunique');
  const discussion=local.match(new RegExp(
    spec.discussionDay.replace(/\//g,'\\/')+'\\s+Meeting scheduled[^]*?Discussion only','i'));
  if(!discussion||discussion[0].includes(spec.committeeActionDay))
    throw Error('Discussion-only source day not isolated from committee action');
  const action=local.match(new RegExp(
    spec.committeeActionDay.replace(/\//g,'\\/')+
    '\\s+Meeting scheduled[^]*?'+spec.recordedResult,'i'));
  if(!action||action[0].includes('04/12/2021')||
     action[0].includes('Discussion only'))
    throw Error('Original April 8 committee action result not attached to target bill/day');
  const motions=APR12_THREE_STRICT_ORIGINAL.motions.filter(m=>m.bill===spec.bill);
  if(motions.length!==spec.journalAmendmentMovers.length||
     motions.some((m,i)=>m.mover!==spec.journalAmendmentMovers[i]))
    throw Error('Canonical original Journal motion identity does not match this hearing-date crosscheck');
  return {
    bill:spec.bill,
    committee:spec.committee,
    sourceURL:spec.source,
    originallyPrintedDiscussionDay:spec.discussionDay,
    originallyPrintedCommitteeBillActionDay:spec.committeeActionDay,
    observedBillLevelResult:spec.recordedResult,
    journalReportDay:APR08_COMMITTEE_ACTION_CROSSCHECK.journalReportDay,
    originalJournalSeparateAmendmentMovers:motions.map(m=>m.mover),
    originalJournalSeparateAmendments:motions.length,
    candidateHearingDay:APR08_COMMITTEE_ACTION_CROSSCHECK.candidateHearingDay,
    billActionDaySupportedByOriginalOfficialSenateBillLog:true,
    exactAmendmentMotionDayProvenByBillLog:false,
    verifiedMotionOccurredOn:null,
    independentlyProvenHistoricalPublicBy:null,
    archivedHearingAudioIdentifiedButNotListened:true,
    noCommitteePrintMinuteOriginalRead:true,
    noProductionSourceOrMemberVoteReconciliation:true
  };
}