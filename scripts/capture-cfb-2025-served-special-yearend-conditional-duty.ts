/**
 * #864 Track B: ONE-SHOT public official source proof of the exact 2025
 * special-election year-end conditional report rule for TWO actual senators.
 * This records **only** source hashes/metadata, never original HTML/PDF bytes,
 * campaign-finance bodies, donor names or officer contact details.
 * Usage: node --import tsx scripts/capture-cfb-2025-served-special-yearend-conditional-duty.ts
 *   --output artifacts/cfb-2025-served-two-special-yearend-conditional-duty.json
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {
  parseOfficialMnSenateServiceDirectory,
  OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
} from '../src/evidence/senate-official-ever-served-directory.js';
import {
  audit2025SpecialConditionalYearEndDuties,
  SPECIAL_2025_SERVING_SENATORS_CONDITIONAL_DUTY_SCHEMA,
  type OriginalCalendar,type Original2025GeneralCalendar,
} from '../src/evidence/cfb-2025-two-served-senators-special-yearend-conditional-duty.js';
import {SERVED_2025_YE_CALENDAR}
  from '../src/evidence/cfb-2025-served-two-ordinary-year-end-originals.js';

const DIR='docs/evaluation/source-proof/';
const LRL_SOURCES=[OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL] as const;
const SD_SOURCES=[
  {district:29,url:'https://cfb.mn.gov/pdf/calendars/2025_special_election_29.pdf'},
  {district:47,url:'https://cfb.mn.gov/pdf/calendars/2025_special_election_47.pdf'},
] as const;
function safeError(err:unknown):string{
  return (err instanceof Error?err.message:'unknown original source error')
    .replace(/https?:\/\/\S+/gi,'[official source]').slice(0,220);
}
async function acquire(url:string,expectedHost:string,kind:'html'|'pdf'){
  const res=await fetch(url,{
    headers:{'user-agent':'VotePredict/2.0-2025-exact-special-calendar-conditional-audit',
      accept:kind==='pdf'?'application/pdf':'text/html'},
    redirect:'follow',signal:AbortSignal.timeout(45000),
  });
  const actual=new URL(res.url),expected=new URL(url);
  if(!res.ok||actual.protocol!=='https:'||actual.hostname!==expectedHost
    ||actual.pathname!==expected.pathname
    ||(kind==='html'&&actual.search!==expected.search))
    throw Error('Failed exact official source host/path or HTTP validation');
  const limit=kind==='pdf'?12_000_000:5_000_000;
  const sizeHeader=Number(res.headers.get('content-length'));
  if(sizeHeader>limit)throw Error('Official source exceeds byte cap');
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(bytes.byteLength<500||bytes.byteLength>limit)throw Error('Official source bytes not within bounds');
  if(kind==='pdf'&&Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-')
    throw Error('Original disclosure calendar is not a PDF');
  return{
    url,sha256:createHash('sha256').update(bytes).digest('hex'),
    bytes:bytes.byteLength,observedAt:new Date().toISOString(),data:bytes,
  };
}
async function pdfText(src:Awaited<ReturnType<typeof acquire>>){
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:src.data,CanvasFactory});
  try{return (await parser.getText()).text??'';}
  finally{await parser.destroy();}
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Required: --output artifacts/<unique>.json');
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Only a new local metadata-only artifacts JSON is permitted');
  const [lrl,swearing]=await Promise.all(LRL_SOURCES.map(x=>
    acquire(x,'www.lrl.mn.gov','html')));
  const official=parseOfficialMnSenateServiceDirectory(
    lrl.data,lrl.observedAt,swearing.data,swearing.observedAt);
  const sources=await Promise.all([
    ...SD_SOURCES.map(s=>acquire(s.url,'cfb.mn.gov','pdf')),
    acquire(SERVED_2025_YE_CALENDAR,'cfb.mn.gov','pdf'),
  ]);
  const specialCalendars:OriginalCalendar[]=[];
  for(let i=0;i<2;i++){
    const s=sources[i]!;
    specialCalendars.push({
      district:SD_SOURCES[i]!.district,url:s.url,
      sha256:s.sha256,bytes:s.bytes,observedAt:s.observedAt,
      text:await pdfText(s),
    });
  }
  const g=sources[2]!;
  const generalCalendar:Original2025GeneralCalendar={
    url:g.url,sha256:g.sha256,bytes:g.bytes,observedAt:g.observedAt,
    text:await pdfText(g),
  };
  const record=audit2025SpecialConditionalYearEndDuties({
    official,
    finalCheckpoint:JSON.parse(readFileSync(
      DIR+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json','utf8')),
    registrySnapshot:readFileSync(DIR+'cfb-2026-public-current-senate-registration-dates.psv','utf8'),
    pinned2025ViewerLedger:readFileSync(
      DIR+'cfb-2025-dated-senate-85-reference-versions.psv','utf8'),
    specialCalendars,generalCalendar,
  });
  const body={
    ...record,
    originalServiceSources:[
      {url:lrl.url,sha256:lrl.sha256,bytes:lrl.bytes,observedAt:lrl.observedAt},
      {url:swearing.url,sha256:swearing.sha256,bytes:swearing.bytes,observedAt:swearing.observedAt},
    ],
    reportingRuleIsConditionalNotUnconditionallySatisfied:true,
  };
  if(body.schemaVersion!==SPECIAL_2025_SERVING_SENATORS_CONDITIONAL_DUTY_SCHEMA)
    throw Error('Original source scope schema drift');
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(body,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({
    actualSenateMembers:body.actualSenateMemberCases.length,
    originalSpecialCalendarsWithExplicitConditionalTerminationException:
      body.sums.conditionalOriginalCalendarRulesVerified,
    independentGeneralCalendarDueOn:body.independentGeneralCalendarProof.yearEnd2025DueOn,
    retrospective2026RegistrationDates:body.actualSenateMemberCases.map(r=>({
      district:r.district,registration:r.cfbRegistrationId,
      sourceReportedDate:r.currentOctober2026CFBListReportedRegistrationOn,
      historicallyEffectiveRegistrationVerified:false,
    })),
    originalYearEndViewerReferences:2,
    actualYearEndPdfsAuthenticatedThisAudit:0,
    terminationBoxesAuthenticatedThisAudit:0,
    legalDueCount:null,historicalPublicByVerified:0,
    output,
  },null,2));
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
