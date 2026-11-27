import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {FINANCE_ROSTER_SHA,FINANCE_RECEIPT_TYPE,reviewFinanceSummary,financeRoster} from '../src/evidence/2027-current-cfb-finance.js';
import {FINANCE_DETAIL_MARKER,FINANCE_LAYOUT_MARKER,FINANCE_DETAIL_TYPE,recoverFinanceSummary,diagnoseFinanceLayout} from '../src/evidence/2027-cfb-exact-original-summary.js';
import type {CfbReportViewerReference} from '../src/evidence/cfb-report-pdf-proof.js';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {assertArchiveConnection,withRestrictedArchiveTransaction,ARCHIVE_OWNER,ARCHIVE_ROLE,ARCHIVE_PROJECT} from '../src/operations/2027-preseason-existing-neon-archive.js';
import {storeBlob} from '../src/operations/2027-daily-collection.js';
const SOURCE_RUN='46037317625:1',MAX_REPORTS=24,MAX_TOTAL=48*1024*1024;
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
type Review={schemaVersion:string;session:string;rosterSha256:string;rosterStatus:string;runId:string;lrlId:string;seat:string;cohort:string;registrationNumber:string;reference:CfbReportViewerReference;sourceReceipt:{bodySha256:string;bodyBytes:number;observedAt:string;url:string};summary:ReturnType<typeof reviewFinanceSummary>;rawBodyRetained:boolean;servingEligible:boolean;canonicalWriteAllowed:boolean;modelWeight:number};
async function main(){
  const env=process.env,event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH!,'utf8')) as {repository?:{full_name?:string;default_branch?:string};head_commit?:{id?:string;message?:string};after?:string;forced?:boolean;deleted?:boolean};
  const message=event.head_commit?.message??'';
  const layoutMode=message.includes(FINANCE_LAYOUT_MARKER);
  const recoveryMode=message.includes(FINANCE_DETAIL_MARKER);
  if(layoutMode===recoveryMode)throw Error('Exactly one finance operation marker required');
  if(env.VERCEL||env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||event.repository?.full_name!==env.GITHUB_REPOSITORY||event.repository?.default_branch!=='main'||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_WORKFLOW_REF!=='killjoy00/votepredict/.github/workflows/2027-cfb-exact-original-summary.yml@refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||env.FINANCE_DETAIL_CI_VERIFIED!=='true'||!(/^\d{1,20}$/.test(env.GITHUB_RUN_ID??''))||event.after!==env.GITHUB_SHA||event.head_commit?.id!==env.GITHUB_SHA||event.forced===true||event.deleted===true||env.VOTEPREDICT_NEON_PROJECT_ID!==ARCHIVE_PROJECT)throw Error('Finance detail approval gate failed');
  const current=await fetch('https://api.github.com/repos/killjoy00/votepredict/git/ref/heads/main',{headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!current.ok||(await current.json()).object?.sha!==env.GITHUB_SHA)throw Error('Finance detail reviewed main changed');
  const root='docs/evaluation/source-proof/';
  const roster=financeRoster(readFileSync(root+'2027-preseason-roster-20261126.json','utf8'),JSON.parse(readFileSync(root+'2027-incoming-evidence-pilot-20261126-part1.json','utf8')));
  const neon=await discoverExistingVotePredictNeonConnection({apiKey:env.NEON_API_KEY??'',projectId:ARCHIVE_PROJECT,preferredDatabase:'votepredict',requirePrimary:true});
  assertArchiveConnection(neon);
  const db=new Pool({host:neon.host,port:neon.port,database:neon.database,user:neon.role,password:neon.password,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000});
  const started=Date.now();
  try{
    const result=await withRestrictedArchiveTransaction(db,ARCHIVE_OWNER,ARCHIVE_ROLE,async client=>{
      const rows=(await client.query<{review_sha:string;review_body:Buffer;pdf_body:Buffer;pdf_sha:string}>("WITH r AS (SELECT sha256,body,convert_from(body,'UTF8')::jsonb AS j FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'runId'=$2) SELECT r.sha256 AS review_sha,r.body AS review_body,b.body AS pdf_body,b.sha256 AS pdf_sha FROM r JOIN evidence_content_blobs b ON b.sha256=r.j->'sourceReceipt'->>'bodySha256' WHERE b.media_type='application/pdf' ORDER BY r.j->>'lrlId' LIMIT 25",[FINANCE_RECEIPT_TYPE,SOURCE_RUN])).rows;
      if(rows.length!==MAX_REPORTS||rows.reduce((n,r)=>n+r.pdf_body.length,0)>MAX_TOTAL)throw Error('Finance detail source inventory mismatch');
      const previous=(await client.query<{n:number}>("SELECT count(*)::int AS n FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'sourceRunId'=$2",[FINANCE_DETAIL_TYPE,SOURCE_RUN])).rows[0]?.n;
      if(previous!==(layoutMode?MAX_REPORTS:0))throw Error('Finance prior validation inventory mismatch');
      const layoutShapes=new Map<string,number>();
      const ids=new Set<string>();let incoming=0,returning=0;const summaries:Array<ReturnType<typeof recoverFinanceSummary>>=[];
      for(const row of rows){
        if(Date.now()-started>120000)throw Error('Finance detail review time bound');
        const r=JSON.parse(row.review_body.toString('utf8')) as Review,p=r.sourceReceipt;
        const member=roster.find(m=>m.lrlId===r.lrlId&&m.seat===r.seat&&m.cohort===r.cohort);
        if(!member||ids.has(r.lrlId)||r.schemaVersion!=='2027-preseason-finance-report-review-v1'||r.session!=='2027-2028'||r.rosterSha256!==FINANCE_ROSTER_SHA||r.rosterStatus!=='projected_not_activation_verified'||r.runId!==SOURCE_RUN||r.rawBodyRetained!==true||r.servingEligible!==false||r.canonicalWriteAllowed!==false||r.modelWeight!==0||r.registrationNumber!==r.reference.registrationNumber||p.bodySha256!==row.pdf_sha||p.bodyBytes!==row.pdf_body.length||p.bodyBytes<300||p.bodyBytes>4*1024*1024||row.pdf_body.subarray(0,5).toString('ascii')!=='%PDF-'||hash(row.review_body)!==row.review_sha||hash(row.pdf_body)!==row.pdf_sha||r.summary.totalReceiptsCents===null)throw Error('Finance original review binding failed');
        ids.add(r.lrlId);if(r.cohort==='incoming')incoming++;else returning++;
        let dir:string|undefined;
        try{
          dir=mkdtempSync(join(tmpdir(),'votepredict-finance-detail-'));const file=join(dir,'report.pdf');writeFileSync(file,row.pdf_body,{mode:0o600});
          const text=execFileSync('pdftotext',['-f','1','-l','6','-layout',file,'-'],{encoding:'utf8',timeout:10000,maxBuffer:1500000,stdio:['ignore','pipe','ignore']});
          const recheck=reviewFinanceSummary(text.replace(/\f/g,'\n'),r.reference,p.observedAt);
          if(recheck.totalReceiptsCents!==r.summary.totalReceiptsCents||recheck.boardReceivedOn!==r.summary.boardReceivedOn||recheck.coverageEndOn!==r.summary.coverageEndOn||recheck.reportUrl!==r.summary.reportUrl)throw Error('Finance prior summary reproduction failed');
          const detail=recoverFinanceSummary(text,r.summary.totalReceiptsCents);
          if(layoutMode){
            const key=JSON.stringify(diagnoseFinanceLayout(text));
            layoutShapes.set(key,(layoutShapes.get(key)??0)+1);
            summaries.push(detail);
            continue;
          }
          // Append new interpretation linked to original PDF and prior
          // receipt. Never modify old review or fabricate an absent amount.
          await storeBlob(client,Buffer.from(JSON.stringify({schemaVersion:'2027-preseason-finance-summary-validation-v1',session:'2027-2028',rosterSha256:FINANCE_ROSTER_SHA,rosterStatus:'projected_not_activation_verified',sourceRunId:SOURCE_RUN,runId:env.GITHUB_RUN_ID+':1',lrlId:r.lrlId,seat:r.seat,cohort:r.cohort,registrationNumber:r.registrationNumber,reference:r.reference,priorReviewSha256:row.review_sha,sourceBodySha256:row.pdf_sha,sourceBodyBytes:p.bodyBytes,observedAt:p.observedAt,reviewedAt:new Date().toISOString(),detail,rawBodyRetained:true,availableBeforeObservationProved:false,servingEligible:false,canonicalWriteAllowed:false,modelWeight:0,reviewRequired:true})),FINANCE_DETAIL_TYPE,true);
          summaries.push(detail);
        }finally{if(dir)rmSync(dir,{recursive:true,force:true});}
      }
      if(incoming!==12||returning!==12)throw Error('Finance review cohort mismatch');
      if(layoutMode)return {mode:'layout_diagnostic',reports:summaries.length,incoming,returning,layoutShapes:[...layoutShapes].map(([shape,count])=>({shape:JSON.parse(shape),count})),newSourceDownloads:0,validationWrites:0,canonicalWrites:0,modelChanges:0};
      const count=(fn:(d:ReturnType<typeof recoverFinanceSummary>)=>boolean)=>summaries.filter(fn).length;
      return {reports:summaries.length,incoming,returning,receiptsVerified:count(x=>x.totalReceiptsCents!==null),disbursementsVerified:count(x=>x.totalDisbursementsCents!==null),cashBalanceVerified:count(x=>x.endingCashBalanceCents!==null),loanBalanceObserved:count(x=>x.reportedOutstandingLoanBalanceCents!==null),diagnosticShapes:summaries.reduce((a,x)=>{const k=JSON.stringify(x.diagnostics);a[k]=(a[k]??0)+1;return a;},{} as Record<string,number>),newSourceDownloads:0,canonicalWrites:0,modelChanges:0};
    });
    console.log('CFB_EXACT_ORIGINAL_SUMMARY '+JSON.stringify(result));
  }finally{await db.end();}
}
main().catch(()=>{console.error('Finance exact-original summary recovery failed closed.');process.exitCode=1;});
