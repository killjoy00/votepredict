/** Keyless check of actual first-party senator/member listings before Neon writes. */
import { readFileSync } from 'node:fs';
import {
  discoverRepublicanMemberPages, collectSource, robotsPolicy, type SenatePressSource,
} from '../src/sources/minnesota/senate-press-raw.js';

async function probeDFLFeed():Promise<void>{
  const origin='https://senatedfl.mn';
  try {
    const robotsResponse=await fetch(origin+'/robots.txt',{redirect:'manual',
      signal:AbortSignal.timeout(15000)});
    const robots=robotsResponse.ok?robotsPolicy(await robotsResponse.text()):
      robotsResponse.status===404?robotsPolicy(''):null;
    if(!robots){console.log('SENATE_DFL_FEED_PROBE=robots_unavailable');return;}
    for(const pathname of ['/feed/','/feed/?paged=10','/author/senboldon/feed/']){
      const url=new URL(pathname,origin);
      if(!robots.allows(url)){console.log('SENATE_DFL_FEED_PROBE=robots_disallow_'+pathname);continue;}
      const response=await fetch(url.href,{
        headers:{'User-Agent':'VotePredictRawCollector/1.0 (first-party-public-archive)',
          Accept:'application/rss+xml,application/xml,text/xml;q=0.9'},
        redirect:'manual',signal:AbortSignal.timeout(15000),cache:'no-store'});
      const text=response.ok?await response.text():'';
      console.log('SENATE_DFL_FEED_PROBE='+JSON.stringify({
        path:pathname,status:response.status,type:response.headers.get('content-type'),
        bytes:text.length,items:(text.match(/<item\\b/gi)??[]).length,
        hasFullContent:text.includes('<content:encoded>'),
      }));
      await new Promise(resolve=>setTimeout(resolve,1500));
    }
  }catch(error){
    console.log('SENATE_DFL_FEED_PROBE_ERROR='+(error instanceof Error?error.message:'probe failed'));
  }
}
async function main():Promise<void>{
  const raw:unknown=JSON.parse(readFileSync('data/senate-press-sources.json','utf8'));
  if(!Array.isArray(raw)||raw.length!==2)throw Error('Unexpected source catalog size');
  const dfl=raw.find((x:SenatePressSource)=>x.id==='senate_dfl') as SenatePressSource;
  const gop=raw.find((x:SenatePressSource)=>x.id==='senate_republicans') as SenatePressSource;
  if(dfl.archive_url!=='https://senatedfl.mn/press-releases/'
    || gop.archive_url!=='https://www.mnsenaterepublicans.com/news/')
    throw Error('Unexpected first-party source origins');
  const profilePages=await discoverRepublicanMemberPages(gop);
  console.log('SENATE_GOP_MEMBER_SOURCE='+JSON.stringify({linkedProfiles:profilePages.length}));
  if(profilePages.length<20||profilePages.length>90)
    throw Error('Senate GOP profile listing missing or unreasonably sized');
  const dflPreview=await collectSource(dfl,{
    from:'2023-01-01',to:new Date().toISOString().slice(0,10),
    maxPages:3,dryRun:true,delayMs:1500,
  },{existing:async()=>new Set<string>(),insert:async()=>true});
  // One intermittently blank DFL archive page should not hide other real pages.
  // The keyless gate still requires actual published articles and senator links.
  console.log('SENATE_DFL_ARCHIVE_SMOKE='+JSON.stringify({pages:dflPreview.pages,discovered:dflPreview.discovered,authors:dflPreview.member_archives.length,gaps:dflPreview.archive_gaps.length,failures:dflPreview.failures.map(f=>f.reason).slice(0,3)}));
  if(!dflPreview.member_archives.length||dflPreview.discovered<1||
    dflPreview.failures.some(f=>/rate-limited|robots\.txt/i.test(f.reason))) {
    await probeDFLFeed();
    throw Error('DFL first-party release/author listing unavailable');
  }
  console.log('SENATE_MEMBER_LISTING_SMOKE='+JSON.stringify({
    gopMemberPages:profilePages.length,
    dflNamedAuthorArchives:dflPreview.member_archives.length,
    dflRecentArticles:dflPreview.discovered,
    dflIntermittentArchiveGaps:dflPreview.archive_gaps.length,
  }));
}
void main().catch((error:unknown)=>{
  console.error('SENATE_MEMBER_LISTING_SMOKE_FAILED='+(
    error instanceof Error?error.message:'unknown source probe failure'));
  process.exitCode=1;
});
