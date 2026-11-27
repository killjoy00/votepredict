import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertPublicHost,canonicalPublicUrl,publicPageMentionsPerson} from '@/evidence/public-http';
import {PRESEASON_LIMITS,type PreseasonTarget,type PreseasonBudget,type PreseasonReceipt} from './2027-preseason-evidence-archive';
export const EDUCATION_KIND='published_education_questionnaire_pdf';
const ROSTER_SHA='3b062058cbe77d2ff6caad8719a65535ad75849d48e0c627c9b460ef48df17bd';
const PDF_URL=/^https:\/\/www\.edmnvotes\.org\/wp-content\/uploads\/2026\/(?:07|09)\/[A-Za-z0-9-]+\.pdf$/;
type Member={lrlId:string;seat:string;name:string;electionName:string};
type Lead=Member&{url:string;rawBodyRetained:boolean;semanticReviewVerified:boolean;browserTextAccessible:boolean};
type Manifest={schemaVersion:string;session:string;rosterSha256:string;indexUrl:string;publisher:string;matchedLinks:number;browserTextAccessible:number;sources:Lead[];rawBodyRetained:boolean;servingEligible:boolean;canonicalWriteAllowed:boolean;modelWeight:number};
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
export function buildEducationTargets(rosterRaw:string,cohort:{summary:{rosterSha256:string};targets:Member[]},manifest:Manifest){
  const roster=JSON.parse(rosterRaw) as {session:string;members:Member[]};
  if(hash(rosterRaw)!==ROSTER_SHA||cohort.summary.rosterSha256!==ROSTER_SHA||cohort.targets.length!==51||roster.session!=='2027-2028'||roster.members.length!==201||
    manifest.schemaVersion!=='2027-education-questionnaire-leads-v1'||manifest.session!==roster.session||manifest.rosterSha256!==ROSTER_SHA||
    manifest.indexUrl!=='https://www.edmnvotes.org/voter-guide/'||manifest.publisher!=='Education Minnesota'||manifest.matchedLinks!==32||manifest.browserTextAccessible!==28||
    manifest.sources.length!==32||manifest.sources.filter(x=>x.browserTextAccessible===true).length!==28||manifest.rawBodyRetained!==false||manifest.servingEligible!==false||manifest.canonicalWriteAllowed!==false||manifest.modelWeight!==0||
    new Set(manifest.sources.map(s=>s.lrlId)).size!==32||new Set(manifest.sources.map(s=>s.url)).size!==32)throw Error('Education questionnaire manifest mismatch');
  const targets=manifest.sources.map(s=>{
    const p=roster.members.find(m=>m.lrlId===s.lrlId&&m.seat===s.seat&&m.name===s.name&&m.electionName===s.electionName);
    if(!p||!cohort.targets.some(m=>m.lrlId===s.lrlId&&m.seat===s.seat&&m.name===s.name)||!PDF_URL.test(s.url)||canonicalPublicUrl(s.url)!==s.url||s.rawBodyRetained!==false||s.semanticReviewVerified!==false||typeof s.browserTextAccessible!=='boolean')throw Error('Education source identity or URL mismatch');
    const district=p.seat.split(':')[1].padStart(p.seat.startsWith('house:')?3:2,'0');
    if(!new URL(s.url).pathname.split('/').pop()?.startsWith(district+'-'))throw Error('Education district filename mismatch');
    return {...p,url:s.url,kind:EDUCATION_KIND,publisher:manifest.publisher,rosterSha256:ROSTER_SHA};
  }).sort((a,b)=>Number(a.lrlId)-Number(b.lrlId));
  return {'education-1':targets.slice(0,16),'education-2':targets.slice(16)} satisfies Record<string,PreseasonTarget[]>;
}
export function validateEducationHeader(text:string,target:PreseasonTarget){
  const first=text.slice(0,12000);
  const match=/Candidate\s+for\s+Minnesota\s+(House|Senate)\s+District\s+0*([1-9]\d?)([AB]?)\b/i.exec(first);
  if(!match||!/(?:2026\s+Minnesota\s+Legislative\s+Screening)/i.test(first)||!/(?:Yes\/No questions|Q1\.)/i.test(first))throw Error('SOURCE_PDF_HEADER_UNVERIFIED');
  const seat=match[1].toLowerCase()+':'+Number(match[2])+match[3].toUpperCase();
  const title=first.slice(0,Math.min(match.index,400));
  if(seat!==target.seat||![target.name,target.electionName].some(n=>publicPageMentionsPerson(title,n)))throw Error('SOURCE_PDF_IDENTITY_UNVERIFIED');
  return true;
}
export async function fetchEducationPdf(target:PreseasonTarget,budget:PreseasonBudget,runId:string,fetcher:typeof fetch=fetch){
  if(target.kind!==EDUCATION_KIND||!PDF_URL.test(target.url)||target.rosterSha256!==ROSTER_SHA||target.publisher!=='Education Minnesota')throw Error('SOURCE_PDF_SCOPE_REJECTED');
  if(budget.requests>=PRESEASON_LIMITS.sources||budget.bytes>=PRESEASON_LIMITS.maxBytes||Date.now()-budget.started>=PRESEASON_LIMITS.runMs)throw Error('SOURCE_BUDGET_EXHAUSTED');
  const url=new URL(target.url);await assertPublicHost(url);
  budget.requests++;
  const response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{'user-agent':'VotePredict/2.0 bounded preseason evidence review',accept:'application/pdf'},signal:AbortSignal.timeout(Math.max(1,Math.min(PRESEASON_LIMITS.timeoutMs,PRESEASON_LIMITS.runMs-(Date.now()-budget.started))))});
  if(response.status!==200){await response.body?.cancel();throw Error('SOURCE_HTTP_'+response.status);}
  if(response.url!==target.url||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/pdf'){await response.body?.cancel();throw Error('SOURCE_PDF_TYPE_OR_URL_MISMATCH');}
  const limit=Math.min(PRESEASON_LIMITS.maxPageBytes,PRESEASON_LIMITS.maxBytes-budget.bytes);
  if(!response.body||Number(response.headers.get('content-length')??0)>limit){await response.body?.cancel();throw Error('SOURCE_SIZE_LIMIT');}
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;budget.bytes+=part.value.byteLength;if(size>limit){await reader.cancel();throw Error('SOURCE_SIZE_LIMIT');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const raw=Buffer.concat(chunks),observedAt=new Date().toISOString();
  if(raw.length<300||raw.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('SOURCE_NOT_PDF');
  const dir=mkdtempSync(join(tmpdir(),'votepredict-education-'));
  try{
    const file=join(dir,'questionnaire.pdf');writeFileSync(file,raw,{mode:0o600});
    const text=execFileSync('pdftotext',['-f','1','-l','1','-layout',file,'-'],{encoding:'utf8',timeout:5000,maxBuffer:200000,stdio:['ignore','pipe','ignore']});
    validateEducationHeader(text,target);
  }finally{rmSync(dir,{recursive:true,force:true});}
  const receipt:PreseasonReceipt={schemaVersion:'2027-preseason-source-review-v1',session:'2027-2028',runId,rosterSha256:target.rosterSha256,lrlId:target.lrlId,seat:target.seat,sourceUrl:target.url,sourceKind:target.kind,publisher:target.publisher,observedAt,bodySha256:hash(raw),bodyBytes:raw.length,claimedPublicationAt:null,identityNameMentioned:true,rawBodyRetained:false,reviewRequired:true,servingEligible:false,canonicalWriteAllowed:false,modelWeight:0};
  return {receipt,raw};
}
