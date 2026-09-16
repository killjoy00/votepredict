import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filingMatchesMember,
  parseCampaignSiteFilings,
  selectCampaignContentLinks,
} from '../src/evidence/campaign-site-discovery';
import { canonicalPublicUrl, publicPageMentionsPerson, type PublicPage } from '../src/evidence/public-http';
import { gdeltSeenDate } from '../src/evidence/public-news';

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

test('public URL canonicalization removes tracking but preserves substantive query state', () => {
  assert.equal(
    canonicalPublicUrl('HTTPS://Example.COM:443/issues/?utm_source=x&bill=HF123&fbclid=abc#top'),
    'https://example.com/issues/?bill=HF123',
  );
  assert.throws(() => canonicalPublicUrl('file:///etc/passwd'), /Unsupported public evidence protocol/);
});

test('person verification requires both first and last name tokens', () => {
  assert.equal(publicPageMentionsPerson('Rep. Grant Hauschild discussed the bill Tuesday.', 'Grant Hauschild'), true);
  assert.equal(publicPageMentionsPerson('Hauschild discussed the bill Tuesday.', 'Grant Hauschild'), false);
});

test('campaign content link selection stays same-site and favors issue pages', () => {
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
