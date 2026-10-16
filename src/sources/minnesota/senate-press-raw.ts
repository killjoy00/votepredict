import { setTimeout as sleep } from 'node:timers/promises';

// Only raw first-party text. No stance, authorship authentication, or vote matching.
export type Pagination = { kind: 'query'; key: string } | { kind: 'path'; segment: string };
export interface SenatePressSource {
  id: string; source_type: string; archive_url: string; pagination: Pagination;
  // Verified official member profile: its linked headlines use smaller headings.
  member_archive?: boolean;
}
export interface RawSenateStatement {
  source_id: string; source_type: string; source_url: string; fetched_at: string;
  published_on: string | null; title: string; named_senators: string[];
  bill_identifiers: string[]; raw_text: string;
}
export interface CollectionWindow { from: string; to: string; maxPages?: number; maxItems?: number; delayMs?: number; dryRun?: boolean }
export interface SourceCounts {
  source: string; source_type: string; from: string; to: string; pages: number;
  discovered: number; matched: number; inserted: number; previewed: number; already_present: number;
  outside_range: number; undated: number; by_year: Record<string, number>;
  member_archives: string[]; archive_gaps: number[];
  failures: Array<{ url: string; reason: string }>;
}
export interface StatementSink {
  existing(urls: string[]): Promise<ReadonlySet<string>>;
  insert(item: RawSenateStatement): Promise<boolean>;
}

