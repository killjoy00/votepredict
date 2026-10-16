/**
 * #864 Original 2021 April 12 Senate Journal forensic layout, two indexed
 * committee Rule12.10 reports. This does not authenticate a named vote.
 * Historical individual voting-side names are REDACTED before any output.
 */
import {createHash} from 'node:crypto';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const normalized=(s:string)=>s.replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
const ALLOW=new Set(('Pursuant to Rule upon the request of three members a roll call was taken on '+
'the motion that S F No as amended be recommended pass re referred There were yeas and nays '+
'as follows Those who voted in affirmative negative Senator Senators The amendment was not '+
'adopted motion prevailed failed do does result year Committee Finance Policy Transportation '+
'Judiciary Public Safety JOURNAL OF THE SENATE DAY MONDAY APRIL REPORT VOTE IN COMMITTEE '+
'original original printed source page of divided portion table oral first second to ').split(/\s+/));
function sanitized(s:string){
 return s.replace(/[A-Za-z]+(?:['-][A-Za-z]+)*/g,
  word=>ALLOW.has(word)?word:'[REDACTED]').slice(0,1800);
}
const anchor=/Pursuant\s+to\s+Rule\s+12\.10,\s+upon\s+the\s+request\s+of\s+three\s+members,\s+a\s+roll\s+call\s+was\s+taken\s+on\s+/gi;
export function inspectOriginalApril12SourceLayout(text:string){
 if(text.length<8000||text.length>5_000_000)
  throw Error('Original daily Senate Journal text bounds invalid');
 const full=normalized(text);
 if(!full.includes('MONDAY, APRIL 12, 2021')||
    !full.includes('JOURNAL OF THE SENATE'))
  throw Error('Wrong original April12 Senate Journal edition');
 const motions=[...full.matchAll(anchor)].filter(x=>x.index!==undefined);
 const windows=[];
 for(const number of [1159,970]){
  const lead=motions.filter(m=>new RegExp('S\\.F\\.\\s+No\\.\\s+'+number+'\\b','i')
   .test(full.slice(m.index!,m.index!+700)));
  const slots=lead.slice(0,3).map(m=>{
   const pos=m.index!;
   const prefix=full.slice(Math.max(0,pos-290000),pos);
   const heading=prefix.lastIndexOf('REPORT OF VOTE IN COMMITTEE');
   const header=prefix.lastIndexOf('S.F. No. '+number+':');
   // Bound at next Rule12.10 motion so a later bill cannot lend its tally.
   const nextOriginalMotion=motions.find(x=>x.index!==undefined&&x.index>pos)?.index??pos+1400;
   const immediate=full.slice(pos,Math.min(pos+1400,nextOriginalMotion));
   const tallies=[...immediate.matchAll(/There\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),\s+as\s+follows:/gi)];
   const printedOutcome=immediate.match(/The\s+(motion|amendment)\s+(was\s+)?(not\s+)?(adopted|prevailed|failed)/i);
   return {
    originalTextOffset:pos,
    originalMotionContextSHA256:sha(immediate.slice(0,450)),
    nearestOriginalCommitteeHeadingCharactersBefore:heading<0?null:prefix.length-heading,
    nearestBillIntroductionCharactersBefore:header<0?null:prefix.length-header,
    printedTallyCandidates:tallies.map(x=>({yea:Number(x[1]),nay:Number(x[2]),
      charactersAfterMotion:x.index??null})),
    printedOutcomeWords:printedOutcome?printedOutcome[0]:null,
    redactedSourcePrefix:sanitized(full.slice(Math.max(0,pos-220),pos)),
    redactedOriginalRollOpening:sanitized(immediate.slice(0,850))
   };
  });
  const billPattern=new RegExp('S\\.F\\.\\s+No\\.\\s+'+number+'\\b','gi');
  const references=[...full.matchAll(billPattern)].slice(0,12).map(x=>x.index);
  const printedPage=new RegExp('(?:\\[\\s*36TH\\s+DAY\\s+JOURNAL\\s+OF\\s+THE\\s+SENATE\\s+'+(number===1159?'2086':'2147')+
   '|\\b'+(number===1159?'2086':'2147')+'\\s+JOURNAL\\s+OF\\s+THE\\s+SENATE)','i');
  const pageMatch=full.match(printedPage);
  windows.push({
   bill:'SF'+number,originalJournalPage:number===1159?2086:2147,
   exactIndexedRule1210BillMotionCount:lead.length,
   matchingRule1210Candidates:slots,
   firstTwelveBillMentionNormalizedOffsets:references,
   printedJournalPageHeaderFound:!!pageMatch,
   printedJournalPageHeaderNormalizedOffset:pageMatch?.index??null,
   allOriginalMemberNamesInProbeOutputRedacted:true,
   thisLayoutDiagnosticDoesNotCertifyNamedRolls:true
  });
 }
 return {
  schemaVersion:'2021-apr12-original-rule1210-two-roll-redacted-layout-v1',
  originalNormalizedTextSHA256:sha(full),
  namedSectionAnchorsInWholeOriginalJournal:motions.length,
  journalPublicationDay:'2021-04-12',
  indexedRule1210Candidates:windows,
  noOriginalMemberBySideNamesEmitted:true,
  sourcePrintedAbsentFieldNotInferred:true,
  noMeetingDateOrSameDayHistoricalCutoffInferred:true,
  noPrivateDBOrFloorOrModelChange:true,
  issue864RemainsOpen:true
 };
}
