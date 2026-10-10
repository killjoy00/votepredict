/**
 * One-time #864 independent source-text review of precisely 41 already-hashed
 * 2022–25 electronic Senate Minutes originals flagged with roll-call + YEA/NAY
 * text labels but NO previously supported parsed recorded vote.
 *
 * Emits bounded contextual snippets as temporary 30-day QA artifacts ONLY;
 * NO original PDF/complete source text/member list/private DB is persisted.
 */
import { createHash } from 'node:crypto';
import { extractSupplementalNamedSenateRollCandidates } from '../src/evidence/senate-committee-supplemental-named-roll-review.js';
import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import {
  fetchSenateCommitteeMinutePdf,
} from '../src/evidence/minnesota-senate-committee-source.js';
import {
  parseSenateCommitteeMinuteVotes,
} from '../src/evidence/minnesota-senate-committee-minutes.js';
import {
  HIGH_SIGNAL_PDF_EXPECTED,loadStrongRollSourceManifest,
  triageOriginalRollCueText,type ReviewYear,
} from '../src/evidence/senate-committee-41-strong-roll-original-review.js';

const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const MAX_BYTES=3_000_000,MAX_PAGES=30;
function args(){
  const a=process.argv.slice(2);
  if(a.length!==6 || a[0]!=='--year'||a[2]!=='--source-json'||a[4]!=='--output')
    throw Error('Fixed args: --year 2022|2023|2024|2025 --source-json PATH --output PATH');
  const year=Number(a[1]);
  if(![2022,2023,2024,2025].includes(year))
    throw Error('Out of scope original Senate year');
  return {year:year as ReviewYear,source:resolve(a[3]!),out:resolve(a[5]!)};
}
function compactError(e:unknown){
  return (e instanceof Error ? e.message:String(e)).replace(/https?:\/\/\S+/gi,'[official PDF]')
    .slice(0,170);
}
async function cappedOfficialPdf(original:string,init?:RequestInit):Promise<Response>{
  const res=await fetch(original,{...init,redirect:'manual'});
  if(res.status!==200||res.url!==original)
    throw Error('Original Senate minutes redirected or did not return exact HTTP 200');
  const contentLen=res.headers.get('content-length');
  if(contentLen && Number(contentLen)>MAX_BYTES)throw Error('Source PDF exceeds byte cap');
  const reader=res.body?.getReader();
  if(!reader)throw Error('Official PDF has no stream');
  let n=0;
  const chunks:Uint8Array[]=[];
  try{
    for(;;){
      const p=await reader.read();
      if(p.done)break;
      n+=p.value.length;
      if(n>MAX_BYTES)throw Error('Source PDF streamed size exceeds cap');
      chunks.push(p.value);
    }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(n);
  let off=0;
  for(const chunk of chunks){bytes.set(chunk,off);off+=chunk.length}
  if(n<300 || new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
    throw Error('Official source bytes lack PDF signature');
  const dir=mkdtempSync(join(tmpdir(),'senate-41-cue-'));
  try{
    const name=join(dir,'source.pdf');
    writeFileSync(name,bytes);
    const info=execFileSync('pdfinfo',[name],{encoding:'utf8',timeout:15_000});
    const count=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
    if(!Number.isInteger(count)||count<1||count>MAX_PAGES)
      throw Error('Original PDF outside fixed page cap');
  }finally{rmSync(dir,{recursive:true,force:true})}
  return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
  const opt=args();
  const sourceRaw=readFileSync(opt.source,'utf8');
  const rows=loadStrongRollSourceManifest(opt.year,sourceRaw);
  const allowed=new Set(rows.map(x=>x.originalOfficialPdfUrl));
  const reviewed:Record<string,unknown>[]=[];
  const failures:Array<{urlSha256:string;hearingDate:string;committeeName:string;category:string}>=[];
  for(const doc of rows){
    try {
      const src=await fetchSenateCommitteeMinutePdf({
        url:doc.originalOfficialPdfUrl,
        fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
          const url=input instanceof Request ? input.url:String(input);
          if(!allowed.has(url))throw Error('Unpinned PDF rejected');
          return cappedOfficialPdf(url,init);
        }) as typeof fetch,
      });
      if(src.contentSha256!==doc.originalPdfSha256||
        sha(src.text)!==doc.extractedTextSha256 ||
        src.extractionMethod!=='embedded_text')
        throw Error('Original official source PDF or normalized text changed since first audit');
      const parserVotes=parseSenateCommitteeMinuteVotes(src.text);
      if(parserVotes.length!==0)
        throw Error('Parser behavior changed: candidate can no longer be called originally unparsed');
      const triage=triageOriginalRollCueText(src.text);
      if(triage.ayeNayTextLabelCount!==doc.parserAyeNayLabels ||
        triage.rollCallPhraseCount!==doc.parserRollCallPhrases)
        throw Error('Source phrase counts changed compared with independently pinned metadata');
      const supplementary=extractSupplementalNamedSenateRollCandidates(src.text);
      reviewed.push({
        supplementalCandidateCount:supplementary.length,
        supplementalCandidatesWithMatchingSourceTally:supplementary.filter(x=>x.numericTallyMatchesExplicitNamedList===true).length,
        supplementalCandidatesWithMismatchedSourceTally:supplementary.filter(x=>x.numericTallyMatchesExplicitNamedList===false).length,
        supplementalCandidatesWithoutExplicitTally:supplementary.filter(x=>x.numericTallyMatchesExplicitNamedList===null).length,
        supplementalExplicitNamedChoiceTokens:supplementary.reduce((n,x)=>n+x.namedYeaCount+x.namedNayCount,0),
        supplementalCandidateEvidence:supplementary,
        year:doc.year,hearingDate:doc.hearingDate,committeeName:doc.committeeName,
        originalOfficialPdfUrl:doc.originalOfficialPdfUrl,
        originalRawPdfSha256:src.contentSha256,embeddedTextSha256:sha(src.text),
        sourceBytes:src.bytes,originalParserSupportedRolls:0,
        ...triage,
        extractionMethod:src.extractionMethod,
      });
    }catch(e){
      failures.push({urlSha256:sha(doc.originalOfficialPdfUrl),hearingDate:doc.hearingDate,
        committeeName:doc.committeeName,category:compactError(e)});
    }
  }
  const sum=(key:string)=>reviewed.reduce((n,r)=>n+Number(r[key]??0),0);
  const report={
    schemaVersion:'senate-41-supplemental-named-source-salvage-v1',issue:864,
    originalSourceRun:38066441841,originalQueueRun:38075573031,
    year:opt.year,expectedOriginalPdfCount:HIGH_SIGNAL_PDF_EXPECTED[opt.year],
    originalPdfTextReverified:reviewed.length,unresolvedPdfCount:failures.length,
    maxOriginalPdfBytes:MAX_BYTES,maxPdfPages:MAX_PAGES,
    signalSummary:{
      rollCallPhrases:sum('rollCallPhraseCount'),
      ayeNayLabels:sum('ayeNayTextLabelCount'),
      cuesWithAttendanceWords:sum('cuesWithAttendanceWords'),
      cuesWithMotionWords:sum('cuesWithMotionWords'),
      cuesWithBothMotionAndAyeNayLabel:sum('cuesWithBothMotionAndAyeNayLabel'),
      labelsNearRollPhrase:sum('labelsNearRollPhrase'),
    },
    supplementalSummary:{
      candidateMotionOrVoteBlocks:sum('supplementalCandidateCount'),
      blocksWithExactNamedAndSourceTallyMatch:sum('supplementalCandidatesWithMatchingSourceTally'),
      blocksWithSourceTallyMismatch:sum('supplementalCandidatesWithMismatchedSourceTally'),
      blocksWithoutSourceNumericTally:sum('supplementalCandidatesWithoutExplicitTally'),
      explicitNamedYeaNayChoiceTokensAcrossCandidates:sum('supplementalExplicitNamedChoiceTokens'),
    },
    allCandidatesAreProvisionalPendingHumanSourceMotionVerification:true,
    candidates:reviewed,failed:failures,
    boundedSourceSnippetsAreTemporaryReviewOnly:true,
    originalPdfAndFullTextNotPersisted:true,
    noParserVotesAutoAdded:true,noPrivateDatabaseOrModelWrites:true,
    labelsAndRollPhrasesAreNotVerifiedNamedVotes:true,
    unrelatedTo141MeetingEntriesWithoutMinutes:true,
  };
  mkdirSync(dirname(opt.out),{recursive:true});
  writeFileSync(opt.out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({year:opt.year,expected:rows.length,reverified:reviewed.length,
    failures:failures.length,signals:report.signalSummary,
    supplemental:report.supplementalSummary,dbTouched:false},null,2));
  if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(compactError(e));process.exitCode=1});
