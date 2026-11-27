import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {financeRoster,parseFinanceRegistry,matchFinanceRoster,currentFinanceReference,selectFinancePilot,reviewFinanceSummary,FINANCE_LIMITS,FINANCE_ROSTER_SHA,FINANCE_RECEIPT_TYPE,FINANCE_EVENT_TYPE,FINANCE_MARKER} from '../src/evidence/2027-current-cfb-finance.js';
import {cfbReportViewerUrl} from '../src/evidence/cfb-current-report-acquisition.js';
import {cfbCandidateReportsTabForm,parseCfbCandidateReportsTabResponse} from '../src/evidence/cfb-candidate-report-history.js';
import {selectCurrentFinanceReference,type FinanceMember,type FinanceRegistration} from '../src/evidence/2027-current-cfb-finance.js';
import type {CfbReportViewerReference} from '../src/evidence/cfb-report-pdf-proof.js';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {assertArchiveConnection,withRestrictedArchiveTransaction,ARCHIVE_OWNER,ARCHIVE_ROLE,ARCHIVE_PROJECT} from '../src/operations/2027-preseason-existing-neon-archive.js';
import {storeBlob} from '../src/operations/2027-daily-collection.js';
const read=(n:string)=>readFileSync('docs/evaluation/source-proof/'+n,'utf8');
const members=financeRoster(read('2027-preseason-roster-20261126.json'),JSON.parse(read('2027-incoming-evidence-pilot-20261126-part1.json')));
const API='https://register.cfb.mn.gov/reports/api/',APP='https://register.cfb.mn.gov/reports/current-lists/';
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const started=Date.now();let requests=0,bytes=0;let stage='initialization';
async function bounded(url:string,limit:number,init:RequestInit={}){
  if(requests>=FINANCE_LIMITS.requests||bytes>=FINANCE_LIMITS.maxBytes||Date.now()-started>=FINANCE_LIMITS.runMs)throw Error('finance_budget_exhausted');
  const target=new URL(url);if(target.protocol!=='https:'||!['register.cfb.mn.gov','cfb.mn.gov','www.cfb.mn.gov'].includes(target.hostname)||target.username||target.password||target.port)throw Error('finance_source_url_rejected');
  const send=async (u:string)=>{
    if(requests>=FINANCE_LIMITS.requests||Date.now()-started>=FINANCE_LIMITS.runMs)throw Error('finance_budget_exhausted');
    requests++;
    return fetch(u,{...init,redirect:'manual',signal:AbortSignal.timeout(Math.min(20000,Math.max(1,FINANCE_LIMITS.runMs-(Date.now()-started)))),headers:{'user-agent':'VotePredict/2.0 bounded current candidate finance archive',...(init.headers as Record<string,string>|undefined)}});
  };
  let final=url,r=await send(url);
  if([301,302,303,307,308].includes(r.status)){
    const location=r.headers.get('location');await r.body?.cancel();
    if(!location)throw Error('finance_redirect_missing_location');
    const next=new URL(location,url);
    // The public legacy app has an official same-origin canonical route.
    // Permit only that specific observed app redirect, not arbitrary API or PDF redirects.
    if(url!==APP||init.method==='POST'||next.origin!=='https://register.cfb.mn.gov'||
      next.pathname.replace(/\/+$/,'')!=='/reports-and-data/searches-and-lists/other-reports-and-lists/current-lists'||
      next.searchParams.get('_uri')!=='reports/current-lists/'||[...next.searchParams.keys()].some(k=>k!=='_uri')||next.hash||next.username||next.password)
      throw Error('finance_redirect_scope_hold');
    final=next.toString();r=await send(final);
  }
  if(r.status!==200){await r.body?.cancel();throw Error('finance_http_'+r.status);}
  if(r.url!==final){await r.body?.cancel();throw Error('finance_source_url_mismatch');}
  const max=Math.min(limit,FINANCE_LIMITS.maxBytes-bytes);
  if(!r.body||Number(r.headers.get('content-length')??0)>max){await r.body?.cancel();throw Error('finance_source_size_limit');}
  const chunks:Uint8Array[]=[];let size=0;const reader=r.body.getReader();
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;bytes+=p.value.byteLength;if(size>max){await reader.cancel();throw Error('finance_source_size_limit');}chunks.push(p.value);}}finally{reader.releaseLock();}
  const raw=Buffer.concat(chunks);const observedAt=new Date().toISOString();
  return {raw,receipt:{url,finalUrl:final,observedAt,bodySha256:hash(raw),bodyBytes:raw.length},headers:r.headers};
}
function reason(e:unknown){const s=e instanceof Error?e.message:'';return /^finance_[a-z0-9_]+$/.test(s)?s:/abort|timeout/i.test(s)?'finance_source_timeout':/coverage|identity|heading/i.test(s)?'finance_report_identity_or_date_hold':/summary/i.test(s)?'finance_summary_unverified':'finance_source_or_parser_hold';}
async function main(){
  const mode=process.argv[2];if(process.argv.length!==3||!['--probe','--archive'].includes(mode))throw Error('Unsupported mode');
  const env=process.env,event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH!,'utf8')) as {repository?:{full_name?:string;default_branch?:string};head_commit?:{id?:string;message?:string};after?:string;forced?:boolean;deleted?:boolean;pull_request?:{head?:{repo?:{full_name?:string}}}};
  if(env.VERCEL||env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||event.repository?.full_name!==env.GITHUB_REPOSITORY||event.repository.default_branch!=='main'||env.GITHUB_RUN_ATTEMPT!=='1'||!/^\d{1,20}$/.test(env.GITHUB_RUN_ID??''))throw Error('Finance runner scope rejected');
  if(mode==='--probe'){
    if(env.GITHUB_EVENT_NAME!=='pull_request'||env.GITHUB_HEAD_REF!=='feat/2027-current-cfb-finance-pilot'||event.pull_request?.head?.repo?.full_name!==env.GITHUB_REPOSITORY)throw Error('Finance PR scope rejected');
  }else{
    if(env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_WORKFLOW_REF!=='killjoy00/votepredict/.github/workflows/2027-current-cfb-finance.yml@refs/heads/main'||env.FINANCE_CI_VERIFIED!=='true'||event.after!==env.GITHUB_SHA||event.head_commit?.id!==env.GITHUB_SHA||!event.head_commit?.message?.includes(FINANCE_MARKER)||event.forced===true||event.deleted===true||env.VOTEPREDICT_NEON_PROJECT_ID!==ARCHIVE_PROJECT)throw Error('Finance archive approval gate rejected');
    const main=await fetch('https://api.github.com/repos/killjoy00/votepredict/git/ref/heads/main',{headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!main.ok||(await main.json()).object?.sha!==env.GITHUB_SHA)throw Error('Finance reviewed main changed');
  }
  stage='official_app';
  const app=await bounded(APP,FINANCE_LIMITS.maxGridBytes);
  const headers=app.headers as Headers&{getSetCookie?:()=>string[]};
  const cookie=(headers.getSetCookie?.()??[headers.get('set-cookie')??'']).map(s=>s.split(';')[0]).filter(Boolean).join('; ');
  async function load(action:'all-registered-candidates'|'candidate-reports'){
    const body=new URLSearchParams({action:'grid_data','data[action]':action,'data[type]':'current-lists','data[params][0]':'all'}).toString();
    const d=await bounded(API,FINANCE_LIMITS.maxGridBytes,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded; charset=UTF-8','x-requested-with':'XMLHttpRequest',referer:APP,origin:'https://register.cfb.mn.gov',accept:'application/json',...(cookie?{cookie}:{})},body});
    return {json:JSON.parse(d.raw.toString('utf8')) as unknown,receipt:{...d.receipt,action,method:'POST',requestBodySha256:hash(body)}};
  }
  stage='registry_grid';const registry=await load('all-registered-candidates');
  stage='report_grid';const reports=await load('candidate-reports');
  stage='registry_identity_join';const parsed=parseFinanceRegistry(registry.json),crosswalk=matchFinanceRoster(members,parsed.rows);
  const safeGrid=(v:unknown)=>{const o=v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};return {hasCols:Array.isArray(o.cols),columnCount:Array.isArray(o.cols)?o.cols.length:0,hasData:!!o.data&&typeof o.data==='object',hasTabcontent:typeof o.tabcontent==='string',hasError:Object.hasOwn(o,'error'),hasMessage:Object.hasOwn(o,'message')};};
  console.log('CFB_FINANCE_GRID_SHAPE '+JSON.stringify({registryRows:parsed.rawRows,registryMalformed:parsed.malformedLegislativeRows,matched:crosswalk.matches.length,reportGrid:safeGrid(reports.json)}));
  stage='report_reference_selection';
  type Target={member:FinanceMember;registration:FinanceRegistration;reference:CfbReportViewerReference;reportReferenceReceipt:Record<string,unknown>};
  const referenceGaps:Array<{lrlId:string;seat:string;cohort:FinanceMember['cohort'];registrationNumber:string;reason:string}>=[];
  let gridUsable=false;let usedCandidateTabs=false;
  const candidates:Target[]=[];
  try{
    for(const x of crosswalk.matches){
      const r=currentFinanceReference(reports.json,x.registration.registrationNumber);
      if(r.reference)candidates.push({...x,reference:r.reference,reportReferenceReceipt:reports.receipt});
    }
    gridUsable=true;
  }catch{candidates.length=0;}
  let selected:Target[];
  if(gridUsable&&candidates.length){
    selected=selectFinancePilot(candidates);
  }else{
    usedCandidateTabs=true;
    // The current-list API no longer returns the established report grid for
    // the all-period selector. Reuse the already audited per-candidate report
    // viewer tab contract; never construct guessed report references.
    const ordered=[...crosswalk.matches].sort((a,b)=>Number(a.member.lrlId)-Number(b.member.lrlId));
    const tranche=[...ordered.filter(x=>x.member.cohort==='incoming').slice(0,FINANCE_LIMITS.incoming),...ordered.filter(x=>x.member.cohort==='returning').slice(0,FINANCE_LIMITS.returning)];
    const api='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/api';
    stage='candidate_report_tabs';
    for(const x of tranche){
      try{
        const referer='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+x.registration.registrationNumber+'/2026/';
        // The existing public app session cookie is same-origin; the viewer
        // POST uses the repository's previously verified form contract.
        const form=cfbCandidateReportsTabForm(x.registration.registrationNumber,2026).toString();
        const response=await bounded(api,FINANCE_LIMITS.maxGridBytes,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded; charset=UTF-8','x-requested-with':'XMLHttpRequest',referer,origin:'https://register.cfb.mn.gov',accept:'application/json',...(cookie?{cookie}:{})},body:form});
        const refs=parseCfbCandidateReportsTabResponse(response.raw.toString('utf8'),x.registration.registrationNumber,2026);
        const r=selectCurrentFinanceReference(refs,x.registration.registrationNumber);
        if(!r.reference){referenceGaps.push({lrlId:x.member.lrlId,seat:x.member.seat,cohort:x.member.cohort,registrationNumber:x.registration.registrationNumber,reason:r.reason??'no_reference'});continue;}
        candidates.push({...x,reference:r.reference,reportReferenceReceipt:{...response.receipt,sourceUrl:referer,method:'POST',requestBodySha256:hash(form),referenceCount:refs.length}});
      }catch(e){referenceGaps.push({lrlId:x.member.lrlId,seat:x.member.seat,cohort:x.member.cohort,registrationNumber:x.registration.registrationNumber,reason:reason(e)});}
    }
    selected=candidates;
  }
  const counts=(arr:readonly {cohort:string}[])=>({incoming:arr.filter(x=>x.cohort==='incoming').length,returning:arr.filter(x=>x.cohort==='returning').length});
  const inventory={rosterSha256:FINANCE_ROSTER_SHA,registry:registry.receipt,currentReportList:reports.receipt,referenceDiscovery:usedCandidateTabs?'candidate_report_tabs':'current_grid',registryColumns:parsed.columns,rawRegistryRows:parsed.rawRows,malformedLegislativeRows:parsed.malformedLegislativeRows,matched:counts(crosswalk.matches.map(x=>x.member)),currentPreGeneral:counts(candidates.map(x=>x.member)),selected:counts(selected.map(x=>x.member)),crosswalk:crosswalk.matches.map(x=>({lrlId:x.member.lrlId,seat:x.member.seat,cohort:x.member.cohort,registrationNumber:x.registration.registrationNumber,registeredOn:x.registration.registeredOn,terminatedOn:x.registration.terminatedOn,currentReportReference:candidates.find(c=>c.member.lrlId===x.member.lrlId)?.reference??null})),gaps:crosswalk.gaps,referenceGaps};
  console.log('CFB_FINANCE_REGISTRY '+JSON.stringify({rosterSha256:inventory.rosterSha256,registry:inventory.registry,rawRegistryRows:inventory.rawRegistryRows,malformedLegislativeRows:inventory.malformedLegislativeRows,matched:inventory.matched,crosswalk:inventory.crosswalk,gaps:inventory.gaps}));
  console.log('CFB_FINANCE_REFERENCE_SELECTION '+JSON.stringify({method:inventory.referenceDiscovery,selected:inventory.selected,referenceGaps}));
  if(!selected.length)throw Error('finance_no_verified_candidates');
  stage='report_pdf_collection';
  const successes:Array<{record:Record<string,unknown>;raw:Buffer}>=[];const failures:Array<Record<string,unknown>>=[];
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(const {member,registration,reference,reportReferenceReceipt} of selected){
    const common={lrlId:member.lrlId,seat:member.seat,cohort:member.cohort,registrationNumber:registration.registrationNumber,reference};
    let dir:string|undefined;
    try{
      const url=cfbReportViewerUrl(reference);
      const d=await bounded(url,FINANCE_LIMITS.maxPdfBytes,{headers:{accept:'application/pdf',referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+registration.registrationNumber+'/2026/'}});
      if(d.raw.length<300||d.raw.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('finance_not_pdf');
      dir=mkdtempSync(join(tmpdir(),'votepredict-cfb-current-'));const file=join(dir,'report.pdf');writeFileSync(file,d.raw,{mode:0o600});
      const text=execFileSync('pdftotext',['-f','1','-l','6','-layout','-nopgbrk',file,'-'],{encoding:'utf8',timeout:12000,maxBuffer:1500000,stdio:['ignore','pipe','ignore']});
      const summary=reviewFinanceSummary(text,reference,d.receipt.observedAt);
      successes.push({raw:d.raw,record:{schemaVersion:'2027-preseason-finance-report-review-v1',session:'2027-2028',rosterSha256:FINANCE_ROSTER_SHA,rosterStatus:'projected_not_activation_verified',runId:env.GITHUB_RUN_ID+':1',...common,sourceReceipt:d.receipt,summary,registryReceipt:registry.receipt,reportListReceipt:reportReferenceReceipt,availableBeforeObservationProved:false,rawBodyRetained:false,servingEligible:false,canonicalWriteAllowed:false,modelWeight:0,reviewRequired:true}});
    }catch(e){failures.push({...common,reason:reason(e)});}finally{if(dir)rmSync(dir,{recursive:true,force:true});}
  }
  const summary={mode,requests,bytes,selected:inventory.selected,verifiedReports:successes.length,verifiedReceiptTotals:successes.filter(x=>(x.record.summary as {totalReceiptsCents:number|null}).totalReceiptsCents!==null).length,verifiedDisbursementTotals:successes.filter(x=>(x.record.summary as {totalDisbursementsCents:number|null}).totalDisbursementsCents!==null).length,failures:failures.length,completeCoverageVerified:false,canonicalWrites:0,modelChanges:0};
  if(mode==='--archive'){
    if(!successes.length)throw Error('No verified official candidate reports');
    stage='protected_archive';const target=await discoverExistingVotePredictNeonConnection({apiKey:env.NEON_API_KEY??'',projectId:ARCHIVE_PROJECT,preferredDatabase:'votepredict',requirePrimary:true});assertArchiveConnection(target);
    const db=new Pool({host:target.host,port:target.port,database:target.database,user:target.role,password:target.password,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000});
    try{
      await withRestrictedArchiveTransaction(db,ARCHIVE_OWNER,ARCHIVE_ROLE,async client=>{
        const already=(await client.query<{n:number}>("SELECT count(*)::int AS n FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'state'='committed' AND convert_from(body,'UTF8')::jsonb->>'day'=$2",[FINANCE_EVENT_TYPE,day])).rows[0]?.n;
        if(already!==0)throw Error('Finance daily pilot already committed');
        for(const x of successes){
          const receipt=x.record.sourceReceipt as {bodySha256:string;bodyBytes:number;observedAt:string};
          if(hash(x.raw)!==receipt.bodySha256||x.raw.length!==receipt.bodyBytes||Date.now()-Date.parse(receipt.observedAt)>300000)throw Error('Finance original acceptance window or hash mismatch');
          await storeBlob(client,x.raw,'application/pdf');
          await storeBlob(client,Buffer.from(JSON.stringify({...x.record,rawBodyRetained:true})),FINANCE_RECEIPT_TYPE,true);
        }
        await storeBlob(client,Buffer.from(JSON.stringify({schemaVersion:'2027-preseason-finance-collection-v1',session:'2027-2028',day,runId:env.GITHUB_RUN_ID+':1',state:'committed',inventory,summary,failures,servingEligible:false,canonicalWriteAllowed:false,modelWeight:0})),FINANCE_EVENT_TYPE,true);
      });
    }finally{await db.end();}
  }
  console.log('CFB_CURRENT_FINANCE_INVENTORY '+JSON.stringify(inventory));
  for(const x of successes)console.log('CFB_CURRENT_FINANCE_REPORT '+JSON.stringify({...x.record,rawBodyRetained:mode==='--archive'}));
  for(const x of failures)console.log('CFB_CURRENT_FINANCE_GAP '+JSON.stringify(x));
  console.log('CFB_CURRENT_FINANCE_SUMMARY '+JSON.stringify(summary));
  if(!successes.length)process.exitCode=1;
}
main().catch(e=>{console.error('CFB_FINANCE_FATAL '+JSON.stringify({stage,reason:reason(e),requests,bytes}));process.exitCode=1;});
