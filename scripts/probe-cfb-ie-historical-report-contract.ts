import { parseCfbReportViewerReferences } from '../src/evidence/cfb-report-pdf-proof.js';

const ORIGIN='https://register.cfb.mn.gov';
const VIEWER_BASE=ORIGIN+'/reports-and-data/viewers/campaign-finance/political-committee-fund';
const API_URL=VIEWER_BASE+'/api';

const TARGETS=[
  {registrationNumber:'40712',segmentEndYear:2026,label:'Laborers District Council MN & ND Pol Fund'},
  {registrationNumber:'30703',segmentEndYear:2024,label:'Faith in Minnesota Fund'},
  {registrationNumber:'30558',segmentEndYear:2024,label:'Education Minn PAC'},
  {registrationNumber:'40742',segmentEndYear:2022,label:'Freedom Club State PAC'},
] as const;

function safeError(error:unknown){
  return (error instanceof Error?(error.stack??error.message):String(error)).slice(0,1200);
}
function sameOrigin(url:string){
  const parsed=new URL(url);
  return parsed.protocol==='https:'&&parsed.origin===ORIGIN;
}
async function fetchPage(url:string){
  const response=await fetch(url,{
    headers:{'user-agent':'VotePredict/2.0 issue-514-ie-historical-report-contract-probe'},
    redirect:'follow',
    signal:AbortSignal.timeout(30_000),
  });
  const finalUrl=response.url;
  const text=await response.text();
  if(!sameOrigin(finalUrl))throw new Error('Viewer page redirected off official CFB origin');
  return {status:response.status,ok:response.ok,finalUrl,text:text.slice(0,4_000_000),contentType:response.headers.get('content-type')};
}
function setCookies(response:Response):string{
  const headers=response.headers as Headers&{getSetCookie?:()=>string[]};
  const values=typeof headers.getSetCookie==='function'
    ? headers.getSetCookie()
    : [response.headers.get('set-cookie')??''].filter(Boolean);
  return values.map(value=>value.split(';',1)[0]?.trim()).filter(Boolean).join('; ');
}
async function viewerSession(url:string){
  const response=await fetch(url,{
    headers:{'user-agent':'VotePredict/2.0 issue-514-ie-historical-report-contract-probe'},
    redirect:'follow',
    signal:AbortSignal.timeout(30_000),
  });
  if(!sameOrigin(response.url))throw new Error('Viewer session redirected off official CFB origin');
  const text=await response.text();
  if(text.length>4_000_000)throw new Error('Viewer page exceeded 4 MB');
  return {
    ok:response.ok,
    status:response.status,
    finalUrl:response.url,
    cookie:setCookies(response),
    html:text,
  };
}
function queryParams(entries:readonly (readonly [string,string])[]){
  const params=new URLSearchParams();
  for(const [key,value] of entries)params.append(key,value);
  return params;
}
function formCandidates(registrationNumber:string,segmentEndYear:number){
  const base=[
    ['id',registrationNumber],
    ['year',String(segmentEndYear)],
    ['tabname','reports_data'],
  ] as const;
  const segment=[
    ...base,
    ['year_data[ElectionSegmentEndDate]',String(segmentEndYear)] as const,
    ['year_data[ElectionSegmentStartDate]',String(segmentEndYear-1)] as const,
  ];
  const yearOnly=[...base];
  const filingYear=[
    ...base,
    ['year_data[FilingYear]',String(segmentEndYear)] as const,
  ];
  return [
    {name:'election-segment',params:queryParams(segment)},
    {name:'year-only',params:queryParams(yearOnly)},
    {name:'filing-year',params:queryParams(filingYear)},
  ];
}
async function postApi(input:{
  registrationNumber:string;
  segmentEndYear:number;
  referer:string;
  cookie:string;
  formName:string;
  body:URLSearchParams;
}){
  const response=await fetch(API_URL,{
    method:'POST',
    headers:{
      'user-agent':'VotePredict/2.0 issue-514-ie-historical-report-contract-probe',
      accept:'application/json,text/plain;q=0.8,*/*;q=0.1',
      'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
      referer:input.referer,
      origin:ORIGIN,
      'x-requested-with':'XMLHttpRequest',
      ...(input.cookie?{cookie:input.cookie}:{}),
    },
    body:input.body.toString(),
    redirect:'follow',
    signal:AbortSignal.timeout(30_000),
  });
  if(!sameOrigin(response.url))throw new Error('Committee/fund API redirected off official CFB origin');
  const text=await response.text();
  if(text.length>8_000_000)throw new Error('Committee/fund API response exceeded 8 MB');
  let parsed:unknown=null;
  try{parsed=JSON.parse(text);}catch{}
  const object=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)
    ? parsed as Record<string,unknown>
    : null;
  const tabcontent=typeof object?.tabcontent==='string'?object.tabcontent:null;
  let references:ReturnType<typeof parseCfbReportViewerReferences>=[];
  let parseError:string|null=null;
  if(tabcontent){
    try{
      references=parseCfbReportViewerReferences(
        input.segmentEndYear,
        input.registrationNumber,
        tabcontent,
      );
    }catch(error){
      parseError=safeError(error);
    }
  }
  return {
    formName:input.formName,
    status:response.status,
    ok:response.ok,
    finalUrl:response.url,
    contentType:response.headers.get('content-type'),
    responseBytes:Buffer.byteLength(text),
    jsonObject:Boolean(object),
    topLevelKeys:object?Object.keys(object).slice(0,30):[],
    tabcontentPresent:Boolean(tabcontent),
    tabcontentLength:tabcontent?.length??0,
    references:references.map(reference=>({
      reportName:reference.reportName,
      year:reference.year,
      type:reference.type,
      period:reference.period,
      se:reference.se,
      registrationNumber:reference.registrationNumber,
      amendment:reference.amendment,
    })),
    parseError,
  };
}

