import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filingMatchesMember,
  parseCampaignSiteFilings,
  selectCampaignContentLinks,
} from '../src/evidence/campaign-site-discovery';
import { canonicalPublicUrl, publicPageMentionsPerson, type PublicPage } from '../src/evidence/public-http';
import {
  bingNewsQuery,
  gdeltBatchQuery,
  gdeltSeenDate,
  newsNameVariants,
  newsPublicationDateSource,
  parseBingNewsRss,
  unwrapBingNewsUrl,
  type NewsLead,
} from '../src/evidence/public-news';

test('campaign filing parser keeps filed state legislative websites and rejects email-like website fields', () => {
  const html = `
    <h3>State Senator District 8</h3>
    <table><tr><th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th></tr>
      <tr><td>Jen McEwen</td><td>Democratic-Farmer-Labor</td><td><a href="https://www.votemcewen.com">www.votemcewen.com</a></td><td>5/19/2026</td></tr>
      <tr><td>Darrick Law</td><td>Republican</td><td>darrickformnsenate.com</td><td>6/2/2026</td></tr>
      <tr><td>Email Only</td><td>Republican</td><td>candidate@gmail.com</td><td>6/2/2026</td></tr>
    </table>
    <h3>State Representative District 52B</h3>
    <table><tr><th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th></tr>
      <tr><td>Bianca Virnig</td><td>Democratic-Farmer-Labor</td><td>www.biancavirnig.com</td><td>5/19/2026</td></tr>
      <tr><td>No Site</td><td>Republican</td><td></td><td>5/20/2026</td></tr>
    </table>`;
  const rows = parseCampaignSiteFilings(html);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => [row.chamber, row.district, row.candidateName]), [
    ['house', '52B', 'Bianca Virnig'],
    ['senate', '8', 'Darrick Law'],
    ['senate', '8', 'Jen McEwen'],
  ]);
  const bianca = rows.find((row) => row.candidateName === 'Bianca Virnig');
  assert.ok(bianca);
  assert.equal(filingMatchesMember(bianca, { name: 'Bianca Ward Virnig', chamber: 'house', district: '52B' }), true);
  assert.equal(filingMatchesMember(bianca, { name: 'Bianca Ward Virnig', chamber: 'house', district: '53B' }), false);
});

test('campaign filing parser follows live-style office labels outside heading tags and href-only sites', () => {
  const html = `
    <div class="office-result"><span>State Representative</span> <strong>District 26A</strong></div>
    <table>
      <tr><th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th></tr>
      <tr><td>Aaron Repinski</td><td>Republican</td><td><a href="https://repinskiformn.com/"><span>Campaign site</span></a></td><td>5/20/2026</td></tr>
    </table>
    <div>State Senator <em>District 50</em></div>
    <table>
      <tr><td>Alice Mann</td><td>Democratic-Farmer-Labor</td><td>alicemann.org</td><td>5/19/2026</td></tr>
    </table>`;
  const rows = parseCampaignSiteFilings(html);
  assert.deepEqual(rows.map((row) => [row.chamber, row.district, row.candidateName, row.website]), [
    ['house', '26A', 'Aaron Repinski', 'https://repinskiformn.com/'],
    ['senate', '50', 'Alice Mann', 'https://alicemann.org/'],
  ]);
});

test('campaign filing parser keeps an office label embedded in its own table row', () => {
  const html = `
    <table>
      <tr><td colspan="4"><strong>State Senator District 27</strong></td></tr>
      <tr><th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th></tr>
      <tr><td>Andrew Mathews</td><td>Republican</td><td><a href="https://andrewmathews.com">andrewmathews.com</a></td><td>5/19/2026</td></tr>
      <tr><td colspan="4"><strong>State Senator District 47</strong></td></tr>
      <tr><th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th></tr>
      <tr><td>Amanda Hemmingsen-Jaeger</td><td>Democratic-Farmer-Labor</td><td><a href="https://www.amandaformn.com">www.amandaformn.com</a></td><td>5/19/2026</td></tr>
    </table>`;
  const rows = parseCampaignSiteFilings(html);
  assert.deepEqual(rows.map((row) => [row.chamber, row.district, row.candidateName]), [
    ['senate', '27', 'Andrew Mathews'],
    ['senate', '47', 'Amanda Hemmingsen-Jaeger'],
  ]);
});

test('campaign filing parser ignores registry navigation cells before the candidate name', () => {
  const html = `
    <table>
      <tr><td colspan="5"><strong>State Representative District 26A</strong></td></tr>
      <tr><th></th><th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th></tr>
      <tr>
        <td><a href="/CandidateFilingDetails.aspx?candidateid=123">View</a></td>
        <td>Aaron Repinski</td>
        <td>Republican</td>
        <td><a href="https://repinskiformn.com/">Campaign site</a></td>
        <td>5/20/2026</td>
      </tr>
    </table>`;
  const rows = parseCampaignSiteFilings(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].candidateName, 'Aaron Repinski');
  assert.equal(rows[0].website, 'https://repinskiformn.com/');
  assert.equal(filingMatchesMember(rows[0], { name: 'Aaron Repinski', chamber: 'house', district: '026A' }), true);
});

test('public URL canonicalization removes tracking but preserves substantive query state', () => {
  assert.equal(
    canonicalPublicUrl('HTTPS://Example.COM:443/issues/?utm_source=x&bill=HF123&fbclid=abc#top'),
    'https://example.com/issues/?bill=HF123',
  );
  assert.throws(() => canonicalPublicUrl('file:///etc/passwd'), /Unsupported public evidence protocol/);
});

