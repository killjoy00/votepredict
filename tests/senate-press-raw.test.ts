import assert from 'node:assert/strict';
import {test} from 'node:test';
import {archivePageUrl,articleUrlsFromListing,authorArchivesFromListing,lastArchivePageFromListing,memberPagesFromDirectory,collectSource,collectDirectArticle,billIds,namedSenators,parseArticle,robotsPolicy,type SenatePressSource}
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

test('Republican published-page Impreza post_title/post_content markup is extracted in full',()=>{
  const html='<html><head><link rel="canonical" href="https://www.mnsenaterepublicans.com/release/" /></head><body>'+ 
    '<main id="page-content" class="l-main">'+
    '<div class="w-post-elm post_date entry-date published">September 28, 2026</div>'+
    '<h3 class="w-post-elm post_title entry-title">Sen. Rasmusson statement</h3>'+
    '<div class="w-post-elm post_content"><p>Sen. Jordan Rasmusson describes the first paragraph.</p>'+
    '<p>The rest of the complete source mentions SF 1234 and HF 56.</p></div></main></body></html>';
  const parsed=parseArticle(html,gop,'https://www.mnsenaterepublicans.com/release/','2026-10-15T00:00:00Z');
  assert.ok(parsed);
  assert.equal(parsed.published_on,'2026-09-28');
  assert.deepEqual(parsed.bill_identifiers,['SF 1234','HF 56']);
  assert.ok(parsed.raw_text.includes('The rest of the complete source'));
  assert.equal(parsed.raw_text.includes('Sen. Rasmusson statement'),false);
});

test('DFL author archives and the true last WordPress pagination link are discovered',()=>{
  const page='<div><h3><a href="/statement-from-senator-boldon/">Statement from Senator Liz Boldon</a></h3>'+
    '<a href="/author/senboldon/">Senator Liz Boldon</a>'+
    '<a href="https://bad.example/author/fake/">Fake</a>'+
    '<a href="/press-releases/?_page=436">436</a></div>';
  assert.deepEqual(authorArchivesFromListing(page,dfl),['https://senatedfl.mn/author/senboldon/']);
  assert.equal(lastArchivePageFromListing(page,dfl),436);
  assert.equal(lastArchivePageFromListing('<a href="/news/page/135/">135</a>',gop),135);
});

test('DFL blank page in the middle is reported and does not discard older pages',async()=>{
  const listing=(slug:string)=>'<html><a href="/press-releases/?_page=436">436</a>'+
    '<h3><a href="/'+slug+'/">Statement by Senator Liz Boldon</a></h3>'+
    '<a href="/author/senboldon/">Senator Liz Boldon</a></html>';
  const article=(date:string)=>'<html><head><meta property="article:published_time" content="'+date+'"></head>'+
    '<main><article><h1>Senator Liz Boldon Statement</h1>'+
    '<div class="entry-content"><p>Senator Liz Boldon published the full statement.</p></div></article></main></html>';
  const request:typeof fetch=async(input)=>{
    const url=String(input);
    if(url.endsWith('/robots.txt'))return new Response('User-agent: *\\nAllow: /');
    if(url==='https://senatedfl.mn/press-releases/')return new Response(listing('first-statement'));
    if(url.endsWith('?_page=2'))return new Response('<html><a href="/press-releases/?_page=436">436</a></html>');
    if(url.endsWith('?_page=3'))return new Response(listing('older-statement'));
    if(url.endsWith('/first-statement/'))return new Response(article('2026-05-01'));
    if(url.endsWith('/older-statement/'))return new Response(article('2024-05-01'));
    return new Response('Not found',{status:404});
  };
  const stored:string[]=[];
  const result=await collectSource(dfl,{from:'2023-01-01',to:'2026-10-15',maxPages:3,delayMs:0},
    {existing:async()=>new Set<string>(),insert:async(item)=>{stored.push(item.source_url);return true;}},request);
  assert.equal(result.inserted,2);
  assert.deepEqual(result.archive_gaps,[2]);
  assert.equal(result.failures.length,1);
  assert.equal(result.pages,3);
  assert.deepEqual(result.member_archives,['https://senatedfl.mn/author/senboldon/']);
  assert.equal(stored.length,2);
});

test('GOP official senator directory and linked small-heading news are separate from bios',()=>{
  const directory='<h5><a href="/michael-kreun/">Michael Kreun</a></h5>'+
    '<h5><a href="/jordan-rasmusson/">Jordan Rasmusson</a></h5>'+
    '<h5><a href="https://example.org/attacker/">Attacker Name</a></h5>';
  const members=memberPagesFromDirectory(directory,gop);
  assert.deepEqual(members.map(m=>m.archive_url),[
    'https://www.mnsenaterepublicans.com/michael-kreun/',
    'https://www.mnsenaterepublicans.com/jordan-rasmusson/',
  ]);
  const profile='<h1>Senator Michael Kreun</h1><h3>News from Senator Kreun</h3>'+
    '<h6><a href="/kreun-responds-to-new-law/">Senator Kreun responds to new law</a></h6>';
  assert.deepEqual(articleUrlsFromListing(profile,members[0]),[
    'https://www.mnsenaterepublicans.com/kreun-responds-to-new-law/',
  ]);
});

test('GOP missed article can be retried by exact on-site URL without re-crawling',async()=>{
  const articleUrl='https://www.mnsenaterepublicans.com/kreun-responds-to-new-law/';
  const request:typeof fetch=async(input)=>{
    if(String(input).endsWith('robots.txt'))return new Response('User-agent: *\\nAllow: /');
    if(String(input)===articleUrl)return new Response('<main><h1>Senator Michael Kreun responds to law</h1>'+
      '<div class="post_content">Sen. Michael Kreun described SF 123 in the announcement.</div>'+
      '<div class="post-date">January 4, 2024</div></main>');
    return new Response('not found',{status:404});
  };
  const inserted:string[]=[];
  const sink={existing:async()=>new Set<string>(),insert:async(item:{source_url:string})=>{
    inserted.push(item.source_url);return true;
  }};
  const r=await collectDirectArticle(gop,articleUrl,
    {from:'2023-01-01',to:'2026-10-15'},sink,request);
  assert.equal(r.inserted,1);
  assert.deepEqual(r.failures,[]);
  assert.deepEqual(inserted,[articleUrl]);
  await assert.rejects(()=>collectDirectArticle(gop,'https://other.site/a/',
    {from:'2023-01-01',to:'2026-10-15'},sink,request),/outside first-party/);
});
