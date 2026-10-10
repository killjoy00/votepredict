/** #864: one-time source-only exact 100 no-label Senate committee roll PDF
 * re-read. Original source metadata SHA, original PDF SHA and original
 * extracted text SHA must all match. No names, full text, DB or ingestion.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { fetchSenateCommitteeMinutePdf } from '../src/evidence/minnesota-senate-committee-source.js';
import {
  NO_LABEL_ROLL_EXPECTED,selectOriginalNoLabelRollPdfCandidates,
  triageOriginalNoLabelRollText,
} from '../src/evidence/senate-committee-100-no-label-roll-review.js';
import type { RollReviewYear } from '../src/evidence/senate-committee-unparsed-roll-review.js';
const sha=(x:string|Uint8Array)=>createHash('sha256').update(x).digest('hex');
const MAX_BYTES=3_000_000,MAX_PAGES=30;
function args(){
  const a=process.argv.slice(2);
  if(a.length!==8||a[0]!=='--year'||a[2]!=='--batch'||a[4]!=='--source-json'||a[6]!=='--output')
    throw Error('Fixed --year YYYY --batch 0|1 --source-json PATH --output PATH');
  const y=Number(a[1]),b=Number(a[3]);
  if(![2022,2023,2024,2025].includes(y)||![0,1].includes(b))
    throw Error('Only two original bounded batches per historical Senate year');
  return {year:y as RollReviewYear,batch:b,source:resolve(a[5]!),out:resolve(a[7]!)};
}
function safe(e:unknown){
  return (e instanceof Error?e.message:String(e))
    .replace(/https?:\/\/\S+/gi,'[official PDF]').slice(0,170);
}
async function boundedPdf(url:string,allowed:ReadonlySet<string>,init?:RequestInit){
  if(!allowed.has(url))throw Error('Official PDF outside exact previously source-hashed population');
  const r=await fetch(url,{...init,redirect:'manual'});
  if(r.status!==200||r.url!==url)throw Error('Original PDF response status or redirect changed');
  const len=r.headers.get('content-length');
  if(len&&Number(len)>MAX_BYTES)throw Error('Original PDF declared over byte cap');
  const reader=r.body?.getReader();if(!reader)throw Error('Original PDF response lacks stream');
  const chunks:Uint8Array[]=[];let n=0;
  try{
    for(;;){const next=await reader.read();if(next.done)break;
      n+=next.value.byteLength;if(n>MAX_BYTES)throw Error('Original PDF streamed bytes exceed cap');
      chunks.push(next.value);
    }
  }finally{reader.releaseLock()}
  const buf=new Uint8Array(n);let k=0;
  for(const piece of chunks){buf.set(piece,k);k+=piece.byteLength}
  if(n<300||new TextDecoder('latin1').decode(buf.slice(0,5))!=='%PDF-')
    throw Error('Official original PDF signature invalid');
  const dir=mkdtempSync(join(tmpdir(),'senate-100-roll-'));
  try{
    const p=join(dir,'source.pdf');writeFileSync(p,buf);
    const details=execFileSync('pdfinfo',[p],{encoding:'utf8',timeout:15000,maxBuffer:100_000});
    const pages=Number(details.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
    if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
      throw Error('Original Senate PDF outside hard page cap');
  }finally{rmSync(dir,{recursive:true,force:true})}
  return new Response(buf,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
  const op=args();
  const all=selectOriginalNoLabelRollPdfCandidates(op.year,readFileSync(op.source,'utf8'));
  const docs=all.filter((_,i)=>i%2===op.batch);
  const expected=Math.floor(NO_LABEL_ROLL_EXPECTED[op.year]/2)+
    (op.batch<NO_LABEL_ROLL_EXPECTED[op.year]%2?1:0);
  if(docs.length!==expected||docs.length>30)throw Error('Unexpected original source batch partition');
  const allowed=new Set(docs.map(x=>x.originalOfficialPdfUrl));
  const rows:Record<string,unknown>[]=[];
  const failures:Array<{originalPdfUrlSha256:string;meetingDate:string;committeeName:string;reason:string}>=[];
  for(const doc of docs){
    try{
      const original=await fetchSenateCommitteeMinutePdf({
        url:doc.originalOfficialPdfUrl,
        fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
          const url=input instanceof Request?input.url:String(input);
          return boundedPdf(url,allowed,init);
        }) as typeof fetch,
      });
      if(original.extractionMethod!=='embedded_text'||
        original.contentSha256!==doc.originalPdfSha256||
        sha(original.text)!==doc.extractedTextSha256)
        throw Error('Original Senate source PDF/embedded text SHA changed from independent archive');
      const triage=triageOriginalNoLabelRollText(original.text);
      if(triage.sourceRollPhraseCount!==doc.parserRollCallPhrases)
        throw Error('Original roll-call source cue count changed');
      rows.push({
        year:op.year,meetingDate:doc.hearingDate,committeeName:doc.committeeName,
        originalOfficialPdfUrl:doc.originalOfficialPdfUrl,
        originalPdfSha256:original.contentSha256,originalTextSha256:sha(original.text),
        originalPdfBytes:original.bytes,
        previousNoYeaNayLabels:true,previousParsedRolls:0,
        ...triage,
      });
    }catch(e){
      failures.push({
        originalPdfUrlSha256:sha(doc.originalOfficialPdfUrl),
        meetingDate:doc.hearingDate,committeeName:doc.committeeName,reason:safe(e),
      });
    }
  }
  const counts:Record<string,number>={};
  for(const row of rows){
    const key=String(row.highestReviewCategory);
    counts[key]=(counts[key]??0)+1;
  }
  const report={
    schemaVersion:'senate-100-unparsed-no-label-roll-original-cue-review-v1',
    issue:864,year:op.year,batch:op.batch,totalBatches:2,
    originalActionSourceRun:38066441841,
    exactYearNoLabelOriginalCount:NO_LABEL_ROLL_EXPECTED[op.year],
    expectedBatchPdfOriginals:docs.length,originalPdfsSourceShaReverified:rows.length,
    sourceFailures:failures.length,
    categoryCounts:counts,
    sourceOriginals:rows,failedOriginals:failures,
    originalPdfsAndFullTextsNotStored:true,
    boundedTemporarySourcePreviewExpiresSevenDays:true,
    parsedNamedIndividualChoicesVerified:0,
    noAutomaticVoteOrDbEvidenceUpgrade:true,noPrivateDatabaseReadOrWrite:true,
    noModelForecastServingSchedulerOr2027Change:true,
  };
  mkdirSync(dirname(op.out),{recursive:true});
  writeFileSync(op.out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({year:op.year,batch:op.batch,
    originalPdfsVerified:rows.length,sourceFailures:failures.length,categories:counts},null,2));
  if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});