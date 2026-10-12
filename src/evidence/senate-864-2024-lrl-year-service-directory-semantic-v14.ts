/**
 * #864: bounded original LRL Senate PUBLIC service-directory verification.
 * The 2026-observed government directory contains historical 2024 year-level
 * service, NOT independent 2024-02 hearing-day service proof. An independent keyless job authenticates the complete raw body and
 * a canonical SHA over exactly the 2024 service-year names, terms and districts.
 * Another complete original may differ in unrelated raw HTML bytes; the
 * protected process must match the exact same 2024 service facts. Never output the directory names, rows or
 * missing original vote person's name.
 */
import {createHash} from 'node:crypto';
import {parseOfficialMnSenateServiceDirectory,OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL} from
 './senate-official-ever-served-directory.js';
import {canonicalLrl2024SenateServiceProjection} from
 './senate-864-lrl-2024-service-semantic-v14.js';
const DIRECTORY=OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL;
export const ORIGINAL_864_LRL_2024_DIRECTORY_URL=DIRECTORY;
const MAX_BYTES=5*1024*1024;
export type OriginalSenate2024YearCandidate={officialName:string;district:string};
export async function acquireOriginalLrl2024SenateYearServiceSemanticV14(
 expectedSemanticSha?:string,sourceFetch:typeof fetch=fetch,
){
 if(expectedSemanticSha!==undefined&&!/^[0-9a-f]{64}$/.test(expectedSemanticSha))
  throw Error('Original LRL 2024 service-year projection SHA gate malformed');
 const res=await sourceFetch(DIRECTORY,{
  redirect:'manual',signal:AbortSignal.timeout(18_000),
  headers:{accept:'text/html',
   'user-agent':'VotePredict/2.0 issue-864-public-Senate-service-audit'},
 });
 const effective=new URL(res.url);
 if(res.status!==200||effective.protocol!=='https:'||
  effective.hostname!=='www.lrl.mn.gov'||
  effective.pathname.toLowerCase().replace(/\/$/,'')!=='/legdb/senate_dir'||
  effective.search||effective.hash||
  !/text\/html/i.test(res.headers.get('content-type')??''))
  throw Error('Original LRL public directory HTTP or provenance HOLD');
 const advertised=res.headers.get('content-length');
 if(advertised&&(!/^[0-9]+$/.test(advertised)||Number(advertised)>MAX_BYTES))
  throw Error('Original official directory exceeds advertised byte bound');
 const reader=res.body?.getReader();
 if(!reader)throw Error('Official directory no body stream');
 const pieces:Uint8Array[]=[];let total=0;
 try{
  for(;;){
   const chunk=await reader.read();
   if(chunk.done)break;
   total+=chunk.value.byteLength;
   if(total>MAX_BYTES)throw Error('Original service source exceeds byte limit');
   pieces.push(chunk.value);
  }
 }finally{reader.releaseLock()}
 if(total<9_000)throw Error('Incomplete official Senate directory original');
 const bytes=Buffer.concat(pieces,total);
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const parsed=parseOfficialMnSenateServiceDirectory(bytes,new Date().toISOString());
 if(parsed.source.url!==DIRECTORY||parsed.source.sourceBytesSha256!==sha256||
  parsed.source.originalHistoricDateForDisplayedDirectoryEstablished!==false||
  parsed.source.directoryIsSenatorServiceNotCandidateFiling!==true)
  throw Error('Original LRL directory provenance changed');
 const year2024Projection=canonicalLrl2024SenateServiceProjection(parsed);
 if(expectedSemanticSha&&
    year2024Projection.immutableServiceProjectionSha256!==expectedSemanticSha)
  throw Error('Official 2024 Senate service-year records changed across source originals');
 const selected=parsed.senators.filter(row=>row.senateServiceTerms.some(t=>
  t.startsYear<=2024&&(t.endsYear===null||t.endsYear>=2024)));
 const candidates=selected.map(row=>({
  officialName:row.officialName,
  district:row.senateServiceTerms.filter(t=>
    t.startsYear<=2024&&(t.endsYear===null||t.endsYear>=2024))[0]!.district,
 }));
 if(candidates.length<67||candidates.length>90||
  candidates.some(x=>!x.officialName||!x.district||
   !/^(?:[1-9]|[1-5][0-9]|6[0-7])$/.test(x.district))||
  new Set(candidates.map(x=>x.officialName)).size!==candidates.length)
  throw Error('Original LRL year-2024 service roster incomplete or duplicated');
 if(year2024Projection.named2024YearSenatePersons!==candidates.length)
  throw Error('Official 2024 year roster and semantic digest source mismatch');
 return {rawOriginalSha256:sha256,
  semantic2024ServiceSha256:year2024Projection.immutableServiceProjectionSha256,
  bytes:total,observedAt:parsed.source.observedAt,candidates,
  sameRawOriginalAcquisitionProven:false as const,
  independentExactHearingDayProven:false as const,
  contemporary2024OriginalSourceProven:false as const};
}