type HtmlNode = { tag: string; attrs: string; parent?: HtmlNode; children: Array<HtmlNode | string> };
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const SKIP = new Set(['script','style','template','noscript','svg','form','nav','footer','aside']);
const ENTITY: Record<string,string> = {
  amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',
  lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…',bull:'•',middot:'·',
  copy:'©',reg:'®',trade:'™',euro:'€',times:'×',laquo:'«',raquo:'»',
};
export function decodeHtml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]+);/gi, (all, entity: string) => {
    if (entity.startsWith('#')) {
      const code = entity[1].toLowerCase()==='x'
        ? Number.parseInt(entity.slice(2),16) : Number.parseInt(entity.slice(1),10);
      return code>0 && code<=0x10ffff && !(code>=0xd800 && code<=0xdfff)
        ? String.fromCodePoint(code) : all;
    }
    return ENTITY[entity.toLowerCase()] ?? all;
  });
}
function htmlTree(html: string): HtmlNode {
  const root: HtmlNode={tag:'root',attrs:'',children:[]};
  const stack: HtmlNode[]=[root];
  const clean=html.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  for (const token of clean.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+/gi) ?? []) {
    if (token.startsWith('<!')) continue;
    const end=/^<\s*\/\s*([a-z][\w:-]*)/i.exec(token);
    if (end) {
      for(let i=stack.length-1;i>0;i--) if(stack[i].tag===end[1].toLowerCase()) {stack.length=i;break;}
      continue;
    }
    const open=/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i.exec(token);
    if(!open) {stack[stack.length-1].children.push(token);continue;}
    const tag=open[1].toLowerCase(), parent=stack[stack.length-1];
    const node: HtmlNode={tag,attrs:open[2],parent,children:[]};
    parent.children.push(node);
    if(!VOID.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
  }
  return root;
}
function attr(node: HtmlNode,name: string): string|null {
  const m=new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i').exec(node.attrs);
  return m?decodeHtml(m[1]??m[2]??m[3]):null;
}
function all(node: HtmlNode, match:(node:HtmlNode)=>boolean):HtmlNode[] {
  const found:HtmlNode[]=[];
  for(const child of node.children) if(typeof child!=='string') {
    if(match(child))found.push(child);
    found.push(...all(child,match));
  }
  return found;
}
function classMatch(node:HtmlNode,re:RegExp):boolean {
  return re.test((attr(node,'class')??'')+' '+(attr(node,'id')??''));
}
function text(node:HtmlNode,excludeChrome=false):string {
  if(excludeChrome && (SKIP.has(node.tag) ||
    classMatch(node,/related-post|author-box|author-bio|share-buttons|social-sharing|post-navigation|newsletter-signup|comments-area|breadcrumb/i)))return '';
  let result='';
  for(const child of node.children) {
    if(typeof child==='string')result+=decodeHtml(child);
    else if(child.tag==='br')result+='\n';
    else {
      const block=/^(p|div|section|article|h[1-6]|li|ul|ol|blockquote|figure|figcaption|tr|td|th)$/.test(child.tag);
      if(block)result+='\n';
      result+=text(child,excludeChrome);
      if(block)result+='\n';
    }
  }
  return result;
}
function plain(value:string):string {
  return value.replace(/\r/g,'').replace(/[\t\f\v ]+/g,' ')
    .replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function onSiteArticle(value:string,source:SenatePressSource):string|null {
  try {
    const url=new URL(value,source.archive_url),archive=new URL(source.archive_url);
    if(url.protocol!=='https:' || url.host!==archive.host || url.username || url.password || url.search || url.hash)return null;
    const pathname=url.pathname.replace(/\/+$/,'/')||'/';
    if(pathname==='/' || pathname===archive.pathname || pathname.startsWith(archive.pathname)
      || /\/(?:page\/\d+|author|category|tag|feed|wp-json|wp-content|home|senators|members|about|contact|events|search)(?:\/|$)/i.test(pathname))return null;
    url.pathname=pathname;
    return url.href;
  }catch{return null;}
}
export function articleUrlsFromListing(html:string,source:SenatePressSource):string[] {
  const root=htmlTree(html),urls=new Set<string>();
  for(const heading of all(root,node=>source.member_archive ? /^h[2-6]$/.test(node.tag) : /^h[2-4]$/.test(node.tag))) {
    let parent=heading.parent,inChrome=false;
    while(parent){if(SKIP.has(parent.tag)){inChrome=true;break;}parent=parent.parent;}
    if(inChrome || plain(text(heading)).length<12)continue;
    const links=all(heading,node=>node.tag==='a');
    if(heading.parent?.tag==='a')links.push(heading.parent);
    for(const link of links) {
      const url=onSiteArticle(attr(link,'href')??'',source);
      if(url)urls.add(url);
    }
  }
  return [...urls];
}
/** Preserve the actual official DFL author links rather than inferring URLs from names. */
export function authorArchivesFromListing(html:string,source:SenatePressSource):string[] {
  if(source.id!=='senate_dfl')return [];
  const root=htmlTree(html),origin=new URL(source.archive_url).origin;
  const found=new Set<string>();
  for(const link of all(root,n=>n.tag==='a')) {
    const href=attr(link,'href');if(!href)continue;
    try {
      const u=new URL(href,source.archive_url);
      if(u.origin===origin && u.protocol==='https:' && !u.search && !u.hash && !u.username &&
        /^\/author\/[a-z0-9-]+\/?$/i.test(u.pathname)) {
        u.pathname=u.pathname.replace(/\/?$/,'/');
        found.add(u.href);
      }
    }catch{/* Ignore untrusted unrelated links. */}
  }
  return [...found];
}
/** Get the last advertised archive page, if the publisher publishes a pager. */
export function lastArchivePageFromListing(html:string,source:SenatePressSource):number|null {
  const root=htmlTree(html),base=new URL(source.archive_url);
  let last=0;
  for(const link of all(root,n=>n.tag==='a')) {
    const href=attr(link,'href');if(!href)continue;
    try {
      const u=new URL(href,base);
      if(u.origin!==base.origin)continue;
      let page=0;
      if(source.pagination.kind==='query') {
        if(u.pathname!==base.pathname)continue;
        const value=u.searchParams.get(source.pagination.key);
        if(value && /^[1-9]\d{0,3}$/.test(value))page=Number(value);
      }else {
        const rootPath=base.pathname.replace(/\/+$/,'');
        if(!u.pathname.startsWith(rootPath+'/'))continue;
        const parts=u.pathname.slice(rootPath.length).split('/').filter(Boolean);
        if(parts.length===2 && parts[0]===source.pagination.segment &&
          /^[1-9]\d{0,3}$/.test(parts[1]))page=Number(parts[1]);
      }
      if(page>=1 && page<=1000)last=Math.max(last,page);
    }catch{/* Ignore malformed pager hrefs. */}
  }
  return last||null;
}
/** Only links under senator-name headings on the official GOP /senators/ roster. */
export function memberPagesFromDirectory(html:string,source:SenatePressSource):SenatePressSource[] {
  if(source.id!=='senate_republicans')return [];
  const root=htmlTree(html),base=new URL(source.archive_url),found=new Set<string>();
  for(const heading of all(root,n=>n.tag==='h5')) {
    const links=all(heading,n=>n.tag==='a');
    if(heading.parent?.tag==='a')links.push(heading.parent);
    for(const link of links){
    const href=attr(link,'href');if(!href)continue;
    try {
      const u=new URL(href,base);
      if(u.origin!==base.origin||u.protocol!=='https:'||u.search||u.hash||u.username||u.password)continue;
      if(!/^\/[a-z0-9-]+\/?$/i.test(u.pathname))continue;
      if(!/^[A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+){1,3}$/.test(plain(text(heading))))continue;
      u.pathname=u.pathname.replace(/\/?$/,'/');
      found.add(u.href);
    }catch{/* Ignore malformed member links. */}
    }
  }
  return [...found].map(url=>({...source,archive_url:url,member_archive:true}));
}
function isoDate(raw:string):string|null {
  const iso=/^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  if(iso) {
    const d=new Date(iso[1]+'T12:00:00Z');
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10)===iso[1]?iso[1]:null;
  }
  const m=/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(raw);
  if(!m)return null;
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  return isoDate(m[3]+'-'+String(months.indexOf(m[1].toLowerCase())+1).padStart(2,'0')+'-'+m[2].padStart(2,'0'));
}
function publicationDate(root:HtmlNode):string|null {
  // Visible time and publication meta, not dates mentioned deep in the article.
  for(const meta of all(root,node=>node.tag==='meta')) {
    if(/^(article:published_time|datepublished|pubdate|date)$/i.test(attr(meta,'property')??attr(meta,'itemprop')??attr(meta,'name')??'')) {
      const date=isoDate(attr(meta,'content')??'');if(date)return date;
    }
  }
  for(const time of all(root,node=>node.tag==='time')) {
    const date=isoDate(attr(time,'datetime')??plain(text(time)));if(date)return date;
  }
  for(const header of all(root,node=>node.tag==='header'||classMatch(node,/entry-meta|post-meta|elementor-post-info|post-date|post_date|entry-date|posted-on/i))) {
    const date=isoDate(plain(text(header)).slice(0,750));if(date)return date;
  }
  // Never infer a publication date from an event date mentioned in article prose.
  return null;
}
export function billIds(value:string):string[] {
  const result=new Set<string>();
  const regex=/\b(H\s*\.?\s*F\.?|S\s*\.?\s*F\.?|House\s+File|Senate\s+File)\s*(?:No\.?\s*)?#?\s*(\d{1,5})\b/gi;
  for(const m of value.matchAll(regex))result.add((/^(h|house)/i.test(m[1])?'HF ':'SF ')+Number(m[2]));
  return [...result];
}
export function namedSenators(value:string):string[] {
  const names=new Set<string>(),stop=/^(Calls|Says|Announces|Highlights|Reflects|Statement|Responds|Applauds|Joins|Urges|Supports|Welcomes|Introduces|Releases|Today|Minnesota|Senate|Committee|DFL|Republican)$/;
  for(const match of value.matchAll(/\b(?:Senator|Sen\.)\s+([A-Z][A-Za-z’'-]+(?:\s+(?:[A-Z][A-Za-z’'-]+|[A-Z]\.)){0,3})/g)) {
    const tokens=match[1].split(/\s+/);
    while(tokens.length>1 && stop.test(tokens[tokens.length-1]))tokens.pop();
    if(tokens.join(' ').length>2)names.add(tokens.join(' '));
  }
  // Plural press headers sometimes name two senators after a single prefix.
  for(const match of value.matchAll(/\b(?:Sens\.|Senators)\s+([A-Z][a-z’'-]+\s+[A-Z][a-z’'-]+)\s*(?:,|and|&)\s*([A-Z][a-z’'-]+\s+[A-Z][a-z’'-]+)/g)) {
    names.add(match[1]);names.add(match[2]);
  }
  return [...names];
}
export function parseArticle(html:string,source:SenatePressSource,requestedUrl:string,fetchedAt:string):RawSenateStatement|null {
  const root=htmlTree(html);
  const heading=all(root,node=>node.tag==='h1')[0]??
    all(root,node=>/^h[23]$/.test(node.tag)&&classMatch(node,/entry-title|post_title/i))[0];
  const title=heading?plain(text(heading)):'';
  if(!title)return null;
  const containers=all(root,node=>node.tag==='article'||node.tag==='main'||
    classMatch(node,/entry-content|post-content|post_content|article-content|elementor-widget-theme-post-content|et_pb_post_content|wp-block-post-content/i));
  const priority=(n:HtmlNode)=>classMatch(n,/elementor-widget-theme-post-content|wp-block-post-content|et_pb_post_content/i)?100:
    classMatch(n,/entry-content|article-content|post_content/i)?90:classMatch(n,/post-content/i)?80:n.tag==='article'?50:20;
  containers.sort((a,b)=>priority(b)-priority(a));
  const raw_text=containers.map(node=>plain(text(node,true))).find(x=>x.length>=10)??'';
  if(raw_text.length<10)return null; // no excerpts-only substitutions
  const canonical=all(root,node=>node.tag==='link'&&attr(node,'rel')==='canonical')[0];
  const source_url=(canonical && onSiteArticle(attr(canonical,'href')??'',source))||onSiteArticle(requestedUrl,source);
  if(!source_url)return null;
  return {source_id:source.id,source_type:source.source_type,source_url,fetched_at:fetchedAt,
    published_on:publicationDate(root),title,
    named_senators:namedSenators(raw_text+'\n'+title),
    bill_identifiers:billIds(raw_text),raw_text};
}
export function archivePageUrl(source:SenatePressSource,page:number):string {
  if(!Number.isSafeInteger(page)||page<1)throw Error('Invalid archive page');
  const url=new URL(source.archive_url);
  if(page>1) {
    if(source.pagination.kind==='query')url.searchParams.set(source.pagination.key,String(page));
    else url.pathname=url.pathname.replace(/\/+$/,'')+'/'+source.pagination.segment+'/'+page+'/';
  }
  return url.href;
}

