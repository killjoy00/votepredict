/** #864: fixed three known actual 2021-2025 MN senators with no selected
 * firstparty historical excerpt in independently proven 95-person cohort.
 * Archived 2022 first-party site pages may be sources; a 2026 current site
 * or a 2022 guide's URL is discovery only, not archived proof. */
export const UNOBSERVED_SENATE_SITE_2022_LEADS=[
 {officialName:'Gene Dornink',host:'genedorninkforsenate.com',year:2022,cycleLimitExclusive:'20221108000000',basis:'candidate-owned campaign domain lead, old-cycle wording requires source authentication'},
 {officialName:'Matt D. Klein',host:'mattklein.org',year:2022,cycleLimitExclusive:'20221108000000',basis:'historical 2022 published state senate voter-guide domain lead'},
 {officialName:'Susan Pha',host:'susanphaforsenate.com',year:2022,cycleLimitExclusive:'20221108000000',basis:'2022 published Senate District 38 candidate questionnaire domain lead'},
] as const;
export const PROBE_ISSUES=[
 'education','healthcare','health care','environment','taxes','public safety',
 'housing','infrastructure','reproductive','jobs','small business','freedom',
 'clean energy','agriculture','climate','broadband'
] as const;
const requiredFields=['timestamp','original','mimetype','statuscode','digest','length'] as const;
export type CdxCandidate={timestamp:string,original:string,mimetype:string,statuscode:string,digest:string,length:string};
export function parseOriginalThreeSenatorCdxResponse(raw:unknown,host:string,before:string){
 if(!Array.isArray(raw)||raw.length<1||raw.length>201||
  JSON.stringify(raw[0])!==JSON.stringify([...requiredFields]))
  throw Error('Historical Wayback entire original CDX schema/row cap invalid');
 const domain=host.toLowerCase().replace(/^www\./,'');
 const found:CdxCandidate[]=[];
 for(const maybe of raw.slice(1)){
  if(!Array.isArray(maybe)||maybe.length!==6||maybe.some(x=>typeof x!=='string'))
   throw Error('Original Wayback CDX row malformed');
  const [timestamp,original,mimetype,statuscode,digest,length]=maybe as string[];
  if(!/^\d{14}$/.test(timestamp??'')||timestamp!>=before||
   statuscode!=='200'||!mimetype!.toLowerCase().includes('html')||
   !/^[A-Z2-7]{32}$/.test(digest??'')||!/^\d+$/.test(length??''))
   continue;
  let u:URL;
  try{u=new URL(original!);}catch{continue;}
  const originDomain=u.hostname.toLowerCase().replace(/^www\./,'');
  if(!['http:','https:'].includes(u.protocol)||originDomain!==domain)continue;
  if(/\.(?:jpg|jpeg|png|gif|svg|webp|css|js|woff2?|mp4|pdf|zip|ico)(?:$|\?)/i.test(u.pathname))continue;
  found.push({timestamp:timestamp!,original:original!,mimetype:mimetype!,statuscode:statuscode!,digest:digest!,length:length!});
 }
 const score=(row:CdxCandidate)=>{
  const path=new URL(row.original).pathname.toLowerCase();
  if(/\/(issues?|platform|priorit(?:y|ies)|positions?|policy|healthcare|education|taxes|values|vision)(?:\/|[.-]|$)/.test(path))return 100;
  if(/\/(about|meet|home|index|campaign)(?:\/|[.-]|$)/.test(path))return 50;
  if(/^\/(?:index\.(?:html?|php))?$/.test(path))return 30;
  if(/\/(images?|wp-content|assets|uploads|blog)\/?/.test(path))return -5;
  return 10;
 };
 found.sort((a,b)=>score(b)-score(a)||b.timestamp.localeCompare(a.timestamp));
 const seen=new Set<string>(),output:CdxCandidate[]=[];
 for(const row of found){
  const u=new URL(row.original);
  const key=u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'').toLowerCase();
  if(seen.has(key))continue;
  seen.add(key);output.push(row);
  if(output.length>=4)break;
 }
 return {allQualifyingOriginalCDXRows:found.length,selectedRows:output,
  sourceCDXCapReached:raw.length===201};
}
export function sourceYear2022CitationLimit(row:{timestamp:string},before:string){
 return /^\d{14}$/.test(row.timestamp)&&row.timestamp<before;
}
