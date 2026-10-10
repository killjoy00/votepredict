/**
 * Official Minnesota Legislative Reference Library Senate service directory.
 * This is the public LRL member-service directory, not election candidates.
 * Guardrails: only individuals with independently published Senate service;
 * preserve a verified run/retrieval timestamp; never fabricate original text
 * publication dates from an election year or current source page metadata.
 *
 * Source: https://www.lrl.mn.gov/legdb/senate_dir
 */
import {createHash} from 'node:crypto';
import {strictCandidateKey} from './sos-senate-historical-candidate-inventory.js';

export const OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL=
  'https://www.lrl.mn.gov/legdb/senate_dir' as const;
export const SENATOR_ONLY_COVERAGE_OBSERVATION_DATE='2026-10-10' as const;
export type SenateServedRecord={
  officialName:string;
  officialNameRaw:string;
  officialSourceUrl:typeof OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL;
  senateServiceTerms:Array<{startsYear:number;endsYear:number|null;district:string}>;
};
export type AuditedOfficialSenateDirectory={
  schema:'mn-lrl-official-senate-ever-served-directory-v1';
  source:{
    url:typeof OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL;
    observedAt:string;
    sourceBytesSha256:string;
    sourceBytesLength:number;
    originalHistoricDateForDisplayedDirectoryEstablished:false;
    directoryIsSenatorServiceNotCandidateFiling:true;
  };
  senators:SenateServedRecord[];
};
const normalizeSpace=(s:string)=>s.replace(/\s+/g,' ').trim();
function htmlText(raw:string):string{
  return normalizeSpace(raw
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#(?:x([a-f0-9]{1,6})|(\d{1,7}));/gi,(_,h,d)=>{
      const cp=Number.parseInt(h??d,h?16:10);
      return cp>0&&cp<0x110000&&!(cp>=0xd800&&cp<=0xdfff)
        ?String.fromCodePoint(cp):' ';
    }));
}
function firstLastOfOfficialDirectory(inverted:string):string{
  const raw=inverted.split(/\s+-\s+"/)[0].trim();
  const cleaned=raw.replace(/["()]/g,' ').replace(/\s+/g,' ').trim();
  const m=cleaned.match(/^([^,]+),\s*(.+)$/);
  return normalizeSpace(m?m[2]+' '+m[1]:cleaned);
}
export function parseOfficialMnSenateServiceDirectory(html:Uint8Array,observedAt:string):
  AuditedOfficialSenateDirectory {
  const observed=new Date(observedAt);
  if(!Number.isFinite(observed.getTime())||observed.toISOString()!==observedAt
    ||observed.getTime()<Date.parse('2026-10-10T00:00:00Z')
    ||observed.getTime()>Date.now()+60_000)
    throw Error('Source retrieval timestamp not valid observed UTC time');
  if(html.byteLength<9000||html.byteLength>5*1024*1024)
    throw Error('Incomplete or oversized original official Senate directory HTML');
  const body=Buffer.from(html).toString('utf8');
  if(!body.includes('State Senators')||!body.includes('Service Information'))
    throw Error('Missing Minnesota official Senate service directory heading');
  const rows:SenateServedRecord[]=[];
  for(const match of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>htmlText(x[1]));
    if(cells.length<3)continue;
    const rawName=cells[0];
    const service=cells.slice(1).join('; ');
    if(!rawName||!service.includes('Senate'))continue;
    const terms:SenateServedRecord['senateServiceTerms']=[];
    const pattern=/Senate\s+(\d{4})\s*[-–]\s*(\d{2,4}|Present)\s*\(District\s+0?(\d{1,2})\)/gi;
    for(const t of service.matchAll(pattern)){
      const start=Number(t[1]);
      let end:number|null=null;
      if(t[2].toLowerCase()!=='present'){
        const n=Number(t[2]);end=t[2].length===2?Math.floor(start/100)*100+n:n;
      }
      const dist=String(Number(t[3]));
      // The historical directory includes 19th-century territorial
      // jurisdictions with obsolete/non-modern district numbering. Those
      // terms do not help a 2020-26 membership audit, so skip rather than
      // incorrectly fail the whole original source.
      if(start<2010||start>2026||end!==null&&(end<2020||end<start||end>2026)
        ||Number(dist)<1||Number(dist)>67)continue;
      terms.push({startsYear:start,endsYear:end,district:dist});
    }
    if(!terms.length)continue;
    rows.push({
      officialName:firstLastOfOfficialDirectory(rawName),
      officialNameRaw:rawName,
      officialSourceUrl:OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
      senateServiceTerms:terms,
    });
  }
  if(rows.length<65||rows.length>500)
    throw Error('Official historical Senate directory response missing expected historic table rows');
  if(rows.some(row=>!strictCandidateKey(row.officialName)))
    throw Error('Official Senate directory contains unusable person name');
  return{
    schema:'mn-lrl-official-senate-ever-served-directory-v1',
    source:{
      url:OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,observedAt,
      sourceBytesSha256:createHash('sha256').update(html).digest('hex'),
      sourceBytesLength:html.byteLength,
      originalHistoricDateForDisplayedDirectoryEstablished:false,
      directoryIsSenatorServiceNotCandidateFiling:true,
    },
    senators:rows,
  };
}
function nameParts(name:string){
  const x=strictCandidateKey(name).replace(/\b(jr|sr|ii|iii|iv)\b/g,' ')
    .replace(/\s+/g,' ').trim().split(' ');
  return {first:x[0]??'',last:x.at(-1)??''};
}
/** A conservative person match: first and last names plus Senate district
 * AND overlapping service years. Distinct first-name spellings (Jen/Jennifer)
 * require a separately audited exact alias, never generic fuzzy matching.
 */
export function validateActualSenateServiceForElection(
 official:AuditedOfficialSenateDirectory,
 candidateName:string,district:string,electionYear:number,
):{status:'verified_senate_service'|'not_yet_verified';officialName:string|null;term:string|null}{
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
   ||official.source.url!==OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL
   ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
   ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
   ||!/^[0-9a-f]{64}$/.test(official.source.sourceBytesSha256)
   ||!Number.isFinite(Date.parse(official.source.observedAt)))
   throw Error('Senate service directory not authenticated with an observed date');
 if(!/^\d{1,2}$/.test(district)||!Number.isInteger(electionYear)
   ||!['2020','2022','2024','2025'].includes(String(electionYear)))
   throw Error('Unknown candidate-election senator-service window');
 const year=electionYear===2020?2021:electionYear===2022?2023:2025;
 const target=nameParts(candidateName);
 const matches=official.senators.filter(row=>{
   const p=nameParts(row.officialName);
   return p.first===target.first&&p.last===target.last
     &&row.senateServiceTerms.some(term=>
       term.district===district
       &&term.startsYear<=year
       &&(term.endsYear===null||term.endsYear>=year));
 });
 if(matches.length!==1)
   return {status:'not_yet_verified',officialName:null,term:null};
 const row=matches[0];
 const term=row.senateServiceTerms.find(t=>t.district===district
   &&t.startsYear<=year&&(t.endsYear===null||t.endsYear>=year))!;
 return {status:'verified_senate_service',officialName:row.officialName,
   term:term.startsYear+'-'+(term.endsYear??'Present')+' SD'+term.district};
}
/** A candidate who lost earlier but *ever* later served is eligible for
 * research only once independently matching a later recorded Senate term.
 * Unlike winner-to-term joins, no district continuity is required here.
 */
export function validateCandidateEverActuallyServed(
 official:AuditedOfficialSenateDirectory,candidateName:string,
):boolean{
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1')
   throw Error('Unverified Minnesota LRL Senate service directory');
 const target=nameParts(candidateName);
 return official.senators.some(row=>{
  const p=nameParts(row.officialName);
  return p.first===target.first&&p.last===target.last
    &&row.senateServiceTerms.length>0;
 });
}
