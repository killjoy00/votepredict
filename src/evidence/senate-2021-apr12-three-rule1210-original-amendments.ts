/**
 * #864 source-only DISCOVERY from exact 2021-04-12 official Senate Journal:
 * SF1159 TWO different Rule12.10 amendment motions and SF970 ONE.
 * Original historical member-by-side names are never returned or persisted;
 * first-pass hashes are PROVISIONAL until independent strict second acquisition.
 * These are COMMITTEE amendments, never Senate floor or bill recommendation votes.
 */
import {createHash} from 'node:crypto';
export const SOURCE={
 version:'mn-2021-apr12-three-provisional-rule1210-committee-amendments-v1',
 url:'https://www.senate.mn/journals/2021-2022/20210412036.pdf',
 journalDay:'2021-04-12',
 journalDateTitle:'MONDAY, APRIL 12, 2021',
 expected:[
  {bill:'SF1159',journalPage:2086,yea:4,nay:6,ordinal:1,committee:'Transportation Finance and Policy'},
  {bill:'SF1159',journalPage:2086,yea:4,nay:6,ordinal:2,committee:'Transportation Finance and Policy'},
  {bill:'SF970',journalPage:2147,yea:3,nay:6,ordinal:1,committee:'Judiciary and Public Safety Finance and Policy'}
 ] as const
};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const normalize=(s:string)=>s.replace(/\u0000/g,' ')
 .replace(/--\s*\d+\s+of\s+\d+\s*--/g,' ')
 .replace(/\s+/g,' ').trim();
const names=(s:string)=>s.replace(/,\s+and\s+/gi,', ')
 .replace(/\s+and\s+/gi,', ')
 .split(/\s*,\s*/).map(n=>n.trim()).filter(Boolean);
const namedSideHash=(side:'yea'|'nay',ns:readonly string[])=>
 sha(ns.map(n=>sha(side+':'+n.toLowerCase())).sort().join('|'));

