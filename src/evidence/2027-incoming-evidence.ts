import { normalizePersonKey,type CampaignSiteFiling } from './campaign-site-discovery';
import { publicPageMentionsPerson,type PublicPage } from './public-http';
import { visibleLines } from '@/sources/minnesota/senate-questionnaire-raw';

export interface IncomingMember {
  seat:string;lrlId:string;name:string;electionName:string;party:string;sourceUrl:string;basis:string;
}
export type IncomingTarget=IncomingMember&{chamber:'house'|'senate';district:string;service:'returning'|'no_recent_service'};
export type HousingLink={candidate:string;chamber:'house'|'senate';district:string;url:string};
export const INCOMING_EVIDENCE_LIMITS=Object.freeze({maxTargets:40,maxFetches:125,maxBytesPerPage:1_500_000,maxRegistryBytes:4_000_000,maxRunBytes:24_000_000,maxRunMs:7*60_000,requestTimeoutMs:10_000});
export function selectIncomingMembers(roster:readonly IncomingMember[],prior:Readonly<Record<number,ReadonlySet<string>>>){
  if(roster.length!==201||new Set(roster.map(m=>m.seat)).size!==201||new Set(roster.map(m=>m.lrlId)).size!==201||
    roster.filter(m=>m.seat.startsWith('house:')).length!==134||roster.filter(m=>m.seat.startsWith('senate:')).length!==67)throw Error('Approved roster is not 201 unique seats and identities');
  for(const session of [92,93,94])if(!prior[session]||prior[session].size<190||prior[session].size>300)throw Error('Prior LRL directory incomplete or unexpected');
  const targets:IncomingTarget[]=roster.filter(m=>!prior[94].has(m.lrlId)).map(m=>{
    const [chamber,district]=m.seat.split(':');
    if(chamber!=='house'&&chamber!=='senate')throw Error('Unexpected seat');
    return {...m,chamber,district,service:prior[92].has(m.lrlId)||prior[93].has(m.lrlId)?'returning':'no_recent_service'};
  });
  return targets.sort((a,b)=>(a.service==='no_recent_service'?0:1)-(b.service==='no_recent_service'?0:1)||a.seat.localeCompare(b.seat,undefined,{numeric:true}));
}
function districtKey(value:string):string{
  const match=/^0*(\d+)([AB]?)$/i.exec(value.replace(/\s+/g,''));
  if(!match||Number(match[1])<1||Number(match[1])>67)return '';
  return String(Number(match[1]))+match[2].toUpperCase();
}
function exactName(member:IncomingTarget,name:string){
  const key=normalizePersonKey(name);
  return Boolean(key)&&[member.name,member.electionName].some(value=>normalizePersonKey(value)===key);
}
export function matchingIncomingFilings(member:IncomingTarget,filings:readonly CampaignSiteFiling[]){
  return [...new Map(filings.filter(f=>f.chamber===member.chamber&&districtKey(f.district)===member.district&&
    exactName(member,f.candidateName)&&/^(\d{1,2})\/(\d{1,2})\/2026$/.test(f.filingDate??''))
    .map(f=>[f.website,f])).values()];
}
export function parse2026HousingIndex(html:string,sourceUrl:string):HousingLink[]{
  const links:HousingLink[]=[];
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>x[1]);
    if(cells.length<4)continue;
    const label=visibleLines(cells[1]).join(' ').trim();
    if(label!=='House'&&label!=='Senate')continue;
    const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(cells[0])?.[1];
    if(!href)continue;
    let url:URL;try{url=new URL(href.replaceAll('&amp;','&'),sourceUrl);}catch{continue;}
    if(url.origin!=='https://mhponline.org'||url.search||url.hash||!/^\/2026_questionnaire\/[^/]+\/?$/.test(url.pathname))continue;
    const candidate=visibleLines(cells[0]).join(' ').trim(),district=districtKey(visibleLines(cells[3]).join(' '));
    if(!candidate||candidate.length>120||!district||((label==='House')!==/[AB]$/.test(district)))continue;
    links.push({candidate,chamber:label==='House'?'house':'senate',district,url:url.href});
  }
  if(!links.length)throw Error('No actual 2026 candidate responses on original publisher index');
  return [...new Map(links.map(x=>[x.url+'|'+x.candidate,x])).values()];
}
export function matchingIncomingHousing(member:IncomingTarget,links:readonly HousingLink[]){
  return links.filter(link=>link.chamber===member.chamber&&link.district===member.district&&exactName(member,link.candidate));
}
/** This pilot verifies response presence only; it does not create directional
 * evidence or reproduce complete publisher Q&As in a public repository. */
export function verifyHousingResponse(page:Pick<PublicPage,'text'|'rawContent'>,member:IncomingTarget,link:HousingLink):number{
  if(!exactName(member,link.candidate)||member.chamber!==link.chamber||member.district!==link.district)throw Error('Publisher index identity mismatch');
  const lines=visibleLines(page.rawContent);
  if(!publicPageMentionsPerson(page.text,link.candidate))throw Error('Candidate absent from publisher response');
  const districtMarker=lines.findIndex(line=>/^Legislative District\s*:/i.test(line));
  if(districtMarker>=0){
    const region=lines.slice(districtMarker,districtMarker+4).join(' ');
    const displayed=/\b(House|Senate)\s+District\s+0*(\d+[AB]?)\b/i.exec(region);
    if(displayed&&(displayed[1].toLowerCase()!==member.chamber||districtKey(displayed[2])!==member.district))throw Error('Response district mismatch');
  }
  const segments:string[][]=[];
  for(const line of lines.slice(Math.max(0,lines.findIndex(x=>/^Q1\s*:/i.test(x))))){
    if(/^Contact Us$/i.test(line)||/^©\s*20\d{2}/.test(line))break;
    if(/^Q\d{1,2}\s*:/i.test(line))segments.push([line.replace(/^Q\d{1,2}\s*:\s*/i,'')]);
    else if(segments.length)segments.at(-1)!.push(line);
  }
  const complete=segments.filter(parts=>{
    const first=parts[0]??'',mark=first.indexOf('?');
    const answer=[mark>=0?first.slice(mark+1):'',...parts.slice(1)].join(' ').trim();
    return answer.length>=12&&!/^(?:no response|not provided|unanswered|n\/a)[.!]?$/i.test(answer);
  }).length;
  if(complete<2)throw Error('No multiple complete questionnaire answers observed');
  return complete;
}
export function policyExcerpt(page:Pick<PublicPage,'text'>):string|undefined{
  // Limited original-policy text; no contacts, fundraising, navigation or
  // candidate demographics. This is a source excerpt, not a stance label.
  const candidates=page.text.split(/(?<=[.!?])\s+/).filter(sentence=>sentence.length>=30&&sentence.length<=260&&
    /\b(?:support|oppose|prioritize|believe|will work|we need|must|invest|protect|reduce|increase)\b/i.test(sentence)&&
    /\b(?:education|schools?|housing|health ?care|tax(?:es)?|budget|transportation|energy|environment|childcare|public safety|agriculture|labor|workers?)\b/i.test(sentence)&&
    !/[@$]|\b(?:donate|contact|email|phone|call|address|subscribe|sign up|paid for|privacy policy|endorsement)\b|\d{3}/i.test(sentence));
  const words=candidates[0]?.trim().split(/\s+/);
  return words?.length&&words.length<=22?words.join(' '):undefined;
}
