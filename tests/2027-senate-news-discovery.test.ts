import test from 'node:test';
import assert from 'node:assert/strict';
import { SENATE_NEWS_INDEXES,discoverSenateIndexArticles,chooseSenateIndexArticles,senateNewsKey,senateArticleDateStatus } from '../src/evidence/2027-senate-news-discovery.js';
import { classify2027CollectionUrl } from '../src/sources/minnesota/2027-collection-source.js';

test('Senate shared publisher headings identify articles, not authors, profiles or third-party links',()=>{
  for(const index of SENATE_NEWS_INDEXES){
    const page={canonicalUrl:index,rawContent:'<h2><a href="/senator-example-statement/">Statement</a></h2>'+
      '<a href="/joint-policy-announcement/"><h3>Joint statement</h3></a>'+
      '<h4><a href="/senator-example-statement">Duplicate</a></h4>'+
      '<h2><a href="/news/">News</a></h2><h2><a href="/home-members/">Profile</a></h2>'+
      '<h2><a href="https://example.com/news-story/">External</a></h2>'+
      '<h2><a href="/category/news/">Category</a></h2><a href="/not-a-title/">Navigation</a>'+
      '<script>const bad = "<h2><a href=\\"/script-only/\\">Hidden</a></h2>";</script>'};
    const links=discoverSenateIndexArticles(page);
    assert.deepEqual(links.map(x=>x.url),['/senator-example-statement/','/joint-policy-announcement/'].map(x=>new URL(x,index).href));
    assert.equal(classify2027CollectionUrl(index),'member_evidence');
    assert.ok(links.every(x=>classify2027CollectionUrl(x.url)==='member_evidence'));
    assert.throws(()=>discoverSenateIndexArticles({...page,rawContent:'<a href="/news/">Navigation only</a>'}));
    assert.throws(()=>discoverSenateIndexArticles({...page,canonicalUrl:'https://example.com/news/'}));
  }
});
test('Senate daily selection deduplicates retained articles and retries failures fairly',()=>{
  const links=Array.from({length:6},(_,rank)=>({rank,url:'https://senatedfl.mn/example-news-'+rank+'/'}));
  const seen=new Set([senateNewsKey(links[0].url)]);
  const attempts=new Map([[senateNewsKey(links[1].url),'2027-01-14'],[senateNewsKey(links[2].url),'2027-01-13']]);
  assert.deepEqual(chooseSenateIndexArticles(links,seen,attempts,4).map(x=>x.rank),[3,4,5,2]);
  assert.throws(()=>chooseSenateIndexArticles(links,seen,attempts,5));
});
test('publication time is never invented and older or future claims are not live-session evidence',()=>{
  const observed='2027-01-13T16:00:00Z';
  assert.equal(senateArticleDateStatus('2027-01-12T14:00:00Z',observed),'current_session_claimed');
  assert.equal(senateArticleDateStatus('2026-12-15T14:00:00Z',observed),'outside_session');
  assert.equal(senateArticleDateStatus('2027-01-14T14:00:00Z',observed),'publication_unverified');
  assert.equal(senateArticleDateStatus(undefined,observed),'publication_unverified');
});