async function probeTarget(target:(typeof TARGETS)[number]){
  const pageCandidates=[
    VIEWER_BASE+'/'+target.registrationNumber+'/'+target.segmentEndYear+'/',
    VIEWER_BASE+'/'+target.registrationNumber+'/',
    VIEWER_BASE+'/',
  ];
  const pages=[];
  let session:null|Awaited<ReturnType<typeof viewerSession>>=null;
  for(const url of pageCandidates){
    try{
      const page=await fetchPage(url);
      pages.push({
        requestedUrl:url,
        status:page.status,
        ok:page.ok,
        finalUrl:page.finalUrl,
        contentType:page.contentType,
        htmlBytes:Buffer.byteLength(page.text),
        mentionsRegistration:page.text.includes(target.registrationNumber),
        mentionsReportsData:/reports_data/i.test(page.text),
        mentionsApi:/\/api\b/i.test(page.text),
      });
      if(!session&&page.ok){
        session=await viewerSession(url);
      }
    }catch(error){
      pages.push({requestedUrl:url,error:safeError(error)});
    }
  }
  if(!session){
    return {
      ...target,
      pages,
      apiAttempts:[],
      failure:'No same-origin official viewer page produced a usable session',
    };
  }

  const apiAttempts=[];
  for(const form of formCandidates(target.registrationNumber,target.segmentEndYear)){
    try{
      apiAttempts.push(await postApi({
        registrationNumber:target.registrationNumber,
        segmentEndYear:target.segmentEndYear,
        referer:session.finalUrl,
        cookie:session.cookie,
        formName:form.name,
        body:form.params,
      }));
    }catch(error){
      apiAttempts.push({formName:form.name,error:safeError(error)});
    }
  }
  return {
    ...target,
    pages,
    sessionPage:session.finalUrl,
    apiUrl:API_URL,
    apiAttempts,
  };
}

async function main(){
  const results=[];
  for(const target of TARGETS){
    results.push(await probeTarget(target));
  }
  console.log(JSON.stringify({
    cfbIndependentExpenditureHistoricalReportContractProbe:{
      viewerBase:VIEWER_BASE,
      apiUrl:API_URL,
      targets:results,
      policy:{
        readOnly:true,
        officialCfbOnly:true,
        reportReferencesOnly:true,
        reportBodiesFetched:false,
        databaseAccess:false,
        evidenceWrites:false,
        transactionDateIsAvailability:false,
        historicalEligibilityChanged:false,
        modelWeight:0,
        servingChanged:false,
        productionAction:'none',
      },
    },
  },null,2));
}

main().catch(error=>{
  console.error(safeError(error));
  process.exitCode=1;
});
