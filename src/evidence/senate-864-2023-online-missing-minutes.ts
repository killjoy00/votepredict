/**
 * #864 source-only: official Minnesota Senate archived online hearing MINUTES,
 * not LRL electronic Minutes PDF and not LRL media/caption playback.
 *
 * Every target is independently on the frozen official LRL 141-no-PDF list.
 * Motion results never imply YEA/NAY persons, counts, unanimity or voice votes.
 * No database I/O, training/serving, PDF re-fetch, office contact or outreach.
 */
import {createHash} from 'node:crypto';
import {normalizeOfficialMinutesHtml} from
 './senate-2023-transportation-apr03-sf3157-source.js';

export const SENATE_864_ONLINE_2023_PROOF_VERSION =
 'senate-864-2023-missing-lrl-minutes-original-senate-html-v1' as const;
const ag='Agriculture, Broadband and Rural Development';
const tax='Taxes';
type Target={committeeName:typeof ag|typeof tax;day:string;hearingId:number;
 minimumObservedMotions:number};
export const SENATE_864_ONLINE_MISSING_MINUTE_TARGETS:readonly Target[]=[
 {committeeName:tax,day:'2023-01-10',hearingId:17328,minimumObservedMotions:0},
 {committeeName:tax,day:'2023-01-12',hearingId:17330,minimumObservedMotions:0},
 {committeeName:ag,day:'2023-02-01',hearingId:17450,minimumObservedMotions:1},
 {committeeName:ag,day:'2023-02-13',hearingId:17555,minimumObservedMotions:2},
 {committeeName:ag,day:'2023-02-15',hearingId:17556,minimumObservedMotions:0},
 {committeeName:ag,day:'2023-03-01',hearingId:17657,minimumObservedMotions:2},
 {committeeName:tax,day:'2023-03-01',hearingId:17695,minimumObservedMotions:1},
 {committeeName:tax,day:'2023-03-02',hearingId:17696,minimumObservedMotions:1},
 {committeeName:tax,day:'2023-03-07',hearingId:17759,minimumObservedMotions:0},
 {committeeName:tax,day:'2023-03-09',hearingId:17762,minimumObservedMotions:1},
 {committeeName:tax,day:'2023-03-14',hearingId:17804,minimumObservedMotions:0},
 {committeeName:ag,day:'2023-03-20',hearingId:17807,minimumObservedMotions:8},
 {committeeName:tax,day:'2023-03-16',hearingId:17820,minimumObservedMotions:0},
 {committeeName:tax,day:'2023-04-17',hearingId:17987,minimumObservedMotions:1},
] as const;

const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const sourceTitle=(t:Target)=>t.committeeName===tax?
 'Taxes Committee':'Agriculture, Broadband, and Rural Development Committee';
