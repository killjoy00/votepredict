import { canonicalPublicUrl } from './public-http';

export const HOUSE_COMMITTEE_ARCHIVE_PARSER_VERSION='house-committee-archive-v1' as const;

export type HouseCommitteeAttachmentKind =
  | 'agenda'
  | 'minutes'
  | 'testimony_handout'
  | 'testifier_list'
  | 'amendment'
  | 'committee_rollcall'
  | 'bill_summary'
  | 'fiscal_note'
  | 'attachment';

export interface HouseCommitteeArchiveAttachment {
  fileName:string;
  url:string;
  postedOn:string;
  kind:HouseCommitteeAttachmentKind;
  billIdentifiers:string[];
}

function decode(value:string):string{
  return value
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_m,c)=>String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,c)=>String.fromCodePoint(Number.parseInt(c,16)));
}
function text(value:string):string{
  return decode(value.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
}
function isoDate(value:string):string|null{
  const match=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!match)return null;
  const month=match[1].padStart(2,'0'),day=match[2].padStart(2,'0');
  const result=`${match[3]}-${month}-${day}`;
  const parsed=new Date(result+'T00:00:00Z');
  return Number.isNaN(parsed.getTime())?null:result;
}
function normalizeBill(prefix:string,numberText:string):string{
  return prefix.toUpperCase()+String(Number(numberText));
}
export function billIdentifiersFromHouseAttachment(name:string):string[]{
  const normalized=text(name).toUpperCase();
  const found=new Set<string>();
  for(const match of normalized.matchAll(/\b(HF|SF)\s*0*(\d{1,5})\b/g)){
    found.add(normalizeBill(match[1],match[2]));
  }
  for(const match of normalized.matchAll(/\b([HS])\s*0*(\d{2,5})(?=(?:A\d+|DE\d+|UE\d+|CR\d+|\.PDF|\s))/g)){
    found.add(normalizeBill(match[1]==='H'?'HF':'SF',match[2]));
  }
  return [...found].sort();
}
export function classifyHouseAttachment(name:string):HouseCommitteeAttachmentKind{
  const lower=text(name).toLowerCase();
  if(/\bagenda\b/.test(lower))return 'agenda';
  if(/\bminutes?\b/.test(lower))return 'minutes';
  if(/testifier|sign[ -]?in/.test(lower))return 'testifier_list';
  if(/testimony|handout|letter of support|letter of opposition|presentation|stakeholder/.test(lower))return 'testimony_handout';
  if(/roll[ -]?call/.test(lower))return 'committee_rollcall';
  if(/fiscal\s*note/.test(lower))return 'fiscal_note';
  if(/\bsummary\b/.test(lower))return 'bill_summary';
  if(/(?:\b[hs]\s*\d{2,5}(?:a|de|ue|cr)\d+\b)|\bamend(?:ment|ed)?\b/.test(lower))return 'amendment';
  return 'attachment';
}

export function parseHouseCommitteeArchiveAttachments(
  html:string,
  pageUrl:string,
):HouseCommitteeArchiveAttachment[]{
  const rows:HouseCommitteeArchiveAttachment[]=[];
  const anchor=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,180}?)(?=<a\b|<\/li>|<br\s*\/?\s*>|\n|$)/gi;
  for(const match of html.matchAll(anchor)){
    const href=decode(match[1]).trim();
    const fileName=text(match[2]);
    const tail=text(match[3]);
    if(!fileName||!href)continue;
    if(!/\.(?:pdf|docx?|xlsx?|pptx?|txt)(?:\?|$)/i.test(href)&&!/\.pdf$/i.test(fileName))continue;
    const dateMatch=tail.match(/\((\d{1,2}\/\d{1,2}\/\d{4})\)/);
    if(!dateMatch)continue;
    const postedOn=isoDate(dateMatch[1]);
    if(!postedOn)continue;
    let url:string;
    try{url=canonicalPublicUrl(href,pageUrl);}catch{continue;}
    rows.push({
      fileName,
      url,
      postedOn,
      kind:classifyHouseAttachment(fileName),
      billIdentifiers:billIdentifiersFromHouseAttachment(fileName+' '+url),
    });
  }
  const unique=new Map<string,HouseCommitteeArchiveAttachment>();
  for(const row of rows)unique.set(row.url+'|'+row.postedOn,row);
  return [...unique.values()].sort((a,b)=>
    a.postedOn.localeCompare(b.postedOn)||a.url.localeCompare(b.url)
  );
}

export function parseHouseCommitteeArchiveTotalPages(textContent:string,pageSize=20):number{
  const match=textContent.match(/Total\s+Results:\s*([0-9,]+)/i);
  if(!match)return 1;
  const total=Number(match[1].replace(/,/g,''));
  return Number.isFinite(total)&&total>0?Math.ceil(total/pageSize):1;
}
