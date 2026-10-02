export const MN_SENATE_MEDIA_CAPTION_SOURCE_PROBE_VERSION =
  'mn-senate-media-caption-source-probe-v1' as const;

export interface CaptionSourceCandidate {
  kind: 'track' | 'url_attribute' | 'quoted_url' | 'caption_markup';
  value: string;
}

function decodeHtml(value:string):string{
  return value
    .replace(/&#(\d+);/g,(_m,c:string)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c:string)=>String.fromCodePoint(Number.parseInt(c,16)))
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'");
}

function absolute(value:string,pageUrl:string):string{
  try{return new URL(decodeHtml(value),pageUrl).toString();}catch{return decodeHtml(value);}
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
