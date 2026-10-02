import {
  parseCfbReportPdfAvailability,
  parseCfbReportViewerReferences,
  type CfbReportViewerReference,
} from '../src/evidence/cfb-report-pdf-proof.js';
import { fetchCfbReportViewerText } from '../src/evidence/cfb-current-report-acquisition.js';

const ORIGIN='https://register.cfb.mn.gov';
const VIEWER_BASE=ORIGIN+'/reports-and-data/viewers/campaign-finance/political-committee-fund';
const API_URL=VIEWER_BASE+'/api';
const TARGETS=[
  {registrationNumber:'40712',segmentEndYear:2026,label:'Laborers District Council MN & ND Pol Fund'},
  {registrationNumber:'30703',segmentEndYear:2024,label:'Faith in Minnesota Fund'},
  {registrationNumber:'30558',segmentEndYear:2024,label:'Education Minn PAC'},
  {registrationNumber:'40742',segmentEndYear:2022,label:'Freedom Club State PAC'},
] as const;
const PERIOD_PRIORITY=['A','B','YE','C','D','E'] as const;
const MAX_REPORTS_PER_TARGET=3;

function safe(error:unknown){
  return (error instanceof Error?(error.stack??error.message):String(error)).slice(0,1200);
}
function reportYear(reference:CfbReportViewerReference){
  if(!/^\d{1,2}$/.test(reference.year))return null;
  return 2000+Number(reference.year);
}
async function viewerSession(registrationNumber:string,segmentEndYear:number){
  const referer=VIEWER_BASE+'/'+registrationNumber+'/'+segmentEndYear+'/';
  const response=await fetch(referer,{
    headers:{'user-agent':'VotePredict/2.0 issue-514-ie-report-body-proof'},
    redirect:'follow',
    signal:AbortSignal.timeout(30_000),
  });
  const finalUrl=new URL(response.url);
  if(finalUrl.protocol!=='https:'||finalUrl.origin!==ORIGIN)throw new Error('Committee/fund viewer redirected off official CFB origin');
  if(!response.ok)throw new Error('Committee/fund viewer HTTP '+response.status);
  await response.arrayBuffer();
  const headers=response.headers as Headers&{getSetCookie?:()=>string[]};
  const setCookies=typeof headers.getSetCookie==='function'
    ? headers.getSetCookie()
    : [response.headers.get('set-cookie')??''].filter(Boolean);
  return {
    referer:response.url,
    cookie:setCookies.map(value=>value.split(';',1)[0]?.trim()).filter(Boolean).join('; '),
  };
}
function reportsTabForm(registrationNumber:string,segmentEndYear:number){
  const params=new URLSearchParams();
  params.set('id',registrationNumber);
  params.set('year',String(segmentEndYear));
  params.set('year_data[ElectionSegmentEndDate]',String(segmentEndYear));
  params.set('year_data[ElectionSegmentStartDate]',String(segmentEndYear-1));
  params.set('tabname','reports_data');
  return params;
}
async function fetchReferences(registrationNumber:string,segmentEndYear:number){
  const session=await viewerSession(registrationNumber,segmentEndYear);
  const response=await fetch(API_URL,{
    method:'POST',
    headers:{
      'user-agent':'VotePredict/2.0 issue-514-ie-report-body-proof',
      accept:'application/json,text/plain;q=0.8,*/*;q=0.1',
      'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
      referer:session.referer,
      origin:ORIGIN,
      'x-requested-with':'XMLHttpRequest',
      ...(session.cookie?{cookie:session.cookie}:{}),
    },
    body:reportsTabForm(registrationNumber,segmentEndYear).toString(),
    redirect:'follow',
    signal:AbortSignal.timeout(30_000),
  });
  const finalUrl=new URL(response.url);
  if(finalUrl.protocol!=='https:'||finalUrl.origin!==ORIGIN)throw new Error('Committee/fund API redirected off official CFB origin');
  if(!response.ok)throw new Error('Committee/fund API HTTP '+response.status);
  const text=await response.text();
  if(text.length>8_000_000)throw new Error('Committee/fund API response exceeded 8 MB');
  const payload=JSON.parse(text) as unknown;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Committee/fund API response was not an object');
  const tabcontent=(payload as Record<string,unknown>).tabcontent;
  if(typeof tabcontent!=='string')throw new Error('Committee/fund API response missing tabcontent');
  return parseCfbReportViewerReferences(segmentEndYear,registrationNumber,tabcontent)
    .filter(reference=>reportYear(reference)===segmentEndYear);
}
function selectReferences(references:readonly CfbReportViewerReference[]){
  const nonAmendments=references.filter(reference=>reference.amendment===0);
  return [...nonAmendments]
    .sort((left,right)=>{
      const li=PERIOD_PRIORITY.indexOf(left.period as typeof PERIOD_PRIORITY[number]);
      const ri=PERIOD_PRIORITY.indexOf(right.period as typeof PERIOD_PRIORITY[number]);
      const l=li<0?999:li;
      const r=ri<0?999:ri;
      return l-r||left.reportName.localeCompare(right.reportName);
    })
    .slice(0,MAX_REPORTS_PER_TARGET);
}