export function probeOriginalApril12ThreeRule1210Amendments(text:string){
 if(text.length<8000||text.length>5_000_000)throw Error('Original Senate Journal text bounds invalid');
 const flat=normalize(text);
 if(!flat.includes('JOURNAL OF THE SENATE')||!flat.includes(SOURCE.journalDateTitle))
  throw Error('Wrong original April12 Senate Journal text edition');
 const re=/Pursuant\s+to\s+Rule\s+12\.10,\s+upon\s+the\s+request\s+of\s+three\s+members,\s+a\s+roll\s+call\s+was\s+taken\s+on\s+the\s+([A-Za-z][A-Za-z .'-]{0,90}?)\s+amendment\s+to\s+S\.F\.\s+No\.\s+(1159|970)\./gi;
 const matches=[...flat.matchAll(re)];
 const records=[];
 const problems:string[]=[];
 for(let k=0;k<SOURCE.expected.length;k++){
  const s=SOURCE.expected[k]!;
  const m=matches[k];
  const row:{
   bill:string;billMotionOrdinal:number;committee:string;journalPage:number;
   originalMotionProposer:string|null;printedYea:number|null;printedNay:number|null;
   printedAbsent:null;outcome:string|null;motionNormalizedOffset:number|null;
   resultNormalizedOffset:number|null;motionAndResultNeighborhoodSHA256:string|null;
   originalIndividualNamedSideSHA256Only:{yea:string;nay:string}|null;
   precedingOfficialCommitteeHeadingWithin650:boolean;
   firstPassOnlyNotIndependentSourceCertified:true
  }={
   bill:s.bill,billMotionOrdinal:s.ordinal,committee:s.committee,journalPage:s.journalPage,
   originalMotionProposer:null,printedYea:null,printedNay:null,printedAbsent:null,
   outcome:null,motionNormalizedOffset:null,resultNormalizedOffset:null,
   motionAndResultNeighborhoodSHA256:null,originalIndividualNamedSideSHA256Only:null,
   precedingOfficialCommitteeHeadingWithin650:false,firstPassOnlyNotIndependentSourceCertified:true
  };
  if(!m||m.index===undefined||'SF'+m[2]!==s.bill){
   problems.push('Expected distinct Rule12.10 motion ordering/bill identity not validated');
   records.push(row);continue;
  }
  const pos=m.index;
  const earlier=flat.slice(Math.max(0,pos-300000),pos);
  const h=earlier.lastIndexOf('REPORT OF VOTE IN COMMITTEE');
  if(h<0||earlier.length-h>650){
   problems.push('Original committee heading too remote from motion '+s.bill+' #'+s.ordinal);
   records.push(row);continue;
  }
  row.precedingOfficialCommitteeHeadingWithin650=true;
  row.originalMotionProposer=m[1]!.trim();
  row.motionNormalizedOffset=pos;
  const nextMotion=matches.find(x=>x.index!==undefined&&x.index>pos)?.index??flat.length;
  const after=flat.slice(pos+m[0].length,Math.min(pos+m[0].length+1250,nextMotion));
  const pattern=/^\s*There\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),\s+as\s+follows:\s*Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:\s*Senators?\s+([\p{L}\p{M} ,.'-]+?)\.\s*Those\s+who\s+voted\s+in\s+the\s+negative\s+were:\s*Senators?\s+([\p{L}\p{M} ,.'-]+?)\.\s*The\s+amendment\s+was\s+not\s+adopted\./iu;
  const result=after.match(pattern);
  if(!result){
   problems.push('Exact named adjacent two-side amendment result missing for '+s.bill+' #'+s.ordinal);
   records.push(row);continue;
  }
  const y=names(result[3]!),n=names(result[4]!);
  const yCount=Number(result[1]),nCount=Number(result[2]);
  if(yCount!==s.yea||nCount!==s.nay||y.length!==yCount||n.length!==nCount||
     new Set([...y,...n].map(x=>x.toLowerCase())).size!==yCount+nCount){
   problems.push('Printed name roster fails exact tally/uniqueness for '+s.bill+' #'+s.ordinal);
   records.push(row);continue;
  }
  row.printedYea=yCount;row.printedNay=nCount;row.outcome='amendment not adopted';
  row.resultNormalizedOffset=pos+m[0].length+(result.index??0);
  row.motionAndResultNeighborhoodSHA256=sha(flat.slice(Math.max(0,pos-160),
   Math.min(flat.length,pos+m[0].length+(result.index??0)+result[0].length+100)));
  row.originalIndividualNamedSideSHA256Only={
   yea:namedSideHash('yea',y),nay:namedSideHash('nay',n)
  };
  records.push(row);
 }
 if(matches.length!==SOURCE.expected.length)
  problems.push('Expected exactly three original indexed April12 Rule12.10 amendment paragraphs');
 return {
  schemaVersion:SOURCE.version,officialSourceURL:SOURCE.url,
  originalSenateJournalReportDate:SOURCE.journalDay,
  sourceOriginalNormalizedTextSHA256:sha(flat),
  originalIndexedAmendmentMotionCount:matches.length,
  originalProvisionalMotions:records,provisionalDiscoveryErrors:problems,
  originalProvisionalRollsFullyParsed:records.filter(x=>x.originalIndividualNamedSideSHA256Only!==null).length,
  distinctSF1159AmendmentsMustNotDeduplicateEvenIfSameSides:true,
  namedSideDigestsNotIndependentlyAuthenticatedUntilNewOriginalRun:true,
  neverEmitReadableSenatorChoiceLists:true,
  missingAbsentCountRemainsNull:true,meetingAndFirstPublicTimeUnproven:true,
  noPrivateProductionDBOrMemberVoteImport:true,
  noSenateFloorOrModelsOr2027:true,issue864RemainsOpen:true
 };
}