interface Rule {allow:boolean;pattern:string}
interface Group {agents:string[];rules:Rule[];delay:number}
export function robotsPolicy(content:string,bot='VotePredictRawCollector'):{allows:(url:URL)=>boolean;crawlDelayMs:number} {
  const groups:Group[]=[];let group:Group={agents:[],rules:[],delay:0},hadRule=false;
  const flush=()=>{if(group.agents.length)groups.push(group);group={agents:[],rules:[],delay:0};hadRule=false;};
  for(const line of content.split(/\r?\n/)) {
    const clean=line.replace(/#.*$/,'').trim();
    if(!clean){if(hadRule)flush();continue;}
    const m=/^([\w-]+)\s*:\s*(.*)$/.exec(clean);if(!m)continue;
    const key=m[1].toLowerCase(),value=m[2].trim();
    if(key==='user-agent'){if(hadRule)flush();group.agents.push(value.toLowerCase());}
    else if(group.agents.length) {
      hadRule=true;
      if((key==='allow'||key==='disallow')&&value)group.rules.push({allow:key==='allow',pattern:value});
      if(key==='crawl-delay'&&Number.isFinite(Number(value))&&Number(value)>=0)group.delay=Number(value);
    }
  }
  flush();
  const specific=groups.filter(x=>x.agents.some(a=>a!=='*'&&bot.toLowerCase().includes(a)));
  const selected=specific.length?specific:groups.filter(x=>x.agents.includes('*'));
  const rules=selected.flatMap(x=>x.rules);
  return {
    crawlDelayMs:Math.min(60000,Math.max(0,...selected.map(x=>x.delay*1000))),
    allows:(url:URL)=>{
      const path=url.pathname+url.search;let best=-1,allowed=true;
      for(const rule of rules) {
        const p=rule.pattern.replace(/\$$/,'');
        const escaped=p.split('*').map(part=>part.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&')).join('.*');
        const regex=new RegExp('^'+escaped+(rule.pattern.endsWith('$')?'$':''));
        if(!regex.test(path))continue;
        const specificity=p.replace(/\*/g,'').length;
        if(specificity>best||(specificity===best&&rule.allow)){best=specificity;allowed=rule.allow;}
      }
      return allowed;
    },
  };
}
class PoliteFetcher {
  private last=0;
  private policy?:ReturnType<typeof robotsPolicy>;
  constructor(private readonly origin:string,private readonly delayMs:number,private readonly request:typeof fetch){}
  private async send(url:URL,hops=0,attempt=0):Promise<Response> {
    if(url.origin!==this.origin||url.protocol!=='https:'||hops>4)throw Error('Off-site or redirect-loop URL refused');
    const remaining=Math.max(0,this.last+Math.max(this.delayMs,this.policy?.crawlDelayMs??0)-Date.now());
    if(remaining)await sleep(remaining);
    this.last=Date.now();
    const response=await this.request(url.href,{
      headers:{'User-Agent':'VotePredictRawCollector/1.0 (first-party-public-archive)',Accept:'text/html,text/plain;q=0.9'},
      redirect:'manual',signal:AbortSignal.timeout(20000),cache:'no-store',
    });
    if([301,302,307,308].includes(response.status)){
      const location=response.headers.get('location');if(!location)throw Error('Redirect without location');
      const next=new URL(location,url);
      if(next.origin!==this.origin||next.href===url.href||this.policy&&!this.policy.allows(next))throw Error('Unsafe or disallowed redirect');
      return this.send(next,hops+1,0);
    }
    if(response.status===503 && attempt<2) {
      // One briefly unavailable page is not archive exhaustion. Retry slowly,
      // but do not ignore the publisher's longer Retry-After instruction.
      const retryAfter=response.headers.get('retry-after');
      const seconds=retryAfter && /^\\d{1,5}$/.test(retryAfter) ? Number(retryAfter) : 0;
      if(seconds<=30) {
        await sleep(Math.max(10000*(attempt+1),seconds*1000));
        return this.send(url,hops,attempt+1);
      }
    }
    if([429,503].includes(response.status)){
      // Never keep crawling once the publisher is signaling sustained rate limiting.
      throw Error('Publisher rate-limited collection (HTTP '+response.status+')');
    }
    return response;
  }
  async init():Promise<void> {
    const response=await this.send(new URL('/robots.txt',this.origin));
    if(response.status===404)this.policy=robotsPolicy('');
    else if(response.ok)this.policy=robotsPolicy(await response.text());
    else throw Error('robots.txt unavailable (HTTP '+response.status+'); refusing collection');
  }
  async html(url:string):Promise<string> {
    if(!this.policy)throw Error('robots.txt not checked');
    const target=new URL(url);
    if(target.origin!==this.origin||!this.policy.allows(target))throw Error('robots.txt disallows URL');
    const response=await this.send(target);
    if(!response.ok)throw Error('HTTP '+response.status);
    if(!/html|text\/plain/i.test(response.headers.get('content-type')??''))throw Error('Non-HTML response');
    return response.text();
  }
}
export async function collectSource(
  source:SenatePressSource,window:CollectionWindow,sink:StatementSink,request:typeof fetch=fetch,
):Promise<SourceCounts> {
  const result:SourceCounts={source:source.id,source_type:source.source_type,from:window.from,to:window.to,
    pages:0,discovered:0,matched:0,inserted:0,previewed:0,already_present:0,outside_range:0,
    undated:0,by_year:{},member_archives:[],archive_gaps:[],failures:[]};
  const failed=(url:string,error:unknown)=>result.failures.push({url,reason:error instanceof Error?error.message:String(error)});
  const fetcher=new PoliteFetcher(new URL(source.archive_url).origin,
    request===fetch ? Math.max(1250,window.delayMs??1500) : Math.max(0,window.delayMs??0),request);
  try{await fetcher.init();}catch(error){failed(source.archive_url,error);return result;}
  const visited=new Set<string>(),authorArchives=new Set<string>();
  const maxConsecutiveGaps = 25; // Allows recovery when a run of older DFL pages is unavailable.
  let olderPages=0,stopForRateLimit=false,knownLastPage:number|null=null,consecutiveGaps=0;
  for(let page=1;page<=(window.maxPages??1000);page++){
    if(window.maxItems&&result.matched>=window.maxItems)break;
    const listing=archivePageUrl(source,page);let html:string;
    try{html=await fetcher.html(listing);}catch(error){
      // Never keep crawling a publisher that signals a rate limit.
      if(error instanceof Error && error.message.includes('Publisher rate-limited')){
        failed(listing,error);break;
      }
      // A page error before the publisher's announced last page is a gap, not exhaustion.
      if(page>1 && error instanceof Error && error.message==='HTTP 404' &&
        (knownLastPage===null || page>knownLastPage))break;
      failed(listing,error);
      if(knownLastPage!==null && page<knownLastPage && consecutiveGaps<maxConsecutiveGaps) {
        result.archive_gaps.push(page);consecutiveGaps++;continue;
      }
      break;
    }
    result.pages++;
    for(const url of authorArchivesFromListing(html,source))authorArchives.add(url);
    const last=lastArchivePageFromListing(html,source);
    if(last!==null)knownLastPage=Math.max(knownLastPage??0,last);
    let fresh=articleUrlsFromListing(html,source).filter(url=>!visited.has(url));
    if(!fresh.length && (page===1 || (knownLastPage!==null && page<knownLastPage))) {
      // A transient blank/challenge page was the original silent 2026-only backfill cause.
      // Retry twice with the same robots-protected, paced fetcher before recording a gap.
      for(let retry=0;retry<2 && !fresh.length;retry++) {
        try {
          const second=await fetcher.html(listing);
          for(const url of authorArchivesFromListing(second,source))authorArchives.add(url);
          fresh=articleUrlsFromListing(second,source).filter(url=>!visited.has(url));
        }catch(error) {
          if(error instanceof Error && error.message.includes('Publisher rate-limited')){
            failed(listing,error);stopForRateLimit=true;break;
          }
        }
      }
    }
    if(stopForRateLimit)break;
    if(!fresh.length){
      if(page===1)failed(listing,Error('First archive page did not contain any published headline links'));
      if(knownLastPage!==null && page<knownLastPage){
        failed(listing,Error('Archive page unexpectedly omitted linked articles'));
        result.archive_gaps.push(page);
        if(++consecutiveGaps<=maxConsecutiveGaps)continue;
      }
      break;
    }
    consecutiveGaps=0;
    for(const url of fresh)visited.add(url);
    result.discovered+=fresh.length;
    let existing:ReadonlySet<string>;
    try{existing=await sink.existing(fresh);}catch(error){failed(listing,error);break;}
    let dated=0,older=0;
    for(const url of fresh) {
      if(window.maxItems&&result.matched>=window.maxItems)break;
      if(existing.has(url)){result.already_present++;continue;}
      try{
        const item=parseArticle(await fetcher.html(url),source,url,new Date().toISOString());
        if(!item){failed(url,Error('Full article text/title missing'));continue;}
        if(item.published_on){
          dated++;
          if(item.published_on<window.from)older++;
          if(item.published_on<window.from||item.published_on>window.to){result.outside_range++;continue;}
        }else result.undated++;
        result.matched++;
        const year=item.published_on?.slice(0,4)??'undated';
        result.by_year[year]=(result.by_year[year]??0)+1;
        if(window.dryRun)result.previewed++;
        else if(await sink.insert(item))result.inserted++;
        else result.already_present++;
      }catch(error){
        failed(url,error);
        if(error instanceof Error && error.message.includes('Publisher rate-limited')){
          stopForRateLimit=true;break;
        }
      }
    }
    if(stopForRateLimit)break;
    // Verified archive ordering: newest first. Two fully older pages stop traversal.
    olderPages=fresh.length===dated&&dated===older?olderPages+1:0;
    if(olderPages>=2)break;
  }
  result.member_archives=[...authorArchives];
  return result;
}

/** Re-fetch one known missed publication with source allowlist, robots and insert-only sink. */
export async function collectDirectArticle(
  source:SenatePressSource,url:string,window:CollectionWindow,sink:StatementSink,
  request:typeof fetch=fetch,
):Promise<{inserted:number;already_present:number;failures:Array<{url:string;reason:string}>}> {
  const result:{inserted:number;already_present:number;failures:Array<{url:string;reason:string}>}={
    inserted:0,already_present:0,failures:[],
  };
  if(onSiteArticle(url,source)!==url)throw Error('Direct article URL outside first-party source allowlist');
  const fetcher=new PoliteFetcher(new URL(source.archive_url).origin,
    request===fetch ? Math.max(1250,window.delayMs??1500) : Math.max(0,window.delayMs??0),request);
  try{
    await fetcher.init();
    if((await sink.existing([url])).has(url)){result.already_present=1;return result;}
    const item=parseArticle(await fetcher.html(url),source,url,new Date().toISOString());
    if(!item)throw Error('Full article text/title missing');
    if(item.published_on && (item.published_on<window.from||item.published_on>window.to))
      throw Error('Direct article publication date outside reviewed range');
    if(window.dryRun)result.inserted=1;
    else if(await sink.insert(item))result.inserted=1;
    else result.already_present=1;
  }catch(error){result.failures.push({url,reason:error instanceof Error?error.message:'Direct article failed'});}
  return result;
}
export async function discoverRepublicanMemberPages(
  source:SenatePressSource,request:typeof fetch=fetch,
):Promise<SenatePressSource[]> {
  if(source.id!=='senate_republicans')throw Error('Unexpected member-directory source');
  const directory=new URL('/senators/',new URL(source.archive_url).origin);
  const fetcher=new PoliteFetcher(directory.origin,request===fetch?1500:0,request);
  await fetcher.init();
  return memberPagesFromDirectory(await fetcher.html(directory.href),source);
}
