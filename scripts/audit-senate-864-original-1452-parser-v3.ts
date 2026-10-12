/**
 * #864: PUBLIC-SOURCE-ONLY full-original reparse against immutable V6 metadata.
 *
 * Re-fetch only the 1,452 previously independent SHA-authenticated LRL PDFs.
 * 2021 printed Minutes and 141 no-PDF meetings remain outside this PDF universe.
 * No Neon; no source/body/name/choice hash/individual event key may be exported.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {sourceShaPinnedMerged} from './audit-senate-864-2025-judiciary-full-source-neon-v5.js';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes,
 MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
import {EDUCATION_2024_REPEATED_ROLL_SOURCE} from
 '../src/evidence/senate-2024-education-repeated-amendment-rolls.js';

const PIN=EDUCATION_2024_REPEATED_ROLL_SOURCE;
const EXPECTED:{[key:number]:number}={2022:325,2023:454,2024:258,2025:415};
const TOTAL_SHARDS=4,MAX_PDF_BYTES=12_000_000,MAX_PAGES=100;
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
type OldProof={document:{sourceUrl:string;committeeName:string;meetingDate:string;
 originalRawPdfSha256:string;extractedTextSha256?:string;originalPdfBytes?:number};
 voteObservations:Array<{individualVotesAvailable:boolean;namedMemberChoicesInPdf:number}>};
export function safeReparseCountComparison(old:OldProof,newNamed:number,newCountOnly:number){
 const beforeNamed=old.voteObservations.filter(x=>x.individualVotesAvailable).length;
 const beforeCountOnly=old.voteObservations.length-beforeNamed;
 if(!Number.isSafeInteger(newNamed)||newNamed<0||newNamed>100||
  !Number.isSafeInteger(newCountOnly)||newCountOnly<0||newCountOnly>100)
  throw Error('Unsafe source parser action count');
 return {beforeNamed,afterNamed:newNamed,beforeCountOnly,afterCountOnly:newCountOnly,
  addedNamed:newNamed-beforeNamed,addedCountOnly:newCountOnly-beforeCountOnly,
  namedDecreased:newNamed<beforeNamed,countsDecreased:newCountOnly<beforeCountOnly};
}
export function selectPinnedYearShard(
 years:ReturnType<typeof sourceShaPinnedMerged>['years'],year:number,shard:number
){
 if(!Object.hasOwn(EXPECTED,year)||!Number.isInteger(shard)||shard<0||shard>=TOTAL_SHARDS)
  throw Error('Exact historical year and bounded shard required');
 if(years.length!==4||years.some((x,i)=>x.auditedYear!==i+2022||
  x.documentProofs.length!==EXPECTED[x.auditedYear]))
  throw Error('Original four-year 1452 PDF SHA-pinned cohort drift');
 const all=years.find(x=>x.auditedYear===year)!.documentProofs;
 const docs=[...all].sort((a,b)=>a.document.sourceUrl.localeCompare(b.document.sourceUrl));
 if(new Set(docs.map(x=>x.document.sourceUrl)).size!==EXPECTED[year])
  throw Error('Original source URL duplicate or mismatch');
 const chosen=docs.filter((_,i)=>i%TOTAL_SHARDS===shard);
 const expected=Math.floor((EXPECTED[year]+3-shard)/TOTAL_SHARDS);
 if(chosen.length!==expected)throw Error('Original shard denominator failed');
 return chosen;
}
function options(){
 const argv=process.argv.slice(2);
 if(argv.length!==6||argv[0]!=='--year'||argv[2]!=='--shard'||argv[4]!=='--output')
  throw Error('Only --year YEAR --shard 0..3 --output FILE');
 const year=Number(argv[1]),shard=Number(argv[3]);
 if(![2022,2023,2024,2025].includes(year)||!['0','1','2','3'].includes(argv[3]??'')
   ||!argv[5]||argv[5]!.startsWith('--'))throw Error('Year/shard/out fixed bounds');
 if(process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR!=='1')
  throw Error('Explicit original-scans OCR opt-in required');
 return {year,shard,output:resolve(argv[5]!)};
}
async function refetchExactPdf(url:string,expectedSha:string,init?:RequestInit){
 const u=new URL(url);
 if(u.protocol!=='https:'||!['www.lrl.mn.gov','lrl.mn.gov'].includes(u.hostname)||
  !/^\\/archive\\/minutes\\/senate\\/202[2-5]\\//.test(u.pathname)||
  !/_Minutes\\.pdf$/i.test(u.pathname)||u.search||u.hash)
  throw Error('Official PDF URL scope invalid');
 const response=await fetch(url,{...init,redirect:'manual'});
 if(response.status!==200||response.url!==url)throw Error('Original PDF transport HOLD');
 const length=response.headers.get('content-length');
 if(length!==null&&(!/^\\d+$/.test(length)||Number(length)>MAX_PDF_BYTES))
  throw Error('Original source exceeds PDF cap');
 const reader=response.body?.getReader();
 if(!reader)throw Error('Original PDF stream unavailable');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const part=await reader.read();
   if(part.done)break;
   size+=part.value.byteLength;
   if(size>MAX_PDF_BYTES)throw Error('Original PDF streaming cap exceeded');
   chunks.push(part.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let i=0;
 for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.byteLength}
 if(size<300||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-'||
  sha(bytes)!==expectedSha)throw Error('Original PDF SHA mismatch');
 const folder=mkdtempSync(join(tmpdir(),'senate-864-corpus-'));
 try{
  const file=join(folder,'original.pdf');writeFileSync(file,bytes);
  const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:20_000,maxBuffer:100_000});
  const pages=Number(info.match(/^Pages:\\s*(\\d+)\\s*$/mi)?.[1]??NaN);
  if(!Number.isInteger(pages)||pages<1||pages>MAX_PAGES)
   throw Error('Original PDF page cap failed');
 }finally{rmSync(folder,{recursive:true,force:true})}
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const {year,shard,output}=options();
 const source=sourceShaPinnedMerged();
 const docs=selectPinnedYearShard(source.years,year,shard);
 let verified=0,held=0,ocr=0,embedded=0,oldNamed=0,newNamed=0,
  oldCountOnly=0,newCountOnly=0,namedDecreased=0,countsDecreased=0,
  sourceTextDrift=0,pdfShaHolds=0,otherHolds=0,educationOld=0,educationNew=0;
 // Max two official PDF fetch/extraction tasks concurrently per shard.
 let cursor=0;
 await Promise.all(Array.from({length:2},async()=>{
  for(;;){
   const doc=docs[cursor++];
   if(!doc)break;
   const old=doc as OldProof;
   try{
    const pdf=await fetchSenateCommitteeMinutePdf({
     url:doc.document.sourceUrl,
     fetchImpl:((_:string|URL|Request,init?:RequestInit)=>
      refetchExactPdf(doc.document.sourceUrl,doc.document.originalRawPdfSha256,init)) as typeof fetch,
    });
    if(pdf.contentSha256!==doc.document.originalRawPdfSha256)
     throw Error('Pinned original PDF SHA verification drift');
    // The original 1245 embedded text bytes must be identical for a meaningful
    // old-v-new parser comparison. OCR text may vary with the OCR binary; its
    // change is visible in the provenance scorecard, not called a parser gain.
    const originalTextSha=old.document.extractedTextSha256;
    if(originalTextSha&&sha(pdf.text)!==originalTextSha){
     sourceTextDrift++;throw Error('Original embedded text digest drift');
    }
    const newer=parseSenateCommitteeMinuteVotes(pdf.text);
    const newerNamed=newer.filter(x=>x.individualVotesAvailable).length;
    const newerCountOnly=newer.length-newerNamed;
    const counts=safeReparseCountComparison(old,newerNamed,newerCountOnly);
    if(doc.document.sourceUrl===PIN.sourceUrl){
     if(year!==2024||old.voteObservations.length!==2||newer.length!==6||
      newerNamed!==6||newer.some(x=>x.yeaCount!==4||x.nayCount!==6||
       x.memberVotes.length!==10))
      throw Error('Verified Education original six-action pin failed');
     educationOld=2;educationNew=6;
    }
    oldNamed+=counts.beforeNamed;newNamed+=counts.afterNamed;
    oldCountOnly+=counts.beforeCountOnly;newCountOnly+=counts.afterCountOnly;
    if(counts.namedDecreased)namedDecreased++;
    if(counts.countsDecreased)countsDecreased++;
    verified++;
    if(pdf.extractionMethod==='ocr_tesseract')ocr++;else embedded++;
   }catch(err){
    held++;
    const kind=err instanceof Error?err.message:'Unknown source failure';
    if(/PDF SHA|transport|stream|PDF cap|exceeds PDF cap/i.test(kind))pdfShaHolds++;
    else otherHolds++;
   }
  }
 }));
 const result={
  schemaVersion:'senate-864-all-1452-originals-parser-v3-recheck-shard-v1',
  issue:864,year,shard,shards:TOTAL_SHARDS,
  baselineSourceRun:38066441841,baselineParser:'mn-senate-committee-minutes-v2',
  currentParser:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
  originalUrlsAssigned:docs.length,
  originalPdfAndSourceTextVerified:verified,
  originalsHeld:held,originalOcrRecovered:ocr,originalEmbeddedText:embedded,
  sourceTextDriftHolds:sourceTextDrift,originalPdfByteOrTransportHolds:pdfShaHolds,
  otherFailClosedHolds:otherHolds,
  originallyRecognizedNamedRolls:oldNamed,newParserNamedRolls:newNamed,
  originallyRecognizedCountOnlyRolls:oldCountOnly,newParserCountOnlyRolls:newCountOnly,
  docsWithNamedRollDecrease:namedDecreased,docsWithCountOnlyDecrease:countsDecreased,
  verifiedEducationOriginalOldCandidates:educationOld,
  verifiedEducationOriginalNewActions:educationNew,
  noPersonNamesUrlsChoiceHashesEventsOrSourceTextExported:true,
  noDatabaseReadOrWrite:true,
  completeOfficialMeetingOrVoteDenominatorCertified:false,
  original2021PrintAnd2022PrintHeld:true,
  noLinkedMinutesMeetingCountStillUnresolved:141,
  status:held===0&&namedDecreased===0&&countsDecreased===0?
   'VERIFIED_ORIGINAL_PDFS_NOT_OFFICIAL_DENOMINATOR':'SOURCE_OR_PARSER_HOLD',
 };
 const serial=JSON.stringify(result,null,2)+'\n';
 if(serial.length>5000||/https?:|source_url|sourceName|normalizedName|choiceIdentitySha256/i.test(serial))
  throw Error('Unsafe public corpus reparse receipt');
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,serial);
 console.log('SENATE_864_CORPUS_SAFE='+JSON.stringify(result));
 if(held||namedDecreased||countsDecreased)process.exitCode=1;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-original-1452-parser-v3.ts'))
 void main().catch(()=>{console.error('SENATE_864_CORPUS_HOLD=preflight');process.exitCode=1});
