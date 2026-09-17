import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBingNewsRss, unwrapBingNewsUrl } from '../src/evidence/public-news';

test('opaque Bing News apiclick URLs remain discovery leads for guarded redirect resolution', () => {
  const opaque = 'https://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=ABC123&tid=DEF456';
  assert.equal(unwrapBingNewsUrl(opaque), opaque);
  assert.equal(unwrapBingNewsUrl('https://www.bing.com/news/search?q=repinski'), undefined);
});

test('Bing News RSS parser preserves opaque apiclick items but still drops generic Bing pages', () => {
  const opaque = 'https://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=ABC123&tid=DEF456';
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[Rep. Aaron Repinski discusses transportation plan]]></title>
        <link>${opaque.replaceAll('&', '&amp;')}</link>
        <pubDate>Tue, 15 Sep 2026 14:30:00 GMT</pubDate>
      </item>
      <item>
        <title>Aggregator only</title>
        <link>https://www.bing.com/news/search?q=repinski</link>
        <pubDate>Tue, 15 Sep 2026 12:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;

  const leads = parseBingNewsRss(xml);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].url, opaque);
  assert.equal(leads[0].domain, 'www.bing.com');
  assert.equal(leads[0].provider, 'bing_news_rss');
  assert.equal(leads[0].seenAt, '2026-09-15T14:30:00.000Z');
});
