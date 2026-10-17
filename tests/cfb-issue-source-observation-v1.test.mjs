import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 validateCfbIssueSourceManifest,robotsAllows,fetchCfbIssueSource
} from '../src/evidence/cfb-issue-source-observation-v1.mjs';
import {safeSourceCaptureCounts}
 from '../scripts/capture-cfb-issue-source-observations-protected.mjs';

const fixture={id:'mn-aflcio-synthetic-test',
 organizationGroup:'Minnesota AFL-CIO',
 role:'first_party_issue_publication',
 url:'https://mnaflcio.org/news'};
const html='<!doctype html><html><head><title>Test original</title></head><body>'+
 'Original publisher content for a test bill, not a real stance.'.repeat(3)+
 '</body></html>';
const mock=(robots,source=html,opts={})=>async(url)=>{
 if(url.endsWith('/robots.txt'))
  return new Response(robots,{status:opts.robotsStatus??200,
   headers:{'content-type':'text/plain'}});
 if(opts.redirect)return new Response('',{status:302,
  headers:{location:opts.redirect}});
 return new Response(source,{status:opts.status??200,
  headers:{'content-type':opts.contentType??'text/html; charset=utf-8'}});
};
const options={sleep:async()=>{},
 now:()=>'2026-10-17T02:01:00Z'};
test('manifest stays bounded to original approved HTTPS domains and roles',()=>{
 const m=JSON.parse(readFileSync(
  'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8'));
 const sources=validateCfbIssueSourceManifest(m);
 assert.equal(sources.length,10);
 assert.equal(new Set(sources.map(x=>x.url)).size,10);
 assert.throws(()=>validateCfbIssueSourceManifest({...m,sources:[
  {...fixture,url:'https://evil.example/source'},...sources
 ]}),/Unsafe/);
 assert.throws(()=>validateCfbIssueSourceManifest({...m,sources:[
  {...fixture,url:'http://mnaflcio.org/news'},...sources
 ]}),/Unsafe/);
 assert.throws(()=>validateCfbIssueSourceManifest({...m,sources:[
  {...fixture,role:'certified_historical_position'},...sources
 ]}),/Unsafe/);
});
test('robots longest matching path, specific agent and Allow precedence',()=>{
 assert.equal(robotsAllows('User-agent: *\nDisallow: /news','/news'),false);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /news\nAllow: /news/public',
  '/news/public/release'),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: VotePredictEvidenceBot\nAllow: /news',
  '/news'),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /news\nAllow: /news/allowed$',
  '/news/allowed'),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /news\nAllow: /news/allowed$',
  '/news/allowed/child'),false);
});
test('eligible fetch stores ORIGINAL bytes/hash and conservative observation time',async()=>{
 const r=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:mock('User-agent: *\nDisallow: /blocked\n')
 });
 assert.equal(r.status,'captured');
 assert.equal(r.snapshot.observedAt,options.now());
 assert.equal(r.snapshot.htmlSha256,createHash('sha256').update(html).digest('hex'));
 assert.equal(r.snapshot.rawHtmlBytes.toString('utf8'),html);
 assert.equal(r.snapshot.historicalAsOfEligible,false);
 assert.equal(r.snapshot.mechanicallyActionable,false);
 assert.equal(r.snapshot.modelWeight,0);
 assert.equal(r.snapshot.claimStatus,'unverified_raw_observation');
});
test('never fetch a robots-disallowed page or unavailable robots origin',async()=>{
 let hits=0;
 const deny=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:async(url)=>{
   hits++;
   assert.equal(url,'https://mnaflcio.org/robots.txt');
   return new Response('User-agent: *\nDisallow: /news');
  }
 });
 assert.equal(deny.status,'robots_disallowed');
 assert.equal(hits,1);
 const unknown=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:async()=>{throw Error('Temporary upstream failure');}
 });
 assert.equal(unknown.status,'robots_unavailable');
});
test('404 robots means no published exclusion, 500 means fail closed',async()=>{
 const allow=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:mock('',html,{robotsStatus:404})
 });
 assert.equal(allow.status,'captured');
 const blocked=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:mock('',html,{robotsStatus:500})
 });
 assert.equal(blocked.status,'robots_unavailable');
});
test('reject unsafe redirects, disallowed destinations, and content not HTML',async()=>{
 const redirected=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:mock('User-agent: *\nAllow: /',html,
   {redirect:'https://evil.example/same-bill'})
 });
 assert.equal(redirected.status,'fetch_unavailable');
 const destination=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:mock('User-agent: *\nDisallow: /secret',
   html,{redirect:'https://mnaflcio.org/secret'})
 });
 assert.equal(destination.status,'fetch_unavailable');
 const notHtml=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:mock('User-agent: *\nAllow: /',
   '%PDF pretend',{contentType:'application/pdf'})
 });
 assert.equal(notHtml.status,'unsupported_content_type');
});
test('abort oversized source and reject non-UTF8 without side effects',async()=>{
 const big=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:mock('User-agent: *\nAllow: /','z'.repeat(800010))
 });
 assert.equal(big.status,'source_oversize');
 const bad=await fetchCfbIssueSource(fixture,{
  ...options,fetcher:async(url)=>new Response(
   url.endsWith('robots.txt')?'User-agent: *\nAllow: /':
    Uint8Array.from([255,255,255,255,255,255]),
   {headers:{'content-type':url.endsWith('robots.txt')?'text/plain':'text/html'}}
  )
 });
 assert.equal(bad.status,'non_utf8');
});
test('production safe summaries contain only aggregate statuses',()=>{
 const r=safeSourceCaptureCounts([{status:'captured'},{status:'captured'},
  {status:'robots_disallowed'}]);
 assert.deepEqual(r,{captured:2,robots_disallowed:1});
 assert.throws(()=>safeSourceCaptureCounts([{status:'my private site'}]));
});
test('additive SQL remains raw-only and does not change historical published_at',()=>{
 const ddl=readFileSync('migrations/0031_cfb_issue_finance_source_observations.sql','utf8');
 assert.match(ddl,/CREATE TABLE IF NOT EXISTS cfb_issue_finance_source_observations/);
 assert.match(ddl,/historical_asof_eligible boolean NOT NULL DEFAULT false CHECK/);
 assert.match(ddl,/raw_html_bytes bytea/);
 assert.doesNotMatch(ddl,/\bUPDATE\s+(?:evidence_items|forecasts|senate_scorecard_snapshots)\b/i);
});
