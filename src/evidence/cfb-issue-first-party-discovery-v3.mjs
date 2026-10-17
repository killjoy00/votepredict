/**
 * #864 bounded prospective discovery from a freshly observed FIRST-PARTY
 * release index. The output is only a list of URLs to independently fetch
 * under the existing robots-aware raw HTML collector. No stance extraction,
 * historical publication claim, donor mapping or model integration.
 */
import {createHash} from 'node:crypto';

export const CFB_ISSUE_DISCOVERY_SCHEMA='cfb-issue-first-party-discovery-v3';
const INDEX_ID='education-mn-media-releases-index';
const INDEX_URL='https://educationminnesota.org/news/media-resources/';
const GROUP='Education Minnesota';
const PREFIX='/news/press-release/';
const ID_PREFIX='education-mn-release-';
const MAX_PAGES=8;
const HASH=/^[0-9a-f]{64}$/;
const UTC=/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;

export function validateCfbIssueDiscoveryPolicy(policy,manifest){
 if(policy?.schemaVersion!==CFB_ISSUE_DISCOVERY_SCHEMA||
  !Array.isArray(policy.discoverySources)||policy.discoverySources.length!==1||
  !Array.isArray(manifest))throw Error('Unreviewed first-party discovery policy');
 const source=policy.discoverySources[0];
 if(source?.indexSourceId!==INDEX_ID||source.indexUrl!==INDEX_URL||
  source.organizationGroup!==GROUP||source.articlePathPrefix!==PREFIX||
  source.articleSourceIdPrefix!==ID_PREFIX||
  !Number.isInteger(source.maxArticlesPerRun)||
  source.maxArticlesPerRun<1||source.maxArticlesPerRun>MAX_PAGES)
  throw Error('Unreviewed first-party discovery bounds');
 const pinned=manifest.find(x=>x.id===source.indexSourceId);
 if(!pinned||pinned.url!==source.indexUrl||
  pinned.organizationGroup!==source.organizationGroup||
  pinned.role!=='first_party_historical_context')
  throw Error('Original first-party discovery index not pinned in manifest');
 return Object.freeze({...source});
}
function sourceIndexIsOriginal(snapshot,source){
 if(!snapshot||snapshot.sourceId!==source.indexSourceId||
  snapshot.sourceUrl!==source.indexUrl||
  snapshot.finalUrl!==source.indexUrl||
  snapshot.organizationGroup!==source.organizationGroup||
  snapshot.sourceRole!=='first_party_historical_context'||
  !Buffer.isBuffer(snapshot.rawHtmlBytes)||
  snapshot.rawHtmlBytes.length<100||snapshot.rawHtmlBytes.length>800000||
  !HASH.test(snapshot.htmlSha256??'')||!UTC.test(snapshot.observedAt??'')||
  !Number.isFinite(Date.parse(snapshot.observedAt))||
  snapshot.claimStatus!=='unverified_raw_observation'||
  snapshot.historicalAsOfEligible!==false||
  snapshot.mechanicallyActionable!==false||
  Number(snapshot.modelWeight)!==0)return false;
 return createHash('sha256').update(snapshot.rawHtmlBytes).digest('hex')===
  snapshot.htmlSha256;
}
function canonicalArticle(href,indexUrl){
 if(typeof href!=='string'||href.length>1024||
  /[\x00-\x1f\\]/.test(href))return null;
 try{
  const u=new URL(href,indexUrl);
  if(u.protocol!=='https:'||u.origin==='null'||
   u.hostname!=='educationminnesota.org'||
   u.port||u.username||u.password||u.search||u.hash||
   !/^\/news\/press-release\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(u.pathname))
   return null;
  return u.href;
 }catch{return null;}
}
function linksFromOriginal(html){
 // Only actual anchor href attributes. No plain text, script strings,
 // third-party URLs or synthetic site-search permutations become sources.
 const links=[];
 const markup=html.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)\s*>/gi,' ');
 for(const tag of markup.match(/<a\b[^>]{0,2048}>/gi)??[]){
  const m=/(?:^|\s)href\s*=\s*(?:"([^"]{1,1024})"|'([^']{1,1024})')/i.exec(tag);
  if(m)links.push(m[1]??m[2]);
  if(links.length>=1500)break;
 }
 return links;
}
export function discoverCfbIssueFirstPartyPages({
 indexSnapshots,manifest,policy
}){
 const source=validateCfbIssueDiscoveryPolicy(policy,manifest);
 if(!Array.isArray(indexSnapshots)||indexSnapshots.length>12)
  throw Error('Expected bounded fresh originals');
 const selected=indexSnapshots.filter(x=>x.sourceId===source.indexSourceId);
 if(!selected.length)return [];
 // Fresh observation ambiguity is held, not silently resolved by picking
 // one page's links. Fetching is done once per pinned index each run.
 if(selected.length!==1||!sourceIndexIsOriginal(selected[0],source))
  throw Error('Unsafe original first-party release index');
 const html=selected[0].rawHtmlBytes.toString('utf8');
 const seen=new Set(manifest.map(x=>x.url));
 const pages=[];
 for(const link of linksFromOriginal(html)){
  const url=canonicalArticle(link,source.indexUrl);
  if(!url||seen.has(url))continue;
  seen.add(url);
  const id=source.articleSourceIdPrefix+
   createHash('sha256').update(url).digest('hex').slice(0,24);
  if(manifest.some(x=>x.id===id))throw Error('Discovered source ID collision');
  pages.push({
   id,organizationGroup:source.organizationGroup,
   role:'first_party_issue_publication',url
  });
  if(pages.length===source.maxArticlesPerRun)break;
 }
 return pages;
}
