/** Independent keyless reauthentication of seven already acquired bodies. */
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.ts';
import {registry830} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {fetchVerifiedReportPdf} from '../src/evidence/cfb-report-schedule-raw.mjs';
import {exactPins} from './probe-senate-media-miller-enterprise-original-qa-turns.mjs';
import {visibleLiteralText} from '../src/evidence/senate-864-website-expansion.mjs';
import {sha1Base32} from './verify-senate-864-72-original-artifact-bytes.mjs';
import {sha,fixture,validateOriginalQuestions,parseMillerPrintedRows,MEDIA_FRAGMENTS} from '../src/evidence/senate-864-three-bounded-evidence.mjs';
export async function verifyThreeBoundedOriginals(){
 const documents=[];
 for(const d of fixture().documents){
  const pdf=await fetchSenateCommitteeMinutePdf({url:d.sourceUrl});
  if(pdf.contentSha256!==d.originalRawPdfSha256||pdf.bytes!==d.originalPdfBytes)throw Error('Original Minutes body changed');
  validateOriginalQuestions(d,pdf.text);documents.push({...d,sourceText:pdf.text});
 }
 const pins=exactPins();let verifiedVersions=0;
 for(const p of pins){
  const stamp=p.utc.replace(/[-:TZ]/g,''),r=await fetch('https://web.archive.org/web/'+stamp+'id_/'+p.sourceUrl,{redirect:'manual',signal:AbortSignal.timeout(45000),headers:{accept:'text/html','accept-encoding':'identity'}});
  if(r.status!==200||Number(r.headers.get('content-length'))>100000)throw Error('Pinned retained media original unavailable');
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length!==p.bytes||sha(b)!==p.sha256||sha1Base32(b)!==p.sha1)throw Error('Pinned media body integrity mismatch');
  const paragraphs=[...b.toString('utf8').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].map(x=>visibleLiteralText(x[1]));
  for(const literal of MEDIA_FRAGMENTS){
   const matches=paragraphs.filter(x=>x.includes(literal));
   if(matches.length!==1||!/^Miller:\s/.test(matches[0])||/(?:Kill|Interviewer|Reporter):/.test(matches[0]))throw Error('Literal not in one explicit printed Miller turn');
  }
  verifiedVersions++;
 }
 const records=registry830().filter(r=>r.reg==='16891'&&r.year===2024);
 if(records.length!==1||records[0].id!=='16891:24:pcc:YE:0:0'||records[0].sha!=='e5d5d82d46ec7ac2c573c0cc4158541e06d2846e16573d748c0d052f7648b0a3')throw Error('Bounded Miller 2024 report version changed');
 const report=records[0],binary=await fetchVerifiedReportPdf(report),temp=mkdtempSync(join(tmpdir(),'senate864-miller-'));
 let financeRows;
 try{
  const pdf=join(temp,'official.pdf'),txt=join(temp,'official.txt');writeFileSync(pdf,binary.bytes,{mode:0o600});
  execFileSync('pdftotext',['-layout',pdf,txt],{timeout:15000,maxBuffer:20000});
  const layout=readFileSync(txt,'utf8');
  if(!layout.includes('01/09/2025')||!layout.includes('16891'))throw Error('Printed report cover identity changed');
  financeRows=parseMillerPrintedRows(layout);
 }finally{rmSync(temp,{recursive:true,force:true})}
 return {documents,media:{pins,verifiedVersions},finance:{report,rows:financeRows}};
}
if(process.argv[1]?.endsWith('/verify-senate-864-three-bounded-originals.mjs')){
 verifyThreeBoundedOriginals().then(p=>{
  const receipt={schema:'senate864-three-bounded-originals-v1',reviewedCommit:process.env.GITHUB_SHA||null,verifiedAt:new Date().toISOString(),fourCommitteeOriginals:p.documents.map(d=>({day:d.meetingDate,sha256:d.originalRawPdfSha256,namedRolls:d.motions.length,namedChoices:d.motions.reduce((n,m)=>n+m.choices.length,0)})),mediaOriginals:p.media.pins,mediaVerifiedVersions:p.media.verifiedVersions,mediaFragments:MEDIA_FRAGMENTS.length,financeOriginal:p.finance.report,financePrintedItemizedRows:p.finance.rows.length,financeSchedules:{individualContributions:9,committeeFundContributions:9,campaignExpenditures:10,nonCampaignItemized:0},noDatabaseAccess:true,noHistoricalPublicByInference:true};
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/senate864-three-bounded-originals.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('SENATE864_THREE_BOUNDED_ORIGINALS_VERIFIED='+JSON.stringify(receipt));
 }).catch(()=>{console.error('SENATE864_THREE_BOUNDED_ORIGINALS_HOLD');process.exitCode=1});
}
