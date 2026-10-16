/**
 * #864 explicit per-source checks of the 15 OCR-derived named Senate committee
 * roll-call parser candidates in 10 independently source-hashed PDFs.
 * No source text, names or production/private DB loaded into this manifest.
 */
import { readFileSync } from 'node:fs';

export type NamedReviewDoc={
  year:2022|2025;meetingDate:string;committeeName:string;
  url:string;originalRawPdfSha256:string;ocrTextSha256:string;
  expectedNamedRolls:number;expectedNamedChoices:number;
};
export function getAllPreviouslyPinnedNamedOcrCandidateOriginals():NamedReviewDoc[]{
  const final=JSON.parse(readFileSync(new URL(
    '../../docs/evaluation/source-proof/senate-committee-final-152-ocr-source-ledger.json',
    import.meta.url),'utf8')) as {
    sourceOcrRun:number;namedSourceHighlights:Array<{
      meetingDate:string;committeeName:string;officialPdfUrl:string;
      pdfSha256:string;ocrTextSha256:string;
      namedRolls:number;namedChoices:number;
    }>;
  };
  const prior=JSON.parse(readFileSync(new URL(
    '../../docs/evaluation/source-proof/senate-committee-30-scanned-ocr-source-ledger.json',
    import.meta.url),'utf8')) as {
    candidateNamedRollHighlight:{
      year:number;meetingDate:string;committee:string;originalPdfUrl:string;
      originalPdfSha256:string;ocrTextSha256:string;
      candidateNamedRollCallCount:number;candidateSourceNamedMemberChoices:number;
    };
  };
  if(final.sourceOcrRun!==38075234242 ||
    final.namedSourceHighlights.length!==9 ||
    prior.candidateNamedRollHighlight.year!==2025)
    throw Error('Unexpected final/previous independent named original source manifests');
  const docs:NamedReviewDoc[]=final.namedSourceHighlights.map(r=>({
    year:Number(r.meetingDate.slice(0,4)) as 2022|2025,
    meetingDate:r.meetingDate,committeeName:r.committeeName,url:r.officialPdfUrl,
    originalRawPdfSha256:r.pdfSha256,ocrTextSha256:r.ocrTextSha256,
    expectedNamedRolls:r.namedRolls,expectedNamedChoices:r.namedChoices,
  }));
  const earlier=prior.candidateNamedRollHighlight;
  docs.push({
    year:2025,meetingDate:earlier.meetingDate,committeeName:earlier.committee,
    url:earlier.originalPdfUrl,originalRawPdfSha256:earlier.originalPdfSha256,
    ocrTextSha256:earlier.ocrTextSha256,
    expectedNamedRolls:earlier.candidateNamedRollCallCount,
    expectedNamedChoices:earlier.candidateSourceNamedMemberChoices,
  });
  const unique=new Set<string>();
  for(const x of docs){
    const u=new URL(x.url);
    if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||
      ![2022,2025].includes(x.year)||x.meetingDate.slice(0,4)!==String(x.year)||
      !x.committeeName.trim()||u.search||u.hash||
      !u.pathname.startsWith('/archive/minutes/senate/'+x.year+'/')||
      !u.pathname.includes('/'+x.meetingDate.replaceAll('-','')+'/')||
      !/_minutes\.pdf$/i.test(u.pathname)||
      !/^[a-f0-9]{64}$/.test(x.originalRawPdfSha256)||
      !/^[a-f0-9]{64}$/.test(x.ocrTextSha256)||
      !Number.isInteger(x.expectedNamedRolls)||x.expectedNamedRolls<1||
      !Number.isInteger(x.expectedNamedChoices)||x.expectedNamedChoices<x.expectedNamedRolls||
      unique.has(x.url))
      throw Error('Invalid/doubled pinned named original source identity');
    unique.add(x.url);
  }
  const sum=(key:'expectedNamedRolls'|'expectedNamedChoices')=>
    docs.reduce((n,r)=>n+r[key],0);
  if(docs.length!==10||sum('expectedNamedRolls')!==15||
    sum('expectedNamedChoices')!==134||
    docs.filter(x=>x.year===2022).reduce((n,x)=>n+x.expectedNamedRolls,0)!==11||
    docs.filter(x=>x.year===2025).reduce((n,x)=>n+x.expectedNamedRolls,0)!==4)
    throw Error('Final 15 named candidate roll source universe drifted');
  return docs.sort((a,b)=>a.year-b.year||a.meetingDate.localeCompare(b.meetingDate)
    ||a.url.localeCompare(b.url));
}
export function checkNamedSenateRollIntegrity(roll:{
  yeaCount:number;nayCount:number;
  memberVotes:Array<{choice:'yea'|'nay';normalizedName:string;sourceName:string}>;
  individualVotesAvailable:boolean;
}):{sourceNamesUniqueWithinRoll:boolean;namedTallyMatchesRoll:boolean;
  namedVoteCandidatesRequireSenatorRosterMatch:true}{
  const choices=roll.memberVotes;
  const names=choices.map(x=>x.normalizedName.toLocaleLowerCase('en-US'));
  return {
    sourceNamesUniqueWithinRoll:names.length===new Set(names).size,
    namedTallyMatchesRoll:roll.individualVotesAvailable &&
      roll.yeaCount===choices.filter(x=>x.choice==='yea').length &&
      roll.nayCount===choices.filter(x=>x.choice==='nay').length &&
      choices.every(x=>x.sourceName.trim()!==''&&x.normalizedName.trim()!==''),
    namedVoteCandidatesRequireSenatorRosterMatch:true,
  };
}
