/**
 * Raw, publisher-authored Minnesota STATE Senate scorecards only.
 * Capture the literal source text and explicitly printed grades/endorsements.
 * Do not interpret methodology, policy stances, or historical as-of eligibility.
 */
import {createHash} from 'node:crypto';

export type SourceAdapter = 'a4l_pdf'|'aflcio_pdf'|'generic_pdf'|'gunowners_html'|'edmn_html'|'nfib_html'|'nfib_pdf'|'raw_html';
export interface ScorecardSource {
  groupName:string;year:number;adapter:SourceAdapter;url:string;electionCandidate?:boolean;
}
export interface ScorecardManifest {
  schemaVersion:number;researchIndex:string;sources:ScorecardSource[];requestedGroups:string[];
}
export interface ScorecardEntry {
  sourceOrdinal:number;nameRaw:string;districtRaw:string|null;partyRaw:string|null;
  kind:'score'|'grade'|'endorsement'|'rating';valueRaw:string;valueNumeric:number|null;
}
export interface ScorecardPosition {
  sourceOrdinal:number;billIdentifierRaw:string;groupPositionRaw:string;
}
export interface ScorecardCapture {
  source:ScorecardSource;sourceUrl:string;fetchedAt:string;
  sha256:string;contentType:string;rawText:string;publishedOn:string|null;
  entries:ScorecardEntry[];positions:ScorecardPosition[];
}
export interface ScorecardFailure {group:string;year:number;url:string;reason:string}
const SOURCE_ADAPTERS:SourceAdapter[]=[
  'a4l_pdf','aflcio_pdf','generic_pdf','gunowners_html','edmn_html','nfib_html','nfib_pdf','raw_html',
];
const MAX_BODY_BYTES=12_000_000;
const AGENT='VotePredictSenateEvidenceBot/1.0 (+https://github.com/killjoy00/votepredict)';
export const MIN_DELAY_MS=1000;

export function validateScorecardManifest(value:unknown):ScorecardManifest {
  if(!value||typeof value!=='object')throw Error('Scorecard source catalog is not an object');
  const cat=value as Partial<ScorecardManifest>;
  if(cat.schemaVersion!==1||!Array.isArray(cat.sources)||!Array.isArray(cat.requestedGroups)
    ||cat.sources.length<5||cat.sources.length>90)throw Error('Bad scorecard source catalog version or size');
  const seen=new Set<string>();
  for(const s of cat.sources){
    if(!s||!s.groupName||!Number.isInteger(s.year)||s.year<2021||s.year>2026
      ||!SOURCE_ADAPTERS.includes(s.adapter)||!s.url)throw Error('Invalid scorecard source');
    const u=new URL(s.url);
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost'
      ||/^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname))throw Error('Unsafe scorecard URL');
    const key=[s.groupName,s.year,u.href].join('|');
    if(seen.has(key))throw Error('Duplicate scorecard source');seen.add(key);
  }
  return cat as ScorecardManifest;
}
function decodeEntities(v:string):string {
  const dict:Record<string,string>={amp:'&',nbsp:' ',lt:'<',gt:'>',quot:'"',apos:"'",
    ndash:'–',mdash:'—',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',bull:'•'};
  return v.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi,(full,part:string)=>{
    if(part[0]!=='#')return dict[part.toLowerCase()]??full;
    const hex=/^#x/i.test(part);
    const n=parseInt(part.slice(hex?2:1),hex?16:10);
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):full;
  });
}
export function htmlToRawText(html:string):string {
  return decodeEntities(html.replace(/<!--[\\s\\S]*?-->/g,'')
    .replace(/<(?:script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|template)>/gi,' ')
    .replace(/<br\b[^>]*\/?>/gi,'\n')
    .replace(/<\/(?:h[1-6]|p|tr|div|li|section|article|main|table|ul|ol)>/gi,'\n')
    .replace(/<\/(?:td|th)>/gi,' | ')
    .replace(/<[^>]+>/g,' ')).replace(/\r/g,'')
    .replace(/[ \t\f\v]+/g,' ').replace(/[ \t]*\n[ \t]*/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function explicitPublishedOn(text:string):string|null {
  const head=text.slice(0,3500);
  const m=/\b(?:Last\s+Updated|Published(?:\s+on)?|Updated\s+on|ST\.?\s+PAUL,\s*Minnesota\.)\s*:?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(202[1-6])\b/i.exec(head);
  if(!m)return null;
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const mm=months.indexOf(m[1].toLowerCase())+1,day=Number(m[2]),year=Number(m[3]);
  const valid=new Date(Date.UTC(year,mm-1,day));
  return valid.getUTCMonth()===mm-1&&valid.getUTCDate()===day
    ?[year,String(mm).padStart(2,'0'),String(day).padStart(2,'0')].join('-'):null;
}
function numeric(raw:string):number|null {
  const s=raw.trim();
  if(!/^\d+(?:\.\d+)?%?$/.test(s))return null;
  const v=Number(s.replace(/%$/,''));return Number.isFinite(v)?v:null;
}
function newEntry(nameRaw:string,districtRaw:string|null,partyRaw:string|null,
  kind:ScorecardEntry['kind'],valueRaw:string):ScorecardEntry {
  return {sourceOrdinal:0,nameRaw:nameRaw.trim(),districtRaw,partyRaw,
    kind,valueRaw:valueRaw.trim(),valueNumeric:numeric(valueRaw)};
}
function noDuplicates(entries:ScorecardEntry[]):ScorecardEntry[] {
  const seen=new Set<string>(),keep:ScorecardEntry[]=[];
  for(const e of entries){
    const k=[e.kind,e.nameRaw,e.districtRaw,e.valueRaw].join('|');
    if(!e.nameRaw||!e.valueRaw||seen.has(k))continue;
    seen.add(k);keep.push({...e,sourceOrdinal:keep.length+1});
  }
  return keep;
}

/** Trimmed genuine 2025 and 2021 A4L printed rows have senator, party, Senate district, annual %, lifetime %. */
export function parseA4LSenatePdf(rawText:string):ScorecardEntry[] {
  const found:ScorecardEntry[]=[];
  for(const line of rawText.split(/\r?\n/)){
    const m=/^\s*([A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,5})\s+(R|D|DFL|I)\s+(0?[1-9]|[1-5]\d|6[0-7])\s+(\d{1,3}(?:\.\d+)?%)\s+(\d{1,3}(?:\.\d+)?%)(?:\s|$)/.exec(line);
    if(!m)continue;
    found.push(newEntry(m[1],String(Number(m[3])),m[2],'score',m[4]));
  }
  return noDuplicates(found);
}
function cleanCell(cell:string):string {
  return htmlToRawText(cell).replace(/\s*\|\s*/g,' ').replace(/\s+/g,' ').trim();
}
function tableRows(html:string):string[][][] {
  const tables:string[][][]=[];
  for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
    const rows:string[][]=[];
    for(const tr of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
      const cells=[...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(x=>cleanCell(x[1]));
      if(cells.length)rows.push(cells);
    }
    if(rows.length)tables.push(rows);
  }
  return tables;
}
function senateDistrictCell(raw:string):string|null {
  const m=/^(?:SD\s*|State\s+Senat(?:e|or)\s+District\s+)(\d{1,2})\s*$/i.exec(raw);
  const n=Number(m?.[1]);
  return n>=1&&n<=67?String(n):null;
}
/** Extract only actual State Senate table rows; House districts and federal Senate are ignored. */
export function parseGunOwnersSenateHtml(html:string):ScorecardEntry[] {
  const found:ScorecardEntry[]=[];
  for(const rows of tableRows(html)){
    const header=rows.find(row=>row.some(x=>/^Race$/i.test(x))&&row.some(x=>/^Name$/i.test(x))
      &&row.some(x=>/^Grade$/i.test(x))&&row.some(x=>/^Endorsement$/i.test(x)));
    if(!header)continue;
    const indexes=['Race','Name','Party','Grade','Endorsement','Voting Record'].map(key=>
      header.findIndex(v=>v.toLowerCase()===key.toLowerCase()));
    const [race,name,party,grade,endorse,record]=indexes;
    if([race,name,grade,endorse].some(n=>n<0))continue;
    for(const cells of rows.slice(rows.indexOf(header)+1)){
      const district=senateDistrictCell(cells[race]??'');
      const printedName=cells[name]?.trim();
      if(!district||!printedName)continue;
      const partyRaw=party>=0?(cells[party]||null):null;
      const rawGrade=cells[grade]?.trim();
      if(rawGrade)found.push(newEntry(printedName,district,partyRaw,'grade',rawGrade));
      if(/^\s*ENDORSED\s*$/i.test(cells[endorse]??''))
        found.push(newEntry(printedName,district,partyRaw,'endorsement',cells[endorse]));
      const rawScore=record>=0?cells[record]?.trim():null;
      if(rawScore&&/^\d+(?:\.\d+)?%$/.test(rawScore))
        found.push(newEntry(printedName,district,partyRaw,'score',rawScore));
    }
  }
  return noDuplicates(found);
}
/**
 * First-party Education Minnesota PAC release pages (2022 table and 2026
 * Senate-only bullet section). Endorsement denotes exactly the literal
 * named Senate candidate, not an inferred ideological or legislator position.
 */
export function parseEducationMinnesotaSenateEndorsements(html:string):ScorecardEntry[] {
  const found:ScorecardEntry[]=[];
  for(const rows of tableRows(html)){
    for(const cells of rows){
      for(let i=0;i+1<cells.length;i+=2){
        const m=/^Senate\s+0*(\d{1,2})\b/i.exec(cells[i+1]??'');
        if(!m||Number(m[1])<1||Number(m[1])>67)continue;
        const name=cells[i]?.replace(/\*+$/,'').trim();
        if(name&&!/^(?:candidate|name)$/i.test(name))
          found.push(newEntry(name,String(Number(m[1])),null,'endorsement','ENDORSED'));
      }
    }
  }
  // Newer release uses "House" and "Senate" headings, followed by
  // "24: Simon Glaser, DFL" (or "24: Simon Glaser").
  const lines=htmlToRawText(html).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const idx=lines.findIndex(l=>/^Senate(?:\s+endorsements?)?$/i.test(l));
  if(idx>=0){
    for(const line of lines.slice(idx+1)){
      if(/^About Education Minnesota\b/i.test(line)||/^House\b/i.test(line)
        ||/^For more information\b/i.test(line))break;
      const m=/^0*(\d{1,2})\s*:\s*(.+)$/.exec(line);
      if(!m)continue;
      const number=Number(m[1]);
      if(number<1||number>67)continue;
      const nameParty=/^(.*?)(?:,\s*(DFL|Republican|R|D|I))?\.?$/.exec(m[2])!;
      const name=nameParty[1].trim();
      if(name&&/[a-z]/i.test(name))
        found.push(newEntry(name,String(number),nameParty[2]??null,'endorsement','ENDORSED'));
    }
  }

  // The 2024 SD45 special-election release uses a three-column
  // "District | Name | Party" table, unlike the 2022 paired layout.
  for(const rows of tableRows(html)){
    if(!rows.some(cells=>/^District$/i.test(cells[0]??'')&&/^Name$/i.test(cells[1]??'')))
      continue;
    for(const cells of rows){
      const m=/^Senate\s+0*(\d{1,2})\s*$/i.exec(cells[0]??'');
      const n=Number(m?.[1]);const name=cells[1]?.trim();
      if(n>=1&&n<=67&&name)
        found.push(newEntry(name,String(n),cells[2]?.trim()||null,'endorsement','ENDORSED'));
    }
  }
  // Jan. 27, 2025 first-party special-election release explicitly names
  // one endorsed State Senate candidate and district in the publisher body.
  const body=htmlToRawText(html);
  const name=/announced its endorsement of\s+([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3})\s+in the special election\b/i.exec(body);
  const number=/\bSenate District\s+(\d{1,2})\b/.exec(body.slice(0,4500));
  if(name&&number&&Number(number[1])>=1&&Number(number[1])<=67)
    found.push(newEntry(name[1],String(Number(number[1])),null,'endorsement','ENDORSED'));
  return noDuplicates(found);
}

/**
 * NFIB Minnesota's original 2022/2024/2026 Senate endorsement releases
 * publish either a 2/4-cell Senate-only table, or literal "District 01—Sen.
 * Mark Johnson" bullet rows. Keep printed names, including "Sen." and "*".
 * Context must explicitly identify *Minnesota STATE Senate*: never copy
 * House, federal Senate, or general news commentary as endorsements.
 */
export function parseNfibMinnesotaSenateEndorsements(html:string):ScorecardEntry[] {
  const entries:ScorecardEntry[]=[];
  const district=(raw:string):string|null=>{
    const m=/^(?:(?:Senate\s+District|SD|District)\s*#?\s*)?0*(\d{1,2})$/i.exec(raw.trim());
    const n=Number(m?.[1]);
    return n>=1&&n<=67?String(n):null;
  };
  const senateHeading=/^(?:(?:Minnesota|MN)\s+)(?:State\s+)?Senate(?:\s+endorsements?)?$/i;
  const houseHeading=/^(?:(?:Minnesota|MN)\s+)(?:House(?:\s+of\s+Representatives?)?|State\s+House)/i;
  const text=htmlToRawText(html);
  let inSenate=false;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(senateHeading.test(line)){inSenate=true;continue;}
    if(inSenate&&(houseHeading.test(line)||/^Topics\s*:|^About NFIB|^State\s*:/i.test(line))){
      inSenate=false;continue;
    }
    if(!inSenate)continue;
    const bullet=/^District\s+#?\s*0*(\d{1,2})\s*(?:—|–|-|:)\s*(.+)$/.exec(line);
    if(bullet&&district(bullet[1])&&bullet[2].trim())
      entries.push(newEntry(bullet[2].trim(),district(bullet[1]),null,'endorsement','ENDORSED'));
  }
  // Tables are processed only when their nearest preceding explicit chamber
  // heading is Minnesota/MN Senate (never a House or U.S. Senate table).
  for(const t of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)){
    const before=htmlToRawText(html.slice(Math.max(0,(t.index??0)-3000),t.index));
    const headings=before.split(/\r?\n/).map(x=>x.trim())
      .filter(x=>senateHeading.test(x)||houseHeading.test(x));
    if(!headings.length||!senateHeading.test(headings.at(-1)!))continue;
    const rows=tableRows(t[0])[0]??[];
    const header=rows.find(x=>x.some(v=>/^(?:District\s*#?|Senate\s+District)$/i.test(v))
      &&x.some(v=>/^(?:Endorsed\s+Candidate|Candidate)$/i.test(v)));
    if(!header)continue;
    for(const cells of rows.slice(rows.indexOf(header)+1)){
      // Original NFIB index tables print repeating pairs: district, person,
      // district, person. Do not interpret unmatched House-district cells.
      for(let i=0;i+1<cells.length;i+=2){
        const d=district(cells[i]??'');
        const name=cells[i+1]?.replace(/\*+$/,'').trim();
        if(d&&name&&/[A-Za-z]/.test(name))
          entries.push(newEntry(name,d,null,'endorsement','ENDORSED'));
      }
    }
  }
  // An explicitly named Senate special-election endorsement can appear in a
  // single-candidate release, with the district printed in its own headline.
  const title=htmlToRawText(html.slice(0,30000)).split(/\r?\n/)
    .find(line=>/NFIB Minnesota PAC Endorses .* for SD\s*\d{1,2}/i.test(line));
  const single=title&&/NFIB Minnesota PAC Endorses\s+(.+?)\s+for\s+SD\s*0*(\d{1,2})\b/i.exec(title);
  if(single&&district(single[2]))
    entries.push(newEntry(single[1],district(single[2]),null,'endorsement','ENDORSED'));
  return noDuplicates(entries);
}
function pdfSenatorScoreLines(text:string):ScorecardEntry[] {
  // Conservative fallback for scorecard PDFs that print "Sen. Name SD 17 89%".
  // Do not classify unlabelled mentions or vote totals as scores.
  const out:ScorecardEntry[]=[];
  for(const line of text.split(/\r?\n/)){
    const m=/^\s*Sen(?:ator|\.)\s+([A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,4})\s+(?:SD\s*|District\s*)(\d{1,2})\s+(\d{1,3}(?:\.\d+)?%)\s*$/i.exec(line);
    if(m&&Number(m[2])>=1&&Number(m[2])<=67)
      out.push(newEntry(m[1],String(Number(m[2])),null,'score',m[3]));
  }
  return noDuplicates(out);
}
/** Preserve explicitly printed organizational support/opposition words, not a stance judgment. */
export function parseScorecardBillPositions(rawText:string,adapter:SourceAdapter):ScorecardPosition[] {
  if(adapter==='gunowners_html'||adapter==='edmn_html'||adapter==='nfib_html'||adapter==='raw_html')return [];
  const results:ScorecardPosition[]=[];
  const lines=rawText.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    // Action 4 Liberty: "HF1 - ... CORRECT VOTE: YES" (one bill per heading).
    if(adapter==='a4l_pdf'){
      const m=/^(H\s*\.?\s*F\s*\.?\s*\d{1,6}|S\s*\.?\s*F\s*\.?\s*\d{1,6})\s*[-–][^\n]*?\b(CORRECT VOTE:\s*(YES|NO))\b/i.exec(line);
      if(m)results.push({sourceOrdinal:0,billIdentifierRaw:m[1],groupPositionRaw:m[2]});
      // Older A4L table: bill identifier in parentheses, printed "Against" or "For".
      const older=/\(((?:HF|SF)\s*\d{1,6})\)[^\n]{0,200}?\b(Against|For)\s*$/i.exec(line);
      if(older&&rawText.includes('VOTE DESCRIPTIONS'))
        results.push({sourceOrdinal:0,billIdentifierRaw:older[1],groupPositionRaw:older[2]});
    }
    // AFL-CIO: "SF2300 – Passage ..." then printed "Minnesota AFL-CIO Position: Oppose".
    if(adapter==='aflcio_pdf'){
      const heading=/^\s*((?:HF|SF)\s*\d{1,6})\s*[-–]/i.exec(line);
      if(!heading)continue;
      const near=lines.slice(i+1,i+27).join('\n');
      const m=/Minnesota AFL-CIO Position:\s*(Support|Oppose|Uphold|Against|For)([^\n]*)/i.exec(near);
      if(m)results.push({sourceOrdinal:0,billIdentifierRaw:heading[1],
        groupPositionRaw:(m[1]+m[2]).trim()});
    }
  }
  // No inferred position is extracted from tabular vote grids alone.
  return results.slice(0,500).map((x,i)=>({...x,sourceOrdinal:i+1}));
}
export function parseScorecardContent(source:ScorecardSource,rawText:string,html?:string):
  {entries:ScorecardEntry[];positions:ScorecardPosition[]} {
  const entries=source.adapter==='a4l_pdf'?parseA4LSenatePdf(rawText):
    source.adapter==='gunowners_html'?parseGunOwnersSenateHtml(html??''):
    source.adapter==='edmn_html'?parseEducationMinnesotaSenateEndorsements(html??''):
    source.adapter==='nfib_html'?parseNfibMinnesotaSenateEndorsements(html??''):
    source.adapter==='raw_html'?[]:pdfSenatorScoreLines(rawText);
  return {entries,positions:parseScorecardBillPositions(rawText,source.adapter)};
}
interface RobotsRule {pattern:string;allow:boolean}
interface RobotsPolicy {rules:RobotsRule[];crawlDelay:number}
function regexEscape(text:string):string {return text.replace(/[|\\{}()[\]^$+?.]/g,'\\$&');}
function pathAllowed(path:string,rules:RobotsRule[]):boolean {
  let longest=-1,allowed=true;
  for(const r of rules){
    if(!r.pattern)continue;
    const expr='^'+regexEscape(r.pattern).replace(/\*/g,'.*').replace(/\\\$$/,'$');
    if(!new RegExp(expr).test(path))continue;
    const length=r.pattern.replace(/[\*$]/g,'').length;
    if(length>longest||(length===longest&&r.allow)){longest=length;allowed=r.allow;}
  }
  return allowed;
}
/** Standard robots grouping: specific user-agent wins over wildcard, longest Allow/Disallow path. */
export function parseRobots(text:string,agent=AGENT):RobotsPolicy {
  const groups:Array<{agents:string[];rules:RobotsRule[];crawlDelay:number}>=[];
  let active:{agents:string[];rules:RobotsRule[];crawlDelay:number}|null=null,hadRule=false;
  for(const row of text.split(/\r?\n/)){
    const line=row.replace(/#.*$/,'').trim(),m=/^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if(!m)continue;
    const key=m[1].toLowerCase(),val=m[2].trim();
    if(key==='user-agent'){
      if(!active||hadRule){active={agents:[],rules:[],crawlDelay:0};groups.push(active);hadRule=false;}
      active.agents.push(val.toLowerCase());
    }else if(active){
      if(key==='allow'||key==='disallow'){active.rules.push({pattern:val,allow:key==='allow'});hadRule=true;}
      if(key==='crawl-delay'){active.crawlDelay=Math.max(active.crawlDelay,Number(val)||0);hadRule=true;}
    }
  }
  const key=agent.toLowerCase().split('/')[0];
  const matches=groups.map(g=>({g,size:Math.max(...g.agents.map(a=>a==='*'?0:key.includes(a)?a.length:-1))}))
    .filter(x=>x.size>=0);
  if(!matches.length)return {rules:[],crawlDelay:0};
  const highest=Math.max(...matches.map(x=>x.size));
  return {rules:matches.filter(x=>x.size===highest).flatMap(x=>x.g.rules),
    crawlDelay:Math.max(...matches.filter(x=>x.size===highest).map(x=>x.g.crawlDelay))};
}
export class PolitePublicFetcher {
  private robots=new Map<string,RobotsPolicy>();
  private last=0;
  constructor(private readonly transport:typeof fetch=fetch,private readonly delayMs=MIN_DELAY_MS){}
  private async request(url:string):Promise<Response>{
    const gap=Math.max(0,this.delayMs-(Date.now()-this.last));
    if(gap)await new Promise(resolve=>setTimeout(resolve,gap));
    this.last=Date.now();
    return this.transport(url,{redirect:'manual',
      headers:{'user-agent':AGENT,'accept':'application/pdf,text/html,text/plain'},
      signal:AbortSignal.timeout(30000)});
  }
  private async allowed(url:URL):Promise<boolean>{
    const origin=url.origin;
    if(!this.robots.has(origin)){
      const r=await this.request(origin+'/robots.txt');
      if(r.status===404||r.status===410){this.robots.set(origin,{rules:[],crawlDelay:0});}
      else if(!r.ok)throw Error('robots_unavailable_'+r.status);
      else {
        const policy=parseRobots((await r.text()).slice(0,800000));
        this.robots.set(origin,policy);
      }
    }
    const policy=this.robots.get(origin)!;
    if(policy.crawlDelay*1000>this.delayMs)
      await new Promise(resolve=>setTimeout(resolve,Math.min(10000,policy.crawlDelay*1000)));
    return pathAllowed(url.pathname+url.search,policy.rules);
  }
  async bytes(url:string,allowHosts:Set<string>,maxBytes=MAX_BODY_BYTES):
    Promise<{bytes:Uint8Array;contentType:string;finalUrl:string}>{
    let current=new URL(url);
    for(let hop=0;hop<5;hop++){
      if(current.protocol!=='https:'||!allowHosts.has(current.hostname))
        throw Error('Unapproved publisher host or redirect');
      if(!await this.allowed(current))throw Error('Disallowed by robots.txt');
      const r=await this.request(current.href);
      if(r.status>=300&&r.status<400){
        const location=r.headers.get('location');
        if(!location)throw Error('Publisher redirect without location');
        current=new URL(location,current);continue;
      }
      if(!r.ok)throw Error('Publisher HTTP '+r.status);
      const size=Number(r.headers.get('content-length')??0);
      if(size>maxBytes)throw Error('Publisher response exceeds byte limit');
      const bytes=new Uint8Array(await r.arrayBuffer());
      if(bytes.byteLength>maxBytes)throw Error('Publisher response exceeds byte limit');
      return {bytes,contentType:r.headers.get('content-type')??'application/octet-stream',
        finalUrl:current.href};
    }
    throw Error('Publisher redirect limit');
  }
}
async function pdfText(bytes:Uint8Array):Promise<string>{
  if(new TextDecoder('ascii').decode(bytes.subarray(0,5))!=='%PDF-')throw Error('Not a PDF');
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:bytes.slice(),CanvasFactory});
  try{return (await parser.getText()).text.trim();}
  finally{await parser.destroy();}
}
export async function fetchScorecardCapture(
  source:ScorecardSource,fetcher:PolitePublicFetcher,hosts:Set<string>,
):Promise<ScorecardCapture>{
  const response=await fetcher.bytes(source.url,hosts);
  const fetchedAt=new Date().toISOString();
  const sha256=createHash('sha256').update(response.bytes).digest('hex');
  const pdf=source.adapter.endsWith('_pdf');
  const html=pdf?undefined:new TextDecoder('utf-8').decode(response.bytes);
  const rawText=pdf?await pdfText(response.bytes):htmlToRawText(html!);
  if(rawText.length<35)throw Error('Publisher source lacks readable original text');
  const parsed=parseScorecardContent(source,rawText,html);
  return {source,sourceUrl:response.finalUrl,fetchedAt,sha256,
    contentType:response.contentType,rawText,publishedOn:explicitPublishedOn(rawText),...parsed};
}
