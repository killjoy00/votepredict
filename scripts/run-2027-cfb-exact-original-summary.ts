import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {Pool} from 'pg';
import {FINANCE_ROSTER_SHA,FINANCE_RECEIPT_TYPE,FINANCE_EVENT_TYPE,FINANCE_LIMITS,financeCollectionHistory,reviewFinanceSummary,financeRoster} from '../src/evidence/2027-current-cfb-finance.js';
import {FINANCE_DETAIL_TYPE,FINANCE_DETAIL_V2_TYPE,selectFinanceRecoveryMode,recoverFinanceSummary,recoverFinanceSummaryV2,diagnoseFinanceLayout} from '../src/evidence/2027-cfb-exact-original-summary.js';
import type {CfbReportViewerReference} from '../src/evidence/cfb-report-pdf-proof.js';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {assertArchiveConnection,withRestrictedArchiveTransaction,ARCHIVE_OWNER,ARCHIVE_ROLE,ARCHIVE_PROJECT} from '../src/operations/2027-preseason-existing-neon-archive.js';
import {storeBlob} from '../src/operations/2027-daily-collection.js';
const MAX_REPORTS=FINANCE_LIMITS.incoming+FINANCE_LIMITS.returning,MAX_TOTAL=FINANCE_LIMITS.maxBytes;
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
type Review={schemaVersion:string;session:string;rosterSha256:string;rosterStatus:string;runId:string;lrlId:string;seat:string;cohort:string;registrationNumber:string;reference:CfbReportViewerReference;sourceReceipt:{bodySha256:string;bodyBytes:number;observedAt:string;url:string};summary:ReturnType<typeof reviewFinanceSummary>;rawBodyRetained:boolean;servingEligible:boolean;canonicalWriteAllowed:boolean;modelWeight:number};
let recoveryStage='approval_gate';
let checkedReports=0;
async function main(){
  const env=process.env,event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH!,'utf8')) as {repository?:{full_name?:string;default_branch?:string};head_commit?:{id?:string;message?:string};after?:string;forced?:boolean;deleted?:boolean};
  const {layoutMode,v2Mode,expansionMode,sourceRun}=selectFinanceRecoveryMode(event.head_commit?.message??'');
  const useV2=v2Mode||expansionMode;
  if(env.VERCEL||env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||event.repository?.full_name!==env.GITHUB_REPOSITORY||event.repository?.default_branch!=='main'||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_WORKFLOW_REF!=='killjoy00/votepredict/.github/workflows/2027-cfb-exact-original-summary.yml@refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||env.FINANCE_DETAIL_CI_VERIFIED!=='true'||!(/^\d{1,20}$/.test(env.GITHUB_RUN_ID??''))||event.after!==env.GITHUB_SHA||event.head_commit?.id!==env.GITHUB_SHA||event.forced===true||event.deleted===true||env.VOTEPREDICT_NEON_PROJECT_ID!==ARCHIVE_PROJECT)throw Error('Finance detail approval gate failed');
  recoveryStage='exact_main';
  const current=await fetch('https://api.github.com/repos/killjoy00/votepredict/git/ref/heads/main',{headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!current.ok||(await current.json()).object?.sha!==env.GITHUB_SHA)throw Error('Finance detail reviewed main changed');
  recoveryStage='roster';
  const root='docs/evaluation/source-proof/';
  const roster=financeRoster(readFileSync(root+'2027-preseason-roster-20261126.json','utf8'),JSON.parse(readFileSync(root+'2027-incoming-evidence-pilot-20261126-part1.json','utf8')));
  recoveryStage='connection';
  const neon=await discoverExistingVotePredictNeonConnection({apiKey:env.NEON_API_KEY??'',projectId:ARCHIVE_PROJECT,preferredDatabase:'votepredict',requirePrimary:true});
  assertArchiveConnection(neon);
  const db=new Pool({host:neon.host,port:neon.port,database:neon.database,user:neon.role,password:neon.password,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000});
  const started=Date.now();
  try{
    recoveryStage='restricted_transaction';
    const result=await withRestrictedArchiveTransaction(db,ARCHIVE_OWNER,ARCHIVE_ROLE,async client=>{
      recoveryStage='original_inventory';
      const rows=(await client.query<{review_sha:string;review_body:Buffer;pdf_body:Buffer;pdf_sha:string}>("WITH r AS (SELECT sha256,body,convert_from(body,'UTF8')::jsonb AS j FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'runId'=$2) SELECT r.sha256 AS review_sha,r.body AS review_body,b.body AS pdf_body,b.sha256 AS pdf_sha FROM r JOIN evidence_content_blobs b ON b.sha256=r.j->'sourceReceipt'->>'bodySha256' WHERE b.media_type='application/pdf' ORDER BY r.j->>'lrlId' LIMIT 25",[FINANCE_RECEIPT_TYPE,sourceRun])).rows;
      if((expansionMode?rows.length<1||rows.length>MAX_REPORTS:rows.length!==MAX_REPORTS)||rows.reduce((n,r)=>n+r.pdf_body.length,0)>MAX_TOTAL)throw Error('Finance detail source inventory mismatch');
      let expansionEventSha:string|null=null;
      if(expansionMode){
        recoveryStage='expansion_ledger_binding';
        const events=(await client.query<{sha256:string;body:Buffer}>("SELECT sha256,body FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'runId'=$2 LIMIT 2",[FINANCE_EVENT_TYPE,sourceRun])).rows;
        if(events.length!==1||hash(events[0].body)!==events[0].sha256)throw Error('Finance expansion collection event missing or invalid');
        const ledger=JSON.parse(events[0].body.toString('utf8'));
        const receipts=rows.map(row=>{
          const value=JSON.parse(row.review_body.toString('utf8'));
          if(hash(row.review_body)!==row.review_sha)throw Error('Finance expansion review digest mismatch');
          return {sha:row.review_sha,value,sourceVerified:hash(row.pdf_body)===row.pdf_sha&&value.sourceReceipt?.bodySha256===row.pdf_sha&&value.sourceReceipt?.bodyBytes===row.pdf_body.length};
        });
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const history=financeCollectionHistory(roster,receipts,[{sha:events[0].sha256,value:ledger}],day);
        if(history.archived.size!==rows.length||history.committedBatches!==1||ledger.summary?.verifiedReceiptTotals!==rows.length)throw Error('Finance expansion receipt verification incomplete');
        const ids=receipts.map(r=>r.value.lrlId);
        const duplicates=(await client.query<{n:number}>("SELECT count(*)::int AS n FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'lrlId'=ANY($2::text[]) AND convert_from(body,'UTF8')::jsonb->>'runId' IS DISTINCT FROM $3",[FINANCE_RECEIPT_TYPE,ids,sourceRun])).rows[0]?.n;
        const existingDetails=(await client.query<{n:number}>("SELECT count(*)::int AS n FROM evidence_content_blobs WHERE media_type=ANY($1::text[]) AND (convert_from(body,'UTF8')::jsonb->>'sourceRunId'=$2 OR convert_from(body,'UTF8')::jsonb->>'lrlId'=ANY($3::text[]))",[[FINANCE_DETAIL_TYPE,FINANCE_DETAIL_V2_TYPE],sourceRun,ids])).rows[0]?.n;
        if(duplicates!==0||existingDetails!==0)throw Error('Finance expansion already reviewed or duplicate member');
        expansionEventSha=events[0].sha256;
      }
      recoveryStage='prior_validation_inventory';
      const previous=(await client.query<{n:number}>("SELECT count(*)::int AS n FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'sourceRunId'=$2",[FINANCE_DETAIL_TYPE,sourceRun])).rows[0]?.n;
      if(previous!==((layoutMode||v2Mode)?MAX_REPORTS:0))throw Error('Finance prior validation inventory mismatch');
      const priorById=new Map<string,{sha:string;j:any}>();
      if(v2Mode){
        const prior=(await client.query<{sha256:string;body:Buffer}>("SELECT sha256,body FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'sourceRunId'=$2 LIMIT 25",[FINANCE_DETAIL_TYPE,sourceRun])).rows;
        const existingV2=(await client.query<{n:number}>("SELECT count(*)::int AS n FROM evidence_content_blobs WHERE media_type=$1 AND convert_from(body,'UTF8')::jsonb->>'sourceRunId'=$2",[FINANCE_DETAIL_V2_TYPE,sourceRun])).rows[0]?.n;
        if(prior.length!==MAX_REPORTS||existingV2!==0)throw Error('Finance V2 inventory mismatch or already committed');
        for(const p of prior){
          if(hash(p.body)!==p.sha256)throw Error('Prior finance validation hash mismatch');
          const j=JSON.parse(p.body.toString('utf8'));
          if(typeof j.lrlId!=='string'||priorById.has(j.lrlId)||j.schemaVersion!=='2027-preseason-finance-summary-validation-v1'||
            j.session!=='2027-2028'||j.rosterSha256!==FINANCE_ROSTER_SHA||j.rosterStatus!=='projected_not_activation_verified'||
            j.sourceRunId!==sourceRun||j.runId!=='46044058595:1'||j.rawBodyRetained!==true||j.servingEligible!==false||
            j.canonicalWriteAllowed!==false||j.modelWeight!==0||j.reviewRequired!==true)throw Error('Invalid prior finance validation');
          priorById.set(j.lrlId,{sha:p.sha256,j});
        }
      }
      const layoutShapes=new Map<string,number>();
      const ids=new Set<string>();let incoming=0,returning=0;const summaries:Array<ReturnType<typeof recoverFinanceSummary>>=[];
      for(const row of rows){
        if(Date.now()-started>120000)throw Error('Finance detail review time bound');
        recoveryStage='original_review_binding';
        const r=JSON.parse(row.review_body.toString('utf8')) as Review,p=r.sourceReceipt;
        const member=roster.find(m=>m.lrlId===r.lrlId&&m.seat===r.seat&&m.cohort===r.cohort);
        if(!member||ids.has(r.lrlId)||r.schemaVersion!=='2027-preseason-finance-report-review-v1'||r.session!=='2027-2028'||r.rosterSha256!==FINANCE_ROSTER_SHA||r.rosterStatus!=='projected_not_activation_verified'||r.runId!==sourceRun||r.rawBodyRetained!==true||r.servingEligible!==false||r.canonicalWriteAllowed!==false||r.modelWeight!==0||r.registrationNumber!==r.reference.registrationNumber||p.bodySha256!==row.pdf_sha||p.bodyBytes!==row.pdf_body.length||p.bodyBytes<300||p.bodyBytes>4*1024*1024||row.pdf_body.subarray(0,5).toString('ascii')!=='%PDF-'||hash(row.review_body)!==row.review_sha||hash(row.pdf_body)!==row.pdf_sha||r.summary.totalReceiptsCents===null)throw Error('Finance original review binding failed');
        ids.add(r.lrlId);if(r.cohort==='incoming')incoming++;else returning++;
        let dir:string|undefined;
        try{
          recoveryStage='pdf_extraction';
          dir=mkdtempSync(join(tmpdir(),'votepredict-finance-detail-'));const file=join(dir,'report.pdf');writeFileSync(file,row.pdf_body,{mode:0o600});
          const text=execFileSync('pdftotext',['-f','1','-l','6','-layout',file,'-'],{encoding:'utf8',timeout:10000,maxBuffer:1500000,stdio:['ignore','pipe','ignore']});
          recoveryStage='prior_receipt_reproduction';
          const recheck=reviewFinanceSummary(text.replace(/\f/g,'\n'),r.reference,p.observedAt);
          if(recheck.totalReceiptsCents!==r.summary.totalReceiptsCents||recheck.boardReceivedOn!==r.summary.boardReceivedOn||recheck.coverageEndOn!==r.summary.coverageEndOn||recheck.reportUrl!==r.summary.reportUrl)throw Error('Finance prior summary reproduction failed');
          recoveryStage='prior_v1_binding';
          const previousValidation=priorById.get(r.lrlId);
          if(v2Mode&&(!previousValidation||previousValidation.j.priorReviewSha256!==row.review_sha||
            previousValidation.j.sourceBodySha256!==row.pdf_sha||previousValidation.j.sourceBodyBytes!==p.bodyBytes||
            previousValidation.j.seat!==r.seat||previousValidation.j.cohort!==r.cohort||
            previousValidation.j.registrationNumber!==r.registrationNumber||previousValidation.j.observedAt!==p.observedAt||
            !isDeepStrictEqual(previousValidation.j.reference,r.reference)||
            previousValidation.j.detail?.totalReceiptsCents!==r.summary.totalReceiptsCents))throw Error('Finance V2 prior validation binding failed');
          recoveryStage='parse_summary';
          const detail=useV2?recoverFinanceSummaryV2(text,r.summary.totalReceiptsCents):recoverFinanceSummary(text,r.summary.totalReceiptsCents);
          if(layoutMode){
            const key=JSON.stringify(diagnoseFinanceLayout(text));
            layoutShapes.set(key,(layoutShapes.get(key)??0)+1);
            summaries.push(detail);
            checkedReports++;
            continue;
          }
          // Append new interpretation linked to original PDF and prior
          // receipt. Never modify old review or fabricate an absent amount.
          recoveryStage='append_validation';
          await storeBlob(client,Buffer.from(JSON.stringify({schemaVersion:useV2?'2027-preseason-finance-summary-validation-v2':'2027-preseason-finance-summary-validation-v1',...(v2Mode?{previousValidationSha256:previousValidation!.sha,layoutDiagnosticRun:'46060153487:1'}:expansionMode?{previousValidationSha256:null,sourceCollectionEventSha256:expansionEventSha,layoutDiagnosticRun:'46060153487:1',validationLineage:'direct_from_archived_report_review'}:{}),session:'2027-2028',rosterSha256:FINANCE_ROSTER_SHA,rosterStatus:'projected_not_activation_verified',sourceRunId:sourceRun,runId:env.GITHUB_RUN_ID+':1',lrlId:r.lrlId,seat:r.seat,cohort:r.cohort,registrationNumber:r.registrationNumber,reference:r.reference,priorReviewSha256:row.review_sha,sourceBodySha256:row.pdf_sha,sourceBodyBytes:p.bodyBytes,observedAt:p.observedAt,reviewedAt:new Date().toISOString(),detail,rawBodyRetained:true,availableBeforeObservationProved:false,servingEligible:false,canonicalWriteAllowed:false,modelWeight:0,reviewRequired:true})),useV2?FINANCE_DETAIL_V2_TYPE:FINANCE_DETAIL_TYPE,true);
          summaries.push(detail);
          checkedReports++;
        }finally{if(dir)rmSync(dir,{recursive:true,force:true});}
      }
      recoveryStage='cohort_check';
      if(expansionMode?incoming>FINANCE_LIMITS.incoming||returning>FINANCE_LIMITS.returning||incoming+returning!==rows.length:incoming!==12||returning!==12)throw Error('Finance review cohort mismatch');
      if(layoutMode)return {mode:'layout_diagnostic',reports:summaries.length,incoming,returning,layoutShapes:[...layoutShapes].map(([shape,count])=>({shape:JSON.parse(shape),count})),newSourceDownloads:0,validationWrites:0,canonicalWrites:0,modelChanges:0};
      recoveryStage='additional_field_check';
      const diagnosticShapes=summaries.reduce((a,x)=>{const k=JSON.stringify(x.diagnostics);a[k]=(a[k]??0)+1;return a;},{} as Record<string,number>);
      if(useV2&&!summaries.some(s=>s.totalDisbursementsCents!==null||s.endingCashBalanceCents!==null||s.reportedOutstandingLoanBalanceCents!==null)){
        // Numeric counts and boolean parser diagnostics only. No identities,
        // amounts, raw PDF text, paths, SQL, or provider errors in the log.
        console.log('CFB_FINANCE_V2_ROLLBACK_DIAGNOSTICS '+JSON.stringify({reports:summaries.length,diagnosticShapes}));
        throw Error('Finance V2 recovered no additional fields');
      }
      recoveryStage='restricted_commit';
      const count=(fn:(d:ReturnType<typeof recoverFinanceSummary>)=>boolean)=>summaries.filter(fn).length;
      return {mode:expansionMode?'expansion_observed_layout_v2':v2Mode?'observed_layout_v2':'recovery_v1',sourceRunId:sourceRun,validationWrites:summaries.length,reports:summaries.length,incoming,returning,receiptsVerified:count(x=>x.totalReceiptsCents!==null),disbursementsVerified:count(x=>x.totalDisbursementsCents!==null),cashBalanceVerified:count(x=>x.endingCashBalanceCents!==null),loanBalanceObserved:count(x=>x.reportedOutstandingLoanBalanceCents!==null),diagnosticShapes,newSourceDownloads:0,canonicalWrites:0,modelChanges:0};
    });
    console.log('CFB_EXACT_ORIGINAL_SUMMARY '+JSON.stringify(result));
  }finally{await db.end();}
}
main().catch(()=>{console.error('CFB_FINANCE_RECOVERY_FAILED '+JSON.stringify({stage:recoveryStage,checkedReports}));process.exitCode=1;});
