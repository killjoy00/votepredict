/**
 * One-time #864: exact original PDFs behind the nine highest-risk no-label
 * unparsed numeric committee roll-cue cases. No DB, serving or forecast.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {
  extractNineSourceIndividualRolls,selectNinePinnedSourceRollOriginals,
  type NineReviewYear,
} from '../src/evidence/senate-committee-nine-no-label-counted-rolls.js';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const MAX_BYTES=3_000_000,MAX_PAGES=30;
function args(){
 const a=process.argv.slice(2);
 if(a.length!==6||a[0]!=='--year'||a[2]!=='--source-json'||a[4]!=='--output')
  throw Error('Exact --year 2023|2024 --source-json PATH --output PATH');
 const y=Number(a[1]);
 if(y!==2023&&y!==2024)throw Error('Only two exact numbered committee roll-review years');
 return {year:y as NineReviewYear,source:resolve(a[3]!),out:resolve(a[5]!)};
}
function safe(e:unknown){
 return (e instanceof Error?e.message:String(e))
  .replace(/https?:\/\/\S+/gi,'[official PDF]').slice(0,160);
}
async function fixedOfficialPdf(url:string,allowed:ReadonlySet<string>,init?:RequestInit){
 if(!allowed.has(url))throw Error('Original PDF outside exact nine source identities');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url)throw Error('Official source PDF redirect or HTTP status drift');
 const len=r.headers.get('content-length');
 if(len&&Number(len)>MAX_BYTES)throw Error('Original PDF exceeds declared byte cap');
 const reader=r.body?.getReader();if(!reader)throw Error('Original PDF body missing');
 let count=0;const arr:Uint8Array[]=[];
 try{
  for(;;){const p=await reader.read();if(p.done)break;
   count+=p.value.byteLength;
   if(count>MAX_BYTES)throw Error('Original PDF streamed bytes cap exceeded');
   arr.push(p.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(count);let i=0;
 for(const b of arr){bytes.set(b,i);i+=b.byteLength}
 if(count<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Original Senate minutes source is not PDF');
 const dir=mkdtempSync(join(tmpdir(),'senate-nine-'));
 try{
  const file=join(dir,'source.pdf');writeFileSync(file,bytes);
  const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:15000});
  const pages=Number(info.match(/^Pages:\s*(\d+)\s*$/mi)?.[1]??NaN);
  if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
   throw Error('Original source PDF exceeds hard page cap');
 }finally{rmSync(dir,{recursive:true,force:true})}
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const op=args();
 const selected=selectNinePinnedSourceRollOriginals(op.year,readFileSync(op.source,'utf8'));
 const allowed=new Set(selected.map(r=>r.originalOfficialPdfUrl));
 const rows:Record<string,unknown>[]=[];
 const errors:Array<{urlHash:string;meetingDate:string;reason:string}>=[];
 for(const row of selected){
  try{
   const original=await fetchSenateCommitteeMinutePdf({
    url:row.originalOfficialPdfUrl,
    fetchImpl:((input:string|URL|Request,init?:RequestInit)=>{
     const url=input instanceof Request?input.url:String(input);
     return fixedOfficialPdf(url,allowed,init);
    }) as typeof fetch,
   });
   if(original.extractionMethod!=='embedded_text'||
     original.contentSha256!==row.originalPdfSha256||
     sha(original.text)!==row.extractedTextSha256)
    throw Error('Exact independently SHA verified original PDF or text changed');
   const choices=extractNineSourceIndividualRolls(original.text,op.year,row.committeeName);
   const matched=choices.filter(x=>x.namedYeaNayTallyMatchesSource);
   rows.push({
    year:op.year,hearingDate:row.hearingDate,committeeName:row.committeeName,
    originalOfficialPdfUrl:row.originalOfficialPdfUrl,
    originalPdfSha256:original.contentSha256,
    originalEmbeddedTextSha256:sha(original.text),
    originalPdfBytes:original.bytes,
    previousStrictParserNamedRolls:0,
    sourceRollCallCueCount:row.parserRollCallPhrases,
    explicitlyNamedDirectionalBlocks:choices.length,
    numericalNamedSourceTallyMatchedBlocks:matched.length,
    explicitYeaNayTokensInMatchedBlocks:matched.reduce((n,x)=>n+x.explicitlyNamedYeas+x.explicitlyNamedNays,0),
    namedNonVotingAbsentOrPassTokensInMatchedBlocks:matched.reduce((n,x)=>n+x.explicitlyListedAbsent+x.explicitlyListedPass,0),
    candidateBlocks:choices,
    committeeSpecificActionNotFloorOrBillPosition:true,
   });
  }catch(e){errors.push({
   meetingDate:row.hearingDate,urlHash:sha(row.originalOfficialPdfUrl),reason:safe(e),
  })}
 }
 const sum=(key:string)=>rows.reduce((n,r)=>n+Number(r[key]??0),0);
 const stats={
  originalPdfsExpected:selected.length,originalPdfsReverified:rows.length,
  sourceFailures:errors.length,
  newExplicitNamedDirectionBlocks:sum('explicitlyNamedDirectionalBlocks'),
  blocksWithExactOriginalNumericSourceTally:sum('numericalNamedSourceTallyMatchedBlocks'),
  sourceNamedYeaNayTokensMatched:sum('explicitYeaNayTokensInMatchedBlocks'),
  separatelyExcludedAbsentAndPassTokens:sum('namedNonVotingAbsentOrPassTokensInMatchedBlocks'),
 };
 const report={
  schemaVersion:'senate-nine-unparsed-counted-original-roll-directional-source-audit-v1',
  issue:864,year:op.year,priorOriginalYearRun:38066441841,
  original100CohortSourceRun:38081471731,
  bounds:{originalPdfMaxBytes:MAX_BYTES,originalPdfMaxPages:MAX_PAGES,noRedirects:true},
  stats,originalProofs:rows,failedSources:errors,
  individualSourceNamesOrSourceTextNotPersisted:true,
  noActualRecordedMotionDistinctnessOrSenatorMembershipCertified:true,
  noProductionDatabaseQueryOrMutation:true,
  noModelServingTrainingSchedulerOr2027Change:true,
 };
 mkdirSync(dirname(op.out),{recursive:true});
 writeFileSync(op.out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({year:op.year,stats},null,2));
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});