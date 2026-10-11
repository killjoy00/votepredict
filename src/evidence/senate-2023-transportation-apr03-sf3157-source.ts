/**
 * #864 source-only audit: April 3, 2023 MN Senate Transportation / SF3157.
 * The original official minutes print SEVEN named amendment roll sections.
 * The final (Howe A49 oral) has a contrary "A26" closing label, so it MUST
 * stay a conflict/hold and cannot be rewritten into an A26/A49 certified vote.
 */
import {createHash} from 'node:crypto';

export const APR03_2023_SOURCE={
 schemaVersion:'senate-2023-transportation-apr03-sf3157-official-html-seven-roll-source-v1',
 issue:864,
 committee:'Transportation',
 date:'2023-04-03',bill:'SF3157',
 originalOfficialMinutesUrl:
  'https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=17939&ls=93&type=minutes',
 originalOfficialSenateHearingId:17939,
 originalHearingFirstPublicByNotProven:true,
 maxOriginalHtmlBytes:1_200_000
} as const;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const OFFICIAL_ROSTER=new Set([
 'Dibble','Carlson','Hawj','Howe','Jasinski',
 'Lang','McEwen','Morrison','Port','Coleman'
]);
type MotionSpec={label:string;mover:string;expected:[number,number,number];verdict:'adopted'|'failed';oral?:boolean};
const MOTIONS:readonly MotionSpec[]=[
 {label:'A28',mover:'Jasinski',expected:[8,0,2],verdict:'adopted'},
 {label:'A17',mover:'Howe',expected:[2,6,2],verdict:'failed'},
 {label:'A20',mover:'Jasinski',expected:[5,4,1],verdict:'adopted'},
 {label:'A35',mover:'Jasinski',expected:[3,6,1],verdict:'failed'},
 {label:'A30',mover:'Howe',expected:[3,5,2],verdict:'failed'},
 {label:'A26',mover:'Jasinski',expected:[2,6,2],verdict:'failed'},
 {label:'A49',mover:'Howe',expected:[2,6,2],verdict:'failed',oral:true}
];
const entities=(s:string)=>s
 .replace(/&nbsp;|&#160;|&#xA0;/gi,' ')
 .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
 .replace(/&ldquo;|&laquo;/gi,'“').replace(/&rdquo;|&raquo;/gi,'”')
 .replace(/&lsquo;/gi,'‘').replace(/&rsquo;/gi,'’')
 .replace(/&mdash;/gi,'—').replace(/&ndash;/gi,'–')
 .replace(/&#39;|&apos;/gi,"'")
 .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
 .replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(Number(n)))
 .replace(/&#x([\da-f]+);/gi,(_,n:string)=>String.fromCodePoint(parseInt(n,16)));
export function normalizeOfficialMinutesHtml(html:string){
 const noScripts=html.replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)\s*>/gi,' ');
 return entities(noScripts.replace(/<[^>]*>/g,' ')).replace(/\u00a0/g,' ')
  .replace(/\s+/g,' ').trim();
}
const list=(s:string)=>s.trim()==='-'?[]:s.split(/\s*,\s*/)
 .map(n=>n.trim()).filter(Boolean);
const codes=(v:string[],side:'yea'|'nay'|'absent')=>
 v.map(s=>sha(side+':'+s.toLowerCase())).sort();
function parseHtml(html:string,roster:ReadonlySet<string>){
 if(Buffer.byteLength(html,'utf8')<1400||
  Buffer.byteLength(html,'utf8')>APR03_2023_SOURCE.maxOriginalHtmlBytes)
  throw Error('Original 2023 committee HTML size bounds invalid');
 const text=normalizeOfficialMinutesHtml(html);
 if(!/Transportation Committee\b/i.test(text)||
  !/Monday,\s*April\s+3,\s*2023\b/i.test(text)||
  !/S\.?\s*F\.?\s*3157\b/i.test(text))
  throw Error('Official committee date/bill/hearing identity missing');
 const records=MOTIONS.map(spec=>{
  const startRx=new RegExp('\\bSenator\\s+'+spec.mover+
    '\\s+moved\\s+(?:the\\s+)?'+spec.label+'\\s+amendment\\b','i');
  const intro=text.match(startRx);
  if(!intro||intro.index===undefined)throw Error('Missing exactly identified introduced '+spec.label+' motion');
  const start=intro.index;
  if(start<0||text.slice(start+intro[0].length).match(startRx))
   throw Error('Duplicate or invalid '+spec.label+' motion introduction');
  const slice=text.slice(start,start+1250);
  const voteAt=slice.search(/The committee voted as follows\s*:/i);
  if(voteAt<0)throw Error('No roll-call names printed for '+spec.label);
  // Allow HTML entity/quote punctuation around YES/NO, but REQUIRE both
  // independently printed number words to match the named-side partition.
  const outcome=slice.match(/\bWith\s+(\w+)\s+senators?\s+voting[\s\S]{0,50}?\byes\b[\s\S]{0,50}?\band\s+(\w+)\s+voting[\s\S]{0,50}?\bno\b[\s\S]{0,50}?\bthe\s+motion\s+(?:did\s+)?(not\s+)?prevail(?:ed)?\s+and\s+the\s+(A\d+)\s+amendment\s+was\s+(not\s+)?adopted\b/i);
  if(!outcome||outcome.index===undefined||outcome.index<=voteAt||
    outcome.index-voteAt>850)
   throw Error('Original named roll has no bounded disposition for '+spec.label);
  const before=slice.slice(voteAt,outcome.index);
  const m=before.match(/The committee voted as follows\s*:\s*Yes:\s*([\s\S]*?)\s*No:\s*([\s\S]*?)\s*Absent:\s*([\s\S]*?)\s*$/i);
  if(!m)throw Error('Named yea/nay/absent partition missing for '+spec.label);
  const yea=list(m[1]!),nay=list(m[2]!),absent=list(m[3]!);
  const vals=[yea.length,nay.length,absent.length];
  if(vals.join('/')!==spec.expected.join('/')||vals.reduce((a,b)=>a+b,0)!==10||
   new Set([...yea,...nay,...absent]).size!==10||
   [...yea,...nay,...absent].some(n=>!roster.has(n)))
   throw Error('Official full roster partition mismatch on '+spec.label);
  const countWord=(v:string)=>['zero','one','two','three','four',
   'five','six','seven','eight','nine','ten'].indexOf(v.toLowerCase());
  if(countWord(outcome[1]!)!==yea.length||countWord(outcome[2]!)!==nay.length)
   throw Error('Original printed tally words disagree with named sides on '+spec.label);
  const appearedAdopted=!outcome[3]&&!outcome[5];
  if(appearedAdopted!==(spec.verdict==='adopted'))
   throw Error('Original verdict inconsistent for '+spec.label);
  const printedOutcomeLabel=outcome[4]!;
  const contradiction=printedOutcomeLabel!==spec.label;
  if(contradiction!==(spec.label==='A49'))
   throw Error('Unexpected (or missing) original amendment label conflict on '+spec.label);
  if(spec.oral&&!/oral amendment to the A49 amendment/i.test(slice.slice(0,voteAt)))
   throw Error('Howe A49 oral-amendment subject missing');
  const canonical=spec.label==='A49'?'A49 oral amendment':spec.label+' amendment';
  const reviewText=slice.slice(0,outcome.index+outcome[0].length);
  return {
   printedMotionLabel:canonical,printedMover:spec.mover,
   namedYea:yea.length,namedNay:nay.length,namedAbsent:absent.length,
   reportedResult:spec.verdict,
   actualConclusionPrintedLabel:printedOutcomeLabel,
   contradictoryMotionVersusConclusionLabel:contradiction,
   originalMotionSectionTextOffset:start,
   boundedOriginalSectionSha256:sha(reviewText),
   sourceMemberIdentityHashesOnly:{
    yea:codes(yea,'yea'),nay:codes(nay,'nay'),absent:codes(absent,'absent')
   },
   rosterExactAtThisMotion:true,
   noOpeningRosterSubstitution:true,
   noIndividualMemberChoiceDatabaseImport:true,
   requiresManualReconciliationBeforeCountingDistinctVote:contradiction
  };
 });
 if(records.length!==7||records.filter(x=>x.contradictoryMotionVersusConclusionLabel).length!==1)
  throw Error('Original seven-roll / one-A49-conflict contract changed');
 return {records,
  originalAllSevenRollSectionsParsed:true,
  sourceSevenRollBlocksNotNecessarilyStoredHistoricalVotes:true,
  sixClearlyLabeledRollBlocks:6,
  oneA49OralVersusA26PrintedLabelConflict:true,
  noSourceEvidenceForVoiceVoteIndividualSides:true,
  noHistorical2021to2025StatewideDenominatorDetermined:true,
  noRawNamedSideListStored:true,
  noAutomaticModelOrMemberVoteImport:true
 };
}
export function inspectOfficialApr03SF3157(html:string){
 return parseHtml(html,OFFICIAL_ROSTER);
}
/** Test-only fictional people; real source entry always uses official roster. */
export function inspectSyntheticApr03SF3157(html:string,fictionalRoster:readonly string[]){
 if(fictionalRoster.length!==10||new Set(fictionalRoster).size!==10||
  fictionalRoster.some(s=>OFFICIAL_ROSTER.has(s)))
  throw Error('Synthetic fixture roster must consist of ten distinct fictional names');
 return parseHtml(html,new Set(fictionalRoster));
}