async function main(){
  const targets=[];
  for(const target of TARGETS){
    try{
      const references=await fetchReferences(target.registrationNumber,target.segmentEndYear);
      const selected=selectReferences(references);
      const reports=[];
      for(const reference of selected){
        try{
          const fetched=await fetchCfbReportViewerText(reference);
          const proof=parseCfbReportPdfAvailability(reference,fetched.text);
          reports.push({
            reportName:reference.reportName,
            period:reference.period,
            amendment:reference.amendment,
            fetched:true,
            bytes:fetched.bytes,
            contentSha256:fetched.contentSha256,
            sourceUrl:fetched.sourceUrl,
            proof:proof?{
              filedOn:proof.filedOn,
              coverageStartOn:proof.window.coverageStartOn,
              coverageEndOn:proof.window.coverageEndOn,
              availableOn:proof.window.availableOn,
              proofKind:proof.window.proofKind,
              proofUrl:proof.window.proofUrl,
            }:null,
            failure:proof?null:'Report PDF lacked required coverage/received/registration proof',
          });
        }catch(error){
          reports.push({
            reportName:reference.reportName,
            period:reference.period,
            amendment:reference.amendment,
            fetched:false,
            failure:safe(error),
          });
        }
      }
      targets.push({
        ...target,
        targetYearReferences:references.length,
        selectedReports:selected.length,
        provenReports:reports.filter(report=>report.proof).length,
        reports,
        failure:null,
      });
    }catch(error){
      targets.push({
        ...target,
        targetYearReferences:0,
        selectedReports:0,
        provenReports:0,
        reports:[],
        failure:safe(error),
      });
    }
  }

  console.log(JSON.stringify({
    cfbIndependentExpenditureHistoricalReportBodyProofProbe:{
      targets,
      totals:{
        selectedReports:targets.reduce((sum,target)=>sum+target.selectedReports,0),
        provenReports:targets.reduce((sum,target)=>sum+target.provenReports,0),
        targetFailures:targets.filter(target=>target.failure).length,
        reportFailures:targets.reduce((sum,target)=>sum+target.reports.filter(report=>report.failure).length,0),
      },
      policy:{
        readOnly:true,
        officialCfbOnly:true,
        maxReportsPerTarget:MAX_REPORTS_PER_TARGET,
        reportTextLogged:false,
        transactionRowsInspected:false,
        databaseAccess:false,
        evidenceWrites:false,
        historicalEligibilityChanged:false,
        transactionDateIsAvailability:false,
        modelWeight:0,
        servingChanged:false,
        productionAction:'none',
      },
    },
  },null,2));
}
main().catch(error=>{console.error(safe(error));process.exitCode=1;});