test('person verification requires a contiguous recognizable member name form', () => {
  assert.equal(publicPageMentionsPerson('Rep. Grant Hauschild discussed the bill Tuesday.', 'Grant Hauschild'), true);
  assert.equal(publicPageMentionsPerson('Hauschild discussed the bill Tuesday.', 'Grant Hauschild'), false);
  assert.equal(publicPageMentionsPerson('Ben opened the event. Jefferson Davis was discussed much later.', 'Ben Davis'), false);
  assert.equal(publicPageMentionsPerson('Representative Bianca Virnig discussed the proposal.', 'Bianca Ward Virnig'), true);
  assert.equal(publicPageMentionsPerson('Amanda Hemmingsen-Jaeger spoke at the hearing.', 'Amanda Hemmingsen-Jaeger'), true);
});

test('campaign content link selection stays same-site, favors issues, and excludes legal boilerplate', () => {
  const page: PublicPage = {
    requestedUrl: 'https://candidate.example/',
    finalUrl: 'https://candidate.example/',
    canonicalUrl: 'https://candidate.example/',
    fetchedAt: '2026-09-16T00:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html',
    contentSha256: 'a'.repeat(64),
    bytes: 100,
    rawContent: '<html></html>',
    text: 'Candidate home page with sufficient readable content for this test.',
    excerpt: 'Candidate home page',
    links: [
      'https://candidate.example/about',
      'https://candidate.example/issues',
      'https://candidate.example/privacy-policy',
      'https://candidate.example/intellectual-property-policy',
      'https://candidate.example/press/latest',
      'https://other.example/issues',
    ],
  };
  assert.deepEqual(selectCampaignContentLinks(page, 2), [
    'https://candidate.example/issues',
    'https://candidate.example/press/latest',
  ]);
});

test('GDELT seen timestamps are normalized and invalid dates rejected', () => {
  assert.equal(gdeltSeenDate('20260915T143000Z'), '2026-09-15T14:30:00.000Z');
  assert.equal(gdeltSeenDate('bad'), undefined);
});

test('GDELT batch discovery builds one OR query for multiple exact member names', () => {
  assert.equal(
    gdeltBatchQuery(['Aaron Repinski', 'Aisha Gomez', 'Aaron Repinski']),
    '("Aaron Repinski" OR "Aisha Gomez") Minnesota',
  );
});

test('news discovery expands middle initials and suffix-order variants without losing the canonical name', () => {
  assert.deepEqual(newsNameVariants('Jennifer A McEwen'), [
    'Jennifer A McEwen',
    'Jennifer McEwen',
  ]);
  assert.deepEqual(newsNameVariants('D. Scott Dibble'), [
    'D. Scott Dibble',
    'Scott Dibble',
  ]);
  assert.deepEqual(newsNameVariants('Jr. Bidal Duran'), [
    'Jr. Bidal Duran',
    'Bidal Duran',
    'Bidal Duran Jr',
  ]);
});

test('news queries include discoverable aliases for names with middle initials', () => {
  assert.equal(
    bingNewsQuery(['John A. Hoffman']),
    '("John A. Hoffman" OR "John Hoffman") Minnesota',
  );
  assert.equal(
    gdeltBatchQuery(['Julia E. Coleman']),
    '("Julia E. Coleman" OR "Julia Coleman") Minnesota',
  );
});

test('Bing News RSS discovery builds an exact-name OR query', () => {
  assert.equal(
    bingNewsQuery(['Aaron Repinski', 'Aisha Gomez', 'Aaron Repinski']),
    '("Aaron Repinski" OR "Aisha Gomez") Minnesota',
  );
});

test('Bing News RSS unwraps publisher URLs and rejects aggregator-only URLs', () => {
  assert.equal(
    unwrapBingNewsUrl('https://www.bing.com/news/apiclick.aspx?ref=FexRss&url=https%3A%2F%2Fexample.com%2Fstory%3Fid%3D42'),
    'https://example.com/story?id=42',
  );
  assert.equal(unwrapBingNewsUrl('https://www.bing.com/news/search?q=test'), undefined);
  assert.equal(unwrapBingNewsUrl('https://publisher.example/story'), 'https://publisher.example/story');
});

test('Bing News RSS parser keeps direct publisher leads with normalized dates', () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[Rep. Aaron Repinski discusses transportation plan]]></title>
        <link>https://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3A%2F%2Fexample.com%2Fpolitics%2Frepinski%3Futm_source%3Dbing</link>
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
  assert.equal(leads[0].url, 'https://example.com/politics/repinski?utm_source=bing');
  assert.equal(leads[0].title, 'Rep. Aaron Repinski discusses transportation plan');
  assert.equal(leads[0].seenAt, '2026-09-15T14:30:00.000Z');
  assert.equal(leads[0].domain, 'example.com');
  assert.equal(leads[0].provider, 'bing_news_rss');
});

test('news publication date provenance follows the actual discovery provider', () => {
  const gdeltLead: NewsLead = {
    url: 'https://example.com/a',
    title: 'A',
    seenAt: '2026-09-15T14:30:00.000Z',
    provider: 'gdelt',
  };
  const rssLead: NewsLead = {
    url: 'https://example.com/b',
    title: 'B',
    seenAt: '2026-09-15T14:30:00.000Z',
    provider: 'bing_news_rss',
  };
  assert.equal(newsPublicationDateSource(undefined, gdeltLead), 'gdelt_seen_at');
  assert.equal(newsPublicationDateSource(undefined, rssLead), 'rss_pub_date');
  assert.equal(newsPublicationDateSource('2026-09-15T10:00:00.000Z', rssLead), 'page_metadata');
});
