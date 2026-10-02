export const MN_SENATE_MEDIA_CAPTION_SOURCE_PROBE_VERSION =
  'mn-senate-media-caption-source-probe-v2' as const;

export interface CaptionSourceCandidate {
  kind: 'track' | 'url_attribute' | 'quoted_url' | 'caption_markup';
  value: string;
}

export interface SenateCaptionRequest {
  mp4: string;
  videoIndex: number | null;
  endpointUrl: string;
}

export interface SenateCaptionPayloadSummary {
  dataTimeCount: number;
  tableRowCount: number;
  tableCellCount: number;
  textChars: number;
  firstDataTimeValues: string[];
}

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}

function stripTags(value:string):string{
  return decodeHtml(value.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}

function absolute(value:string,pageUrl:string):string{
  try{return new URL(decodeHtml(value),pageUrl).toString();}catch{return decodeHtml(value);}
}

function dataAttribute(tag:string,name:'data-id'|'data-num'):string|undefined{
  const match=name==='data-id'
    ? tag.match(/\bdata-id\s*=\s*["']([^"']+)["']/i)
    : tag.match(/\bdata-num\s*=\s*["']([^"']+)["']/i);
  return match?.[1];
}

export function extractSenateCaptionRequests(html:string,pageUrl:string):SenateCaptionRequest[]{
  const rows:SenateCaptionRequest[]=[];
  const seen=new Set<string>();
  for(const match of html.matchAll(/<[^>]*\bclass\s*=\s*["'][^"']*\bshowcaptions\b[^"']*["'][^>]*>/gi)){
    const tag=match[0];
    const mp4=decodeHtml(dataAttribute(tag,'data-id')??'').trim();
    if(!mp4||!/\.mp4$/i.test(mp4))continue;
    const rawIndex=dataAttribute(tag,'data-num');
    const videoIndex=rawIndex&&/^\d+$/.test(rawIndex)?Number(rawIndex):null;
    const endpoint=new URL('media_functions',pageUrl);
    endpoint.searchParams.set('type','getCaption');
    endpoint.searchParams.set('captionid','');
    endpoint.searchParams.set('strmp4',mp4);
    const endpointUrl=endpoint.toString();
    if(seen.has(endpointUrl))continue;
    seen.add(endpointUrl);
    rows.push({mp4,videoIndex,endpointUrl});
  }
  return rows;
}

export function summarizeSenateCaptionPayload(html:string):SenateCaptionPayloadSummary{
  const times=[...html.matchAll(/\bdata-time\s*=\s*["']([^"']+)["']/gi)]
    .map(match=>decodeHtml(match[1]).trim())
    .filter(Boolean);
  return {
    dataTimeCount:times.length,
    tableRowCount:(html.match(/<tr\b/gi)??[]).length,
    tableCellCount:(html.match(/<td\b/gi)??[]).length,
    textChars:stripTags(html).length,
    firstDataTimeValues:[...new Set(times)].slice(0,10),
  };
}

export interface SenateCaptionRow {
  rawTime: string;
  startSeconds: number;
  text: string;
  explicitSpeaker?: string;
  utteranceText: string;
}

function captionTimeSeconds(value:string):number|undefined{
  const trimmed=decodeHtml(value).trim();
  if(/^\d+(?:\.\d+)?$/.test(trimmed)){
    const seconds=Number(trimmed);
    return Number.isFinite(seconds)?seconds:undefined;
  }
  const parts=trimmed.split(':').map(part=>Number(part));
  if(parts.some(part=>!Number.isFinite(part)))return undefined;
  if(parts.length===2)return parts[0]*60+parts[1];
  if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];
  return undefined;
}

function explicitSenateSpeaker(value:string):{speaker:string;utterance:string}|undefined{
  const compact=value.replace(/\s+/g,' ').trim();
  const match=compact.match(
    /^(?:>>\s*)?(?:(?:SEN(?:ATOR)?\.?|VICE\s+CHAIR|CHAIR)\s+)([A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{0,80})\s*:\s*(.*)$/i,
  );
  if(!match)return undefined;
  const speaker=match[1].trim();
  const utterance=match[2].trim();
  if(!speaker||!utterance)return undefined;
  return {speaker,utterance};
}

export function extractSenateCaptionRows(html:string):SenateCaptionRow[]{
  const rows:SenateCaptionRow[]=[];
  for(const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const rowHtml=rowMatch[1];
    const timeMatch=rowHtml.match(/\bdata-time\s*=\s*["']([^"']+)["']/i);
    if(!timeMatch)continue;
    const startSeconds=captionTimeSeconds(timeMatch[1]);
    if(startSeconds===undefined)continue;
    const cells=[...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(match=>stripTags(match[1]));
    if(cells.length<2)continue;
    const text=cells.slice(1).join(' ').replace(/\s+/g,' ').trim();
    if(!text)continue;
    const speaker=explicitSenateSpeaker(text);
    rows.push({
      rawTime:decodeHtml(timeMatch[1]).trim(),
      startSeconds,
      text,
      ...(speaker?{explicitSpeaker:speaker.speaker}:{}),
      utteranceText:speaker?.utterance??text,
    });
  }
  return rows;
}

export function extractSenateCaptionSourceCandidates(html:string,pageUrl:string):CaptionSourceCandidate[]{
  const rows:CaptionSourceCandidate[]=[];
  const seen=new Set<string>();
  const add=(kind:CaptionSourceCandidate['kind'],value:string)=>{
    const compact=value.replace(/\s+/g,' ').trim();
    if(!compact)return;
    const key=kind+'|'+compact;
    if(seen.has(key))return;
    seen.add(key);
    rows.push({kind,value:compact});
  };

  for(const match of html.matchAll(/<track\b([^>]*)>/gi)){
    const attrs=match[1];
    if(!/kind\s*=\s*["'](?:captions|subtitles)["']/i.test(attrs))continue;
    const src=attrs.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
    if(src)add('track',absolute(src,pageUrl));
  }

  for(const match of html.matchAll(/\b(?:href|src|data-[\w-]+)\s*=\s*["']([^"']+)["']/gi)){
    const value=decodeHtml(match[1]);
    if(/caption|subtitle|\.vtt(?:$|[?#])|\.srt(?:$|[?#])/i.test(value)){
      add('url_attribute',absolute(value,pageUrl));
    }
  }

  for(const match of html.matchAll(/["']([^"'\s<>]{1,600})["']/g)){
    const value=decodeHtml(match[1]);
    if(!/caption|subtitle|\.vtt(?:$|[?#])|\.srt(?:$|[?#])/i.test(value))continue;
    if(/^https?:\/\//i.test(value)||value.startsWith('/')||/\.vtt|\.srt/i.test(value)){
      add('quoted_url',absolute(value,pageUrl));
    }
  }

  for(const match of html.matchAll(/.{0,180}(?:show captions|caption|subtitle).{0,420}/gi)){
    add('caption_markup',decodeHtml(match[0]));
  }

  return rows;
}
