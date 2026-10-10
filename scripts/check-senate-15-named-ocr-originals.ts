/** One-time #864 original PDF/OCR integrity review of 15 candidate named rolls. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import { parseSenateCommitteeMinuteVotes } from '../src/evidence/minnesota-senate-committee-minutes.js';
import {
  checkNamedSenateRollIntegrity,getAllPreviouslyPinnedNamedOcrCandidateOriginals,
} from '../src/evidence/senate-committee-15-named-ocr-review.js';

const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const MAX_BYTES=8_000_000,MAX_PAGES=8;
const a=process.argv.slice(2);
if(a.length!==4||a[0]!=='--year'||a[2]!=='--output')
  throw Error('Fixed args: --year 2022|2025 --output PATH');
const year=Number(a[1]);
if(year!==2022&&year!==2025)throw Error('Only original 2022/2025 Senate named OCR sources');
if(process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR!=='1')
  throw Error('Explicit source OCR opt-in is required');
const output=resolve(a[3]!);
const docs=getAllPreviouslyPinnedNamedOcrCandidateOriginals().filter(d=>d.year===year);
if(docs.length!==(year===2022?8:2))throw Error('Unexpected exact source document count');
const allowed=new Set(docs.map(d=>d.url));
function safe(e:unknown){
  return (e instanceof Error?e.message:String(e))
    .replace(/https?:\/\/\S+/gi,'[official Senate PDF]').slice(0,180);
}
async function cappedPdf(url:string,init?:RequestInit){
  if(!allowed.has(url))throw Error('Source PDF not in pinned original manifest');
  const res=await fetch(url,{...init,redirect:'manual'});
  if(res.status!==200||res.url!==url)throw Error('Official PDF redirect or wrong HTTP status');
  const len=res.headers.get('content-length');
  if(len&&Number(len)>MAX_BYTES)throw Error('Original scanned PDF exceeds byte cap');
  const reader=res.body?.getReader();
  if(!reader)throw Error('Original PDF no streaming body');
  const chunks:Uint8Array[]=[];
  let bytes=0;
  try{
    for(;;){
      const part=await reader.read();
      if(part.done)break;
      bytes+=part.value.length;
      if(bytes>MAX_BYTES)throw Error('Original PDF streamed bytes cap exceeded');
      chunks.push(part.value);
    }
  }finally{reader.releaseLock()}
  const data=new Uint8Array(bytes);
  let cursor=0;
  for(const c of chunks){data.set(c,cursor);cursor+=c.length}
  if(bytes<300||new TextDecoder('latin1').decode(data.slice(0,5))!=='%PDF-')
    throw Error('Original PDF lacks signature');
  const tmp=mkdtempSync(join(tmpdir(),'senate-15-named-ocr-'));
  try{
    const path=join(tmp,'original.pdf');
    writeFileSync(path,data);
    const info=execFileSync('pdfinfo',[path],{encoding:'utf8',timeout:15000});
    const pages=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
    if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
      throw Error('Original PDF outside eight-page OCR cap');
  }finally{rmSync(tmp,{recursive:true,force:true})}
  return new Response(data,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
  const results:Record<string,unknown>[]=[];
  const errors:Array<{meetingDate:string;committeeName:string;pdfUrlSha256:string;reason:string}>=[];
  for(const doc of docs){
    try{
      const src=await fetchSenateCommitteeMinutePdf({
        url:doc.url,
        fetchImpl:((input:string|URL|Request,init?:RequestInit)=>
          cappedPdf(input instanceof Request?input.url:String(input),init)) as typeof fetch,
      });
      if(src.contentSha256!==doc.originalRawPdfSha256 ||
        sha(src.text)!==doc.ocrTextSha256||
        src.extractionMethod!=='ocr_tesseract')
        throw Error('Pinned original bytes or OCR text drifted');
      const parsed=parseSenateCommitteeMinuteVotes(src.text);
      const named=parsed.filter(v=>v.individualVotesAvailable);
      const memberCount=named.reduce((n,v)=>n+v.memberVotes.length,0);
      if(named.length!==doc.expectedNamedRolls || memberCount!==doc.expectedNamedChoices)
        throw Error('Original source OCR parser named tally drifted');
      const rolls=named.map((v,index)=>{
        const chk=checkNamedSenateRollIntegrity(v);
        return {index,yeaCount:v.yeaCount,nayCount:v.nayCount,
          billIdentifier:v.billIdentifier??null,
          amendmentRef:v.amendmentRef??null,voteKind:v.voteKind,
          explicitPassageOutcome:v.passed??null,
          motionTextSha256:sha(v.motionText),
          choiceIdentitySha256:v.memberVotes.map(m=>sha(m.choice+':'+m.normalizedName)).sort(),
          ...chk,
          sourceMotionDistinctFromOtherMotionsHumanVerified:false,
          individualSenatorMembershipMatchedToOfficialRoster:false,
          SenateFinalFloorPassageStanceInferred:false,
        };
      });
      results.push({year,meetingDate:doc.meetingDate,committeeName:doc.committeeName,
        originalPdfUrl:doc.url,originalPdfSha256:src.contentSha256,
        ocrTextSha256:sha(src.text),verifiedOriginalNamedParserRollCount:named.length,
        verifiedOriginalNamedParserChoiceCount:memberCount,
        integrityCheckFailures:rolls.filter(r=>!r.sourceNamesUniqueWithinRoll||
          !r.namedTallyMatchesRoll).length,
        sourceIntegrityCheckOnlyNotHumanMotionAudit:true,
        rolls,
      });
    }catch(e){
      errors.push({meetingDate:doc.meetingDate,committeeName:doc.committeeName,
        pdfUrlSha256:sha(doc.url),reason:safe(e)});
    }
  }
  const total=(k:string)=>results.reduce((n,r)=>n+Number(r[k]??0),0);
  const outputPayload={schemaVersion:'senate-15-ocr-named-committee-roll-source-integrity-v1',
    issue:864,year,sourceAuthority:'Minnesota Legislative Reference Library',
    sourcePdfsExpected:docs.length,sourcePdfsVerified:results.length,
    originalSourcePdfFailures:errors.length,
    namedParserRollsReverified:total('verifiedOriginalNamedParserRollCount'),
    originalNamedChoiceTokensReverified:total('verifiedOriginalNamedParserChoiceCount'),
    namedRollIntegrityViolations:total('integrityCheckFailures'),
    sources:results,failures:errors,
    memberNamesAndSourceTextNotStored:true,
    semanticDistinctMotionAndOfficialRosterMatchNotCertified:true,
    noPrivateDatabaseOrServingOrForecastChanges:true,
    archive2021PrintAnd2022PrintElectronicGapsStillOpen:true,
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(outputPayload,null,2)+'\n');
  console.log(JSON.stringify({year,expected:docs.length,verified:results.length,
    namedRolls:outputPayload.namedParserRollsReverified,
    namedChoices:outputPayload.originalNamedChoiceTokensReverified,
    integrityViolations:outputPayload.namedRollIntegrityViolations,
    failures:errors.length},null,2));
  if(errors.length||outputPayload.namedRollIntegrityViolations)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