function dayText(day:string):string{
 const d=new Date(day+'T12:00:00Z');
 if(!/^2023-\d\d-\d\d$/.test(day)||!Number.isFinite(d.getTime())||
    d.toISOString().slice(0,10)!==day)throw Error('Invalid historical committee hearing day');
 return new Intl.DateTimeFormat('en-US',{
  timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'
 }).format(d);
}
export function exactOfficialSenateOnlineMinutesURL(t:Target):string{
 if(!Number.isSafeInteger(t.hearingId)||t.hearingId<16000||t.hearingId>19999||
   ![ag,tax].includes(t.committeeName)||!Number.isSafeInteger(t.minimumObservedMotions)
   ||t.minimumObservedMotions<0||t.minimumObservedMotions>25)
  throw Error('Unrecognized bounded official Senate hearing-minute source identity');
 dayText(t.day);
 return 'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id='+
  t.hearingId+'&ls=93&type=minutes';
}
function sourceOriginalForTarget(html:string,t:Target){
 const bytes=Buffer.byteLength(html,'utf8');
 if(bytes<1500||bytes>1_200_000||!/<html\b/i.test(html))
  throw Error('Original official Senate HTML missing or outside byte bounds');
 const text=normalizeOfficialMinutesHtml(html);
 const heading=sourceTitle(t),day=dayText(t.day);
 if(!text.includes(heading)||!text.includes(day)||!/\bMinutes\b/.test(text)||
   !/\bPresent\s*:\s*Senator\b/i.test(text))
  throw Error('Original Senate Clerk Minutes committee/day/attendance heading not verified');
 // Prevent accidental exact-date matching to unrelated footer, context or links.
 const headingIndex=text.indexOf(heading),dayIndex=text.indexOf(day,headingIndex);
 if(headingIndex<0||dayIndex<0||dayIndex-headingIndex>380)
  throw Error('Original hearing title and calendar day not adjacent');
 const anotherDate=text.indexOf(day,dayIndex+day.length);
 if(anotherDate>=0&&anotherDate-dayIndex<150)
  throw Error('Ambiguous duplicate source hearing heading');
 return {text,bytes,heading,day};
}
export interface OriginalOnlineSourceAction{
 observationOrdinal:number;
 classification:'amendment_motion_result_only'|'recommend_pass_result_only'|'other_motion_result_only';
 billReference:string|null;amendmentReference:string|null;
 outcome:'prevailed'|'failed';
 sourceMotionText:string;
 originalMotionTextSha256:string;
 originalMotionResultOffset:number;
 originalMotionNeighborhoodSha256:string;
 yeaCount:null;nayCount:null;
 individualVotesAvailable:false;
 namedMemberIdentitiesInferred:false;
 isNotAnOfficialUniqueMotionDenominator:true;
 persistedEventIdentity:null;
}
const mover=/\bSenator\s+([A-Za-zÀ-ž.'-]+(?:\s+[A-Za-zÀ-ž.'-]+){0,5})\s+(?:moved|motioned)\b/giu;
const result=/\b(?:MOTION\s+(PREVAILED|FAILED)|The\s+motion\s+(prevailed|failed))\b/giu;
const billHeading=/\bS\s*\.?\s*F\s*\.?\s*(\d{1,5})\s*:\s*Senator\b/giu;
const amendment=/\b(A-?\d{1,3}(?:-\d{1,4})?)\s+Amendment\b/giu;
export function inspectOriginalSenateOnlineMinutes(
 html:string,target:Target,receivedAt:string
){
 exactOfficialSenateOnlineMinutesURL(target);
 if(!Number.isFinite(Date.parse(receivedAt)))throw Error('Missing independently recorded retrieval time');
 const source=sourceOriginalForTarget(html,target),text=source.text;
 const actions:OriginalOnlineSourceAction[]=[];
 const seenStarts=new Set<number>();
 const headings=[...text.matchAll(billHeading)].map(x=>({at:x.index??0,bill:'SF'+Number(x[1])}));
 for(const res of text.matchAll(result)){
  const resultAt=res.index??0;
  const left=Math.max(0,resultAt-420);
  const startCandidates=[...text.slice(left,resultAt).matchAll(mover)];
  const m=startCandidates.at(-1);
  if(!m||m.index===undefined)continue;
  const motionAt=left+m.index;
  if(seenStarts.has(motionAt)||resultAt-motionAt>390)continue;
  const motion=text.slice(motionAt,resultAt+res[0].length).trim();
  // Reject a result appearing after a separate action, bill heading, agenda
  // or another motion: proximity alone is not reliable action attribution.
  const beforeResult=motion.slice(m[0].length);
  if(/\bS\s*\.?\s*F\s*\.?\s*\d+\s*:\s*Senator\b/i.test(beforeResult)
   ||[...beforeResult.matchAll(mover)].length>0
   ||/The meeting was adjourned/i.test(beforeResult))continue;
  seenStarts.add(motionAt);
  const nearestHead=headings.filter(h=>h.at<motionAt).at(-1);
  // If the previously printed bill heading is far away, it cannot support
  // assigning this parliamentary action to that bill.
  const bill=nearestHead&&motionAt-nearestHead.at<4600?nearestHead.bill:null;
  const amend=[...motion.matchAll(amendment)].at(-1)?.[1]?.toUpperCase()??null;
  const cls:OriginalOnlineSourceAction['classification']=
   amend||/\bamendment\b/i.test(motion)?'amendment_motion_result_only':
   /\brecommended\s+to\s+pass\b|\brecommend(?:ation)?\s+to\s+pass\b/i.test(motion)
     ?'recommend_pass_result_only':'other_motion_result_only';
  const outcome=(res[1]??res[2])!.toLowerCase()==='failed'?'failed':'prevailed';
  actions.push({
   observationOrdinal:actions.length,classification:cls,billReference:bill,
   amendmentReference:amend,outcome,sourceMotionText:motion.slice(0,410),
   originalMotionTextSha256:sha(motion),
   originalMotionResultOffset:resultAt,
   originalMotionNeighborhoodSha256:sha(text.slice(Math.max(0,motionAt-100),
    Math.min(text.length,resultAt+res[0].length+100))),
   yeaCount:null,nayCount:null,individualVotesAvailable:false,
   namedMemberIdentitiesInferred:false,isNotAnOfficialUniqueMotionDenominator:true,
   persistedEventIdentity:null,
  });
 }
 if(actions.length<target.minimumObservedMotions)
  throw Error('Original official Minutes omitted required independently discovered motion results');
 return {
  schemaVersion:SENATE_864_ONLINE_2023_PROOF_VERSION,
  year:2023,committeeName:target.committeeName,hearingDate:target.day,
  officialSenateHearingId:target.hearingId,
  originalSourceUrl:exactOfficialSenateOnlineMinutesURL(target),
  retrievedAt:receivedAt,sourceOriginalHtmlBytes:source.bytes,
  sourceOriginalHtmlSha256:sha(html),
  normalizedOriginalTextSha256:sha(text),
  originalSenateClerkHearingDateAndCommitteeValidated:true,
  meetingRecordedAtOriginalHearingDay:true,
  independentHtmlPublicationAt:null,
  sourceIsNotOfficialLrlMinutesPdf:true,
  sourceHasPossibleNamedRollCallOrTallyCue:
   /\broll\s+call\b|\b(?:yeas?|nays?|ayes?)\s*[:\-]/i.test(text),
  parsedResultOnlyActionCandidates:actions.length,
  unrecognizedOfficialMotionCount:null,
  transcriptParsingNotExhaustive:true,
  noVoteOrNoMotionInferredFromEmptyParserOutput:true,
  noIndividualChoicesInferredFromAttendanceOrMotionResult:true,
  noCurrentStoredRowParityPerformed:true,
  noProductionDatabaseOrModelOperations:true,
  actions,
 };
}
export function validateOnline2023TargetsAgainstOfficialNoPdfCensus(
 targets:readonly Target[],
 rows:readonly {year:number;committeeName:string;meetingDate:string;
  minutesPdfUrls:readonly string[];electronicMinutesStatus:string}[]
){
 const known=new Set(rows.filter(r=>r.year===2023&&r.minutesPdfUrls.length===0&&
  r.electronicMinutesStatus==='meeting_without_linked_minutes')
  .map(r=>[r.year,r.committeeName,r.meetingDate].join('|')));
 const used=new Set<string>(),ids=new Set<number>();
 for(const t of targets){
  exactOfficialSenateOnlineMinutesURL(t);
  const key=['2023',t.committeeName,t.day].join('|');
  if(!known.has(key)||used.has(key)||ids.has(t.hearingId))
   throw Error('Online Senate source does not uniquely match original official no-Minutes meeting');
  used.add(key);ids.add(t.hearingId);
 }
 if(targets.length!==14||known.size!==64)
  throw Error('Exact 2023 original 64 no-Minutes census / 14 hearing targets drifted');
 return {year:2023,indexedWithoutLrlMinutes:known.size,
  verifiedCandidateTargets:used.size,sourceEvidenceIsNotACompleteYear:true};
}
