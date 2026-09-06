import { createHash } from 'node:crypto';
import { normalizeMemberName } from './house-votes';
import type { NormalizedMemberVote, NormalizedVoteEvent, NormalizedVoteKind } from './types';

const SENATE_BASE = 'https://www.senate.mn';
const SENATE_JOURNAL_INDEX = `${SENATE_BASE}/journals/journal_list.html`;

export interface SenateJournalLink { sourceUrl: string; sessionSlug: string; year: number; legislativeDay?: number; date?: string; }
export interface SenateJournalDocument { text: string; pdfSha256: string; byteLength: number; }

function decodeHtml(value: string): string {
  return value.replace(/&#(\d+);/g,(_,code:string)=>String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi,(_,code:string)=>String.fromCodePoint(Number.parseInt(code,16))).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&nbsp;',' ');
}

export function discoverSenateJournalLinks(html:string,sessionSlug:string):SenateJournalLink[]{
  const decoded=decodeHtml(html); const found=new Map<string,SenateJournalLink>();
  const pattern=/href=["']([^"']*\/journals\/(\d{4}-\d{4})\/(\d{8})(\d{3})\.pdf)["']/gi;
  for(const match of decoded.matchAll(pattern)){
    if(match[2]!==sessionSlug)continue; const sourceUrl=new URL(match[1],SENATE_BASE).toString(); const compactDate=match[3]; const legislativeDay=Number(match[4]);
    found.set(sourceUrl,{sourceUrl,sessionSlug,year:Number(compactDate.slice(0,4)),date:`${compactDate.slice(0,4)}-${compactDate.slice(4,6)}-${compactDate.slice(6,8)}`,legislativeDay:Number.isFinite(legislativeDay)?legislativeDay:undefined});
  }
  return [...found.values()].sort((a,b)=>(a.date??'').localeCompare(b.date??''));
}

export async function listSenateJournalLinks(sessionSlug:string):Promise<SenateJournalLink[]>{
  const response=await fetch(SENATE_JOURNAL_INDEX,{headers:{'User-Agent':'VotePredict/2.0 historical vote ingester'},signal:AbortSignal.timeout(20_000)});
  if(!response.ok)throw new Error(`Minnesota Senate journal index returned ${response.status}`);
  const links=discoverSenateJournalLinks(await response.text(),sessionSlug); if(links.length===0)throw new Error(`No Minnesota Senate journals discovered for ${sessionSlug}`); return links;
}

function validateJournalUrl(sourceUrl:string):void{
  const url=new URL(sourceUrl);
  if(url.protocol!=='https:'||url.hostname!=='www.senate.mn'||!/^\/journals\/\d{4}-\d{4}\/\d{11}\.pdf$/i.test(url.pathname))throw new Error(`Unsupported Minnesota Senate journal URL: ${sourceUrl}`);
}

export async function fetchSenateJournal(sourceUrl:string):Promise<SenateJournalDocument>{
  validateJournalUrl(sourceUrl);
  const response=await fetch(sourceUrl,{headers:{'User-Agent':'VotePredict/2.0 historical vote ingester'},signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error(`Minnesota Senate journal returned ${response.status}: ${sourceUrl}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength<1000)throw new Error(`Minnesota Senate journal PDF was unexpectedly small: ${sourceUrl}`);
  const {PDFParse}=await import('pdf-parse'); const parser=new PDFParse({data:bytes});
  try{
    const result=await parser.getText(); if(!result.text||result.text.length<100)throw new Error(`Senate journal text extraction returned too little text: ${sourceUrl}`);
    return {text:result.text,pdfSha256:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.byteLength};
  }finally{await parser.destroy();}
}

export async function extractSenateJournalText(sourceUrl:string):Promise<string>{return (await fetchSenateJournal(sourceUrl)).text;}

export function classifySenateVoteKind(text:string):NormalizedVoteKind{const value=text.toLowerCase();if(/\b(repassage|passage|final passage)\b/.test(value))return'passage';if(/\bamendment\b/.test(value))return'amendment';if(/\b(motion|reconsider|recall|re-refer)\b/.test(value))return'motion';if(/\b(rule|procedural|adjourn|table)\b/.test(value))return'procedural';return'other';}
function canonicalBill(value:string):string|undefined{const match=value.match(/([HS])\.?\s*F\.?\s*(?:No\.?\s*)?0*(\d+)/i);return match?`${match[1].toUpperCase()}F${Number(match[2])}`:undefined;}
function splitNames(block:string,choice:'yea'|'nay',startOrdinal:number):NormalizedMemberVote[]{
  const cleaned=block.replace(/\f/g,'\n').replace(/\b\d+(?:ST|ND|RD|TH) DAY\b/gi,' ').replace(/\bJOURNAL OF THE SENATE\b/gi,' ').replace(/\[[^\]]+DAY[^\]]*\]/gi,' ').replace(/\b\d{3,5}\b/g,' ');
  const tokens=cleaned.split(/\r?\n|\s{2,}/).map(v=>v.trim()).filter(Boolean);const names:string[]=[];
  for(const token of tokens){if(/^(So the bill|The question|The roll|Those who|MOTIONS|SPECIAL|MESSAGES|CALENDAR|CONSENT|GENERAL ORDERS)/i.test(token))break;if(token.length>60||!/[A-Za-zÀ-ž]/.test(token))continue;for(const piece of(token.includes('  ')?token.split(/\s{2,}/):[token])){const name=piece.trim().replace(/[;.]$/,'');if(!name||name.split(/\s+/).length>5)continue;names.push(name);}}
  return names.map((sourceName,index)=>({sourceName,normalizedName:normalizeMemberName(sourceName),choice,sourceOrdinal:startOrdinal+index}));
}

export function parseSenateJournalText(input:{text:string;sessionKey:string;sourceUrl:string;occurredOn?:string}):NormalizedVoteEvent[]{
  const text=input.text.replace(/\r/g,'');const events:NormalizedVoteEvent[]=[];
  const rollPattern=/The question was taken on the (re)?passage of the bill[^.]*\.\s*The roll was called, and there were yeas\s+(\d+)\s+and nays\s+(\d+), as follows:\s*Those who voted in the affirmative were:\s*([\s\S]*?)(?=Those who voted in the negative were:|So the bill)/gi;
  for(const match of text.matchAll(rollPattern)){
    const start=match.index??0;const context=text.slice(Math.max(0,start-1600),start);const billMatches=[...context.matchAll(/(?:S\.?F\.?|H\.?F\.?)\s*(?:No\.?)?\s*\d+/gi)];const billIdentifier=billMatches.length?canonicalBill(billMatches[billMatches.length-1][0]):undefined;if(!billIdentifier)continue;
    const yeaCount=Number(match[2]);const nayCount=Number(match[3]);const after=text.slice(start+match[0].length,start+match[0].length+5000);const negative=after.match(/^\s*Those who voted in the negative were:\s*([\s\S]*?)(?=So the bill|MOTIONS|SPECIAL|MESSAGES|CALENDAR|CONSENT|GENERAL ORDERS)/i);
    const yeaVotes=splitNames(match[4],'yea',0).slice(0,yeaCount);const nayVotes=nayCount===0?[]:splitNames(negative?.[1]??'','nay',yeaVotes.length).slice(0,nayCount);
    if(yeaVotes.length!==yeaCount||nayVotes.length!==nayCount)throw new Error(`Senate journal roster mismatch for ${billIdentifier}: expected ${yeaCount}-${nayCount}, parsed ${yeaVotes.length}-${nayVotes.length}`);
    const motionText=text.slice(Math.max(0,start-500),start+120).replace(/\s+/g,' ').trim();const voteKind=classifySenateVoteKind(match[1]?'repassage':'passage');const occurredOn=input.occurredOn??'1900-01-01';
    events.push({externalKey:`${input.sessionKey}:${billIdentifier}:${occurredOn}:senate:${events.length+1}`,billIdentifier,voteKind,isPassage:voteKind==='passage',motionText,occurredOn,yeaCount,nayCount,otherCount:0,memberVotes:[...yeaVotes,...nayVotes],sourceUrl:input.sourceUrl});
  }
  return events;
}
