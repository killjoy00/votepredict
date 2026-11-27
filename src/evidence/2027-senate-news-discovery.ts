import { canonicalPublicUrl,type PublicPage } from './public-http';
import { COLLECTION_LIMITS } from '@/sources/minnesota/2027-collection-source';

export const SENATE_NEWS_INDEXES=['https://senatedfl.mn/press-releases/','https://www.mnsenaterepublicans.com/news/'] as const;
export type SenateNewsIndex=(typeof SENATE_NEWS_INDEXES)[number];
export type SenateNewsLink={url:string;rank:number};
const ignored=new Set(['press-releases','news','senators','about','home','contact','donate','privacy-policy','terms-of-service','leadership','committees','issues','resources','accomplishments','search','sitemap','subscribe','events']);
export function senateNewsKey(value:string):string {
  const url=new URL(value);
  return url.origin+url.pathname.replace(/\/$/,'');
}
export function isSenateNewsArticleUrl(value:string,index:SenateNewsIndex):boolean {
  let url:URL;try{url=new URL(value);}catch{return false;}
  const slug=url.pathname.replace(/^\/|\/$/g,'');
  return url.origin===new URL(index).origin&&!url.search&&!url.hash&&!url.username&&!url.password&&
    /^[a-z0-9][a-z0-9-]{2,199}$/.test(slug)&&slug.includes('-')&&!ignored.has(slug)&&
    !/^(?:author|category|tag|topic|page|wp-|home-|privacy-|terms-)/.test(slug);
}
/** Both original publisher indexes render article-title links as headings.
 * Never turn a surname, title, caucus, or a navigation link into an attribution. */
export function discoverSenateIndexArticles(page:Pick<PublicPage,'rawContent'|'canonicalUrl'>):SenateNewsLink[]{
  const index=SENATE_NEWS_INDEXES.find(x=>x===page.canonicalUrl);
  if(!index)throw Error('Unknown Senate news index');
  const html=page.rawContent.replace(/<!--[\s\S]*?-->|<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  const matches:{offset:number;href:string}[]=[];
  for(const h of html.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)){
    const a=/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/i.exec(h[2]);
    if(a)matches.push({offset:h.index??0,href:a[1]});
  }
  for(const a of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>\s*<h[2-4]\b[^>]*>/gi))
    matches.push({offset:a.index??0,href:a[1]});
  const seen=new Set<string>(),result:SenateNewsLink[]=[];
  for(const {href} of matches.sort((a,b)=>a.offset-b.offset)){
    let url:string;try{url=canonicalPublicUrl(href.replaceAll('&amp;','&'),index);}catch{continue;}
    if(!isSenateNewsArticleUrl(url,index))continue;
    const key=senateNewsKey(url);
    if(seen.has(key))continue;
    seen.add(key);result.push({url,rank:result.length});
    if(result.length===100)break;
  }
  if(!result.length)throw Error('Senate index article heading shape unverified');
  return result;
}
export function chooseSenateIndexArticles(links:readonly SenateNewsLink[],observed:ReadonlySet<string>,attempts:ReadonlyMap<string,string>,limit:number){
  if(!Number.isInteger(limit)||limit<1||limit>COLLECTION_LIMITS.senateNewsArticlesPerIndex)throw Error('Invalid Senate news index batch');
  return links.filter(x=>!observed.has(senateNewsKey(x.url))).sort((a,b)=>
    (attempts.get(senateNewsKey(a.url))??'').localeCompare(attempts.get(senateNewsKey(b.url))??'')||
    a.rank-b.rank||a.url.localeCompare(b.url)).slice(0,limit);
}
/** Metadata publication is a publisher claim, not proof of historical availability.
 * Absent/ambiguous dates require review; don't use an acquisition timestamp as publication. */
export function senateArticleDateStatus(publishedAt:string|undefined,observedAt:string){
  const observed=Date.parse(observedAt),claimed=publishedAt?Date.parse(publishedAt):NaN;
  if(!Number.isFinite(observed)||!Number.isFinite(claimed)||claimed>observed)return 'publication_unverified' as const;
  if(claimed<Date.parse('2027-01-12T06:00:00.000Z'))return 'outside_session' as const;
  return 'current_session_claimed' as const;
}
