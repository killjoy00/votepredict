/**
 * #864 public-original orphan Senate Minutes PDF (2022-03-24 Housing).
 * The LRL committee/year linked PDF index has no minutes link for this
 * independently known meeting; distinct original LRL archive URL was found.
 * Exactly one bounded GET, official source checks, no 2021, no DB.
 */
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {digest,ORIGINAL_HOUSING_PDF,inspectMarch24HousingOfficialOriginalPdfText} from
 '../src/evidence/senate-864-2022-housing-orphan-minutes-original-pdf.js';

const FROZEN='docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json';
const PROOF='docs/evaluation/source-proof/senate-864-2022-24-25-other-24-original-clerk-two-run-source-receipts.json';
async function getOriginalPdf(){
 const url=ORIGINAL_HOUSING_PDF,u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!=='www.lrl.mn.gov'||
  u.pathname!=='/archive/minutes/senate/2022/Finhousing/20220324/FinHousing_20220324_Minutes032422.pdf'||
  u.search||u.hash)
  throw Error('Nonofficial or changed original 2022 LRL Housing URL');
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(60000),
  headers:{accept:'application/pdf',
   'user-agent':'VotePredict/2.0 original-lrl-2022-housing-unlinked-minutes-proof'}});
 if(r.status!==200||r.url!==url||!/application\/pdf/i.test(r.headers.get('content-type')??''))
  throw Error('Official LRL original 2022 Housing PDF HTTP/MIME or redirect HOLD');
 const declared=Number(r.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>6_000_000)
  throw Error('Original government PDF size bound');
 const reader=r.body?.getReader();if(!reader)throw Error('Missing official original PDF stream');
 const parts:Uint8Array[]=[];let len=0;
 try{for(;;){const x=await reader.read();if(x.done)break;
  len+=x.value.byteLength;if(len>6_000_000)throw Error('Original LRL streamed byte cap');
  parts.push(x.value);
 }}finally{reader.releaseLock()}
 const pdf=new Uint8Array(len);let i=0;
 for(const x of parts){pdf.set(x,i);i+=x.byteLength}
 if(len<3500||new TextDecoder('ascii').decode(pdf.subarray(0,5))!=='%PDF-')
  throw Error('Not an authentic original bounded government PDF');
 return {pdf,sha256:digest(pdf),bytes:len,retrievedAt:new Date().toISOString()};
}
function extractText(original:Uint8Array){
 const temp=mkdtempSync(join(tmpdir(),'senate864-orphan-2022-'));
 try{
  const filename=join(temp,'government_original.pdf');writeFileSync(filename,original);
  const metadata=execFileSync('pdfinfo',[filename],{encoding:'utf8',timeout:25000});
  const pages=Number(metadata.match(/^Pages:\s*(\d+)/m)?.[1]);
  if(!Number.isSafeInteger(pages)||pages<1||pages>8)
   throw Error('Unexpected original Housing PDF printed pages');
  const text=execFileSync('pdftotext',['-layout',filename,'-'],{
   encoding:'utf8',timeout:30000,maxBuffer:1_000_000});
  const firstPage=execFileSync('pdftotext',['-layout','-f','1','-l','1',filename,'-'],{
   encoding:'utf8',timeout:30000,maxBuffer:1_000_000});
  return {text,firstPage,pages};
 }finally{rmSync(temp,{recursive:true,force:true})}
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Original LRL 2022 Housing source requires only --output');
 const source=JSON.parse(readFileSync(FROZEN,'utf8'));
 const reviewed=JSON.parse(readFileSync(PROOF,'utf8'));
 if(source.originalIndexedCensus?.originalJsonSha256!==
   'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0'||
  !source.meetingGroups.some((x:any)=>x.year===2022&&
    x.committeeName==='Housing Finance and Policy'&&
    x.missingMinutesMeetingDates.includes('03-24'))||
  reviewed.schemaVersion!=='senate-864-two-run-independent-original-source-union-other-24-v1'||
  !reviewed.perOriginalIndexedMeeting.some((x:any)=>x.year===2022&&
    x.hearingDate==='2022-03-24'&&x.committeeName==='Housing Finance and Policy'&&
    x.authenticatedClerkOriginalBoolean===false))
  throw Error('No source-independent government original 2022-03-24 Housing meeting and missing PDF identity');
 const original=await getOriginalPdf(),extract=extractText(original.pdf);
 const result=inspectMarch24HousingOfficialOriginalPdfText(
  extract.text,original.sha256,original.bytes,extract.pages,extract.firstPage,original.retrievedAt);
 const out=resolve(args[1]);mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('SENATE864_ORIGINAL_2022_HOUSING_UNLINKED_PDF='+JSON.stringify({
  originalLRLDate:'2022-03-24',officialCommittee:'Housing Finance and Policy',
  originalPdfSha256:original.sha256,originalPdfBytes:original.bytes,
  originalPdfPages:extract.pages,originalPdfTextSha256:result.originalPdfTextSha256,
  independentlySourceAnchoredMotionProposals:result.motionObservations.length,
  originalNamedYeaNayVotes:0,originalOutcomesUnprinted:true,
  originalPdfFirstPublicByDateKnown:false,no2021OrDatabaseOperations:true
 }));
}
main().catch(()=>{
 console.error('SENATE864_ORIGINAL_2022_HOUSING_UNLINKED_PDF_SOURCE_HOLD');
 process.exitCode=1;
});
