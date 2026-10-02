import { createHash } from 'node:crypto';

export const MN_SENATE_COMMITTEE_SOURCE_VERSION =
  'mn-senate-committee-source-v2' as const;
export const MN_LRL_MINUTES_BASE = 'https://www.lrl.mn.gov';

export interface SenateCommitteePage {
  year: number;
  committeeName: string;
  url: string;
}

export interface SenateCommitteeMinuteDocument {
  year: number;
  committeeName: string;
  meetingDate: string;
  url: string;
}

export interface FetchedSenateCommitteeMinute {
  text: string;
  bytes: number;
  contentSha256: string;
  fetchedAt: string;
  httpStatus: number;
}

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>');
}

function stripTags(value:string):string{
  return decodeHtml(value.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}

function anchors(html:string,baseUrl:string):Array<{href:string;text:string}>{
  const rows:Array<{href:string;text:string}>=[];
  for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    try{
      rows.push({href:new URL(decodeHtml(match[1]),baseUrl).toString(),text:stripTags(match[2])});
    }catch{
      // Invalid source hrefs are ignored; official-page coverage accounting records the page itself.
    }
  }
  return rows;
}

async function fetchHtml(url:string,fetchImpl:typeof fetch):Promise<string>{
  const response=await fetchImpl(url,{
    headers:{accept:'text/html,application/xhtml+xml','user-agent':'VotePredict/2.0 senator-evidence-corpus'},
    signal:AbortSignal.timeout(30_000),
  });
  if(!response.ok)throw new Error(`Minnesota LRL minutes page returned HTTP ${response.status}`);
  return response.text();
}

export function parseSenateMinutesYearHtml(input:{
  year:number;
  html:string;
  sourceUrl:string;
}):{committeeNames:string[];documents:SenateCommitteeMinuteDocument[]}{
  const sections=[...input.html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)];
  const committeeNames:string[]=[];
  const documents:SenateCommitteeMinuteDocument[]=[];
  const seen=new Set<string>();

  for(const section of sections){
    const heading=stripTags(section[1]);
    const committeeName=heading.replace(/\s*\(Senate\)\s*$/i,'').trim();
    if(!/\(Senate\)\s*$/i.test(heading)||!committeeName)continue;
    committeeNames.push(committeeName);

    for(const anchor of anchors(section[2],input.sourceUrl)){
      if(!/^minutes$/i.test(anchor.text.trim()))continue;
      const url=new URL(anchor.href);
      if(url.hostname!=='www.lrl.mn.gov'&&url.hostname!=='lrl.mn.gov')continue;
      if(!new RegExp(`^/archive/minutes/senate/${input.year}/`,'i').test(url.pathname))continue;
      if(!/\.pdf$/i.test(url.pathname))continue;
      const dateMatch=url.pathname.match(/\/(20\d{6})\//);
      if(!dateMatch)continue;
      const raw=dateMatch[1];
      const meetingDate=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
      const key=url.toString();
      if(seen.has(key))continue;
      seen.add(key);
      documents.push({year:input.year,committeeName,meetingDate,url:key});
    }
  }

  return {
    committeeNames:[...new Set(committeeNames)].sort((a,b)=>a.localeCompare(b)),
    documents:documents.sort((a,b)=>
      a.meetingDate.localeCompare(b.meetingDate)
      || a.committeeName.localeCompare(b.committeeName)
      || a.url.localeCompare(b.url)),
  };
}

export async function discoverSenateCommitteeMinuteDocuments(input:{
  year:number;
  fetchImpl?:typeof fetch;
}):Promise<{committeePages:number;documents:SenateCommitteeMinuteDocument[]}>{
  const fetchImpl=input.fetchImpl??fetch;
  const indexUrl=`${MN_LRL_MINUTES_BASE}/minutes/default?body=senate&year=${input.year}`;
  const indexHtml=await fetchHtml(indexUrl,fetchImpl);
  const parsed=parseSenateMinutesYearHtml({year:input.year,html:indexHtml,sourceUrl:indexUrl});
  return {committeePages:parsed.committeeNames.length,documents:parsed.documents};
}

export async function fetchSenateCommitteeMinutePdf(input:{
  url:string;
  fetchImpl?:typeof fetch;
}):Promise<FetchedSenateCommitteeMinute>{
  const fetchImpl=input.fetchImpl??fetch;
  const response=await fetchImpl(input.url,{
    headers:{accept:'application/pdf','user-agent':'VotePredict/2.0 senator-evidence-corpus'},
    signal:AbortSignal.timeout(45_000),
  });
  if(!response.ok)throw new Error(`Minnesota Senate committee minutes PDF returned HTTP ${response.status}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength<300)throw new Error('Minnesota Senate committee minutes PDF was unexpectedly small');
  const header=new TextDecoder('latin1').decode(bytes.slice(0,5));
  if(header!=='%PDF-')throw new Error('Minnesota Senate committee minutes response was not a PDF');
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:bytes.slice(),CanvasFactory});
  try{
    const parsed=await parser.getText();
    const text=parsed.text.replace(/\u0000/g,'').trim();
    if(text.length<40)throw new Error('Minnesota Senate committee minutes PDF had too little extractable text');
    return {
      text,
      bytes:bytes.byteLength,
      contentSha256:createHash('sha256').update(bytes).digest('hex'),
      fetchedAt:new Date().toISOString(),
      httpStatus:response.status,
    };
  }finally{
    await parser.destroy();
  }
}
