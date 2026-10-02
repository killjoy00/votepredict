import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const MN_SENATE_COMMITTEE_SOURCE_VERSION =
  'mn-senate-committee-source-v5' as const;
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
  extractionMethod: 'embedded_text' | 'ocr_tesseract';
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

function anchors(html:string,baseUrl:string):Array<{href:string;text:string;index:number}>{
  const rows:Array<{href:string;text:string;index:number}>=[];
  for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    try{
      rows.push({
        href:new URL(decodeHtml(match[1]),baseUrl).toString(),
        text:stripTags(match[2]),
        index:match.index??0,
      });
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

export function parseSenateCommitteeIndexHtml(input:{
  year:number;
  html:string;
  sourceUrl:string;
}):SenateCommitteePage[]{
  const rows:SenateCommitteePage[]=[];
  const seen=new Set<string>();
  for(const anchor of anchors(input.html,input.sourceUrl)){
    const url=new URL(anchor.href);
    if(url.hostname!=='www.lrl.mn.gov'&&url.hostname!=='lrl.mn.gov')continue;
    if(!/^\/minutes\/comm(?:\.aspx)?$/i.test(url.pathname))continue;
    if(url.searchParams.get('year')!==String(input.year))continue;
    const committeeName=anchor.text.replace(/\s*\(Senate\)\s*$/i,'').trim();
    if(!/\(Senate\)\s*$/i.test(anchor.text)||!committeeName)continue;
    url.searchParams.delete('date');
    const key=url.toString();
    if(seen.has(key))continue;
    seen.add(key);
    rows.push({year:input.year,committeeName,url:key});
  }
  return rows.sort((a,b)=>a.committeeName.localeCompare(b.committeeName)||a.url.localeCompare(b.url));
}

export function parseSenateCommitteePageHtml(input:{
  year:number;
  committeeName:string;
  html:string;
  sourceUrl:string;
}):SenateCommitteeMinuteDocument[]{
  const rows:SenateCommitteeMinuteDocument[]=[];
  const seen=new Set<string>();
  for(const anchor of anchors(input.html,input.sourceUrl)){
    const url=new URL(anchor.href);
    if(url.hostname!=='www.lrl.mn.gov'&&url.hostname!=='lrl.mn.gov')continue;
    if(!new RegExp(`^/archive/minutes/senate/${input.year}/`,'i').test(url.pathname))continue;
    if(!/_minutes\.pdf$/i.test(url.pathname))continue;
    const dateMatch=url.pathname.match(/\/(20\d{6})\//);
    if(!dateMatch)continue;
    const raw=dateMatch[1];
    const meetingDate=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
    const key=url.toString();
    if(seen.has(key))continue;
    seen.add(key);
    rows.push({year:input.year,committeeName:input.committeeName,meetingDate,url:key});
  }
  return rows.sort((a,b)=>a.meetingDate.localeCompare(b.meetingDate)||a.url.localeCompare(b.url));
}

export async function discoverSenateCommitteeMinuteDocuments(input:{
  year:number;
  fetchImpl?:typeof fetch;
}):Promise<{committeePages:number;documents:SenateCommitteeMinuteDocument[]}>{
  const fetchImpl=input.fetchImpl??fetch;
  const indexUrl=`${MN_LRL_MINUTES_BASE}/minutes/default?body=senate&year=${input.year}`;
  const indexHtml=await fetchHtml(indexUrl,fetchImpl);
  const committees=parseSenateCommitteeIndexHtml({year:input.year,html:indexHtml,sourceUrl:indexUrl});
  const documents:SenateCommitteeMinuteDocument[]=[];
  for(const committee of committees){
    const html=await fetchHtml(committee.url,fetchImpl);
    documents.push(...parseSenateCommitteePageHtml({
      year:input.year,
      committeeName:committee.committeeName,
      html,
      sourceUrl:committee.url,
    }));
  }
  const deduped=new Map(documents.map(row=>[row.url,row]));
  return {
    committeePages:committees.length,
    documents:[...deduped.values()].sort((a,b)=>
      a.meetingDate.localeCompare(b.meetingDate)
      || a.committeeName.localeCompare(b.committeeName)
      || a.url.localeCompare(b.url)),
  };
}


function cleanPdfText(value:string):string{
  return value.replace(/\u0000/g,'').replace(/[ \t]+\n/g,'\n').trim();
}

export function chooseSenateCommitteeMinuteText(input:{
  embeddedText:string;
  ocrText?:string;
}):{text:string;extractionMethod:'embedded_text'|'ocr_tesseract'}{
  const embedded=cleanPdfText(input.embeddedText);
  if(embedded.length>=40)return {text:embedded,extractionMethod:'embedded_text'};
  const ocr=cleanPdfText(input.ocrText??'');
  if(ocr.length>=40)return {text:ocr,extractionMethod:'ocr_tesseract'};
  throw new Error('Minnesota Senate committee minutes PDF had too little extractable text');
}

function ocrSenateCommitteeMinutePdf(bytes:Uint8Array):string{
  if(process.env.VOTEPREDICT_SENATE_COMMITTEE_OCR!=='1')return '';
  const dir=mkdtempSync(join(tmpdir(),'votepredict-senate-minutes-'));
  try{
    const pdfPath=join(dir,'minutes.pdf');
    const imagePrefix=join(dir,'page');
    writeFileSync(pdfPath,Buffer.from(bytes));
    try{
      execFileSync('pdftoppm',['-jpeg','-r','200',pdfPath,imagePrefix],{
        stdio:'ignore',timeout:120_000,
      });
    }catch(error){
      throw new Error('Minnesota Senate committee minutes OCR render failed',{cause:error});
    }
    const images=readdirSync(dir)
      .filter(name=>/^page-\d+\.jpg$/i.test(name))
      .sort((left,right)=>left.localeCompare(right,undefined,{numeric:true}));
    if(images.length===0)throw new Error('Minnesota Senate committee minutes OCR produced no page images');
    const pages:string[]=[];
    for(const image of images){
      try{
        const text=execFileSync('tesseract',[
          join(dir,image),'stdout','-l','eng','--psm','1',
        ],{
          encoding:'utf8',timeout:120_000,
          stdio:['ignore','pipe','pipe'],
        });
        pages.push(text);
      }catch(error){
        throw new Error('Minnesota Senate committee minutes OCR failed',{cause:error});
      }
    }
    return pages.join('\n\n');
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
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
    const embeddedText=cleanPdfText(parsed.text);
    const selected=chooseSenateCommitteeMinuteText({
      embeddedText,
      ...(embeddedText.length<40?{ocrText:ocrSenateCommitteeMinutePdf(bytes)}:{}),
    });
    return {
      text:selected.text,
      bytes:bytes.byteLength,
      contentSha256:createHash('sha256').update(bytes).digest('hex'),
      fetchedAt:new Date().toISOString(),
      httpStatus:response.status,
      extractionMethod:selected.extractionMethod,
    };
  }finally{
    await parser.destroy();
  }
}
