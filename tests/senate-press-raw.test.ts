import assert from 'node:assert/strict';
import {test} from 'node:test';
import {archivePageUrl,articleUrlsFromListing,billIds,namedSenators,parseArticle,robotsPolicy,type SenatePressSource}
  from '../src/sources/minnesota/senate-press-raw.js';

const dfl:SenatePressSource={id:'senate_dfl',source_type:'senate_dfl_caucus_and_members',
  archive_url:'https://senatedfl.mn/press-releases/',pagination:{kind:'query',key:'_page'}};
const gop:SenatePressSource={id:'senate_republicans',source_type:'senate_republican_caucus_and_members',
  archive_url:'https://www.mnsenaterepublicans.com/news/',pagination:{kind:'path',segment:'page'}};

test('real archive pagination patterns',()=>{
  assert.equal(archivePageUrl(dfl,1),'https://senatedfl.mn/press-releases/');
  assert.equal(archivePageUrl(dfl,2),'https://senatedfl.mn/press-releases/?_page=2');
  assert.equal(archivePageUrl(gop,2),'https://www.mnsenaterepublicans.com/news/page/2/');
});
test('listing parser excludes offsite navigation and archive links',()=>{
  const html='<nav><h3><a href="/donate/">Donate today and sign up</a></h3></nav>'+
    '<h3><a href="/senator-erin-murphy-statement/">Senator Erin Murphy Statement</a></h3>'+
    '<h3><a href="/press-releases/?_page=2">See more press releases</a></h3>'+
    '<h3><a href="https://example.com/not-senate">External article about the Senate</a></h3>';
  assert.deepEqual(articleUrlsFromListing(html,dfl),
    ['https://senatedfl.mn/senator-erin-murphy-statement/']);
});
test('article body, shown publication date, named senator and bill numbers',()=>{
  const html='<html><head><meta property="article:published_time" content="2025-04-17T15:00:00Z">'+
    '<link rel="canonical" href="https://senatedfl.mn/senator-test-sf123/" /></head>'+
    '<body><main><article><h1>Senator Liz Boldon Statement</h1>'+
    '<div class="elementor-widget-theme-post-content"><p>Senator Liz Boldon said SF 123 is included.</p>'+
    '<p>House File 456 was also mentioned. Here is the full second paragraph.</p></div>'+
    '<aside>Unrelated footer</aside></article></main></body></html>';
  const parsed=parseArticle(html,dfl,'https://senatedfl.mn/senator-test-sf123/','2026-10-15T00:00:00Z');
  assert.ok(parsed);
  assert.equal(parsed.published_on,'2025-04-17');
  assert.deepEqual(parsed.bill_identifiers,['SF 123','HF 456']);
  assert.ok(parsed.raw_text.includes('Here is the full second paragraph.'));
  assert.equal(parsed.raw_text.includes('Unrelated footer'),false);
  assert.ok(parsed.named_senators.includes('Liz Boldon'));
});
test('unpublished dates stay null; no authored or stance assertions',()=>{
  const html='<main><article><h1>Local Op-Ed</h1><div class="entry-content">'+
    '<p>Sen. John Jasinski shared this story with constituents.</p>'+
    '<p>That is the full published text, not an authors policy classification.</p>'+
    '</div></article></main>';
  const parsed=parseArticle(html,gop,'https://www.mnsenaterepublicans.com/local-op-ed/',new Date().toISOString());
  assert.ok(parsed);
  assert.equal(parsed.published_on,null);
  assert.ok(parsed.named_senators.includes('John Jasinski'));
  assert.deepEqual(billIds('S.F. No. 18 / H.F. 200 and Senate File 18'),['SF 18','HF 200']);
  assert.ok(namedSenators('Senator Erin Murphy spoke.').includes('Erin Murphy'));
});
test('robots longest rule wins and crawl-delay is observed',()=>{
  const rules=robotsPolicy('User-agent: *\nDisallow: /\nAllow: /news/\nCrawl-delay: 4');
  assert.equal(rules.allows(new URL('https://www.mnsenaterepublicans.com/news/')),true);
  assert.equal(rules.allows(new URL('https://www.mnsenaterepublicans.com/private/')),false);
  assert.equal(rules.crawlDelayMs,4000);
});
