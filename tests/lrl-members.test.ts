import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLrlSessionSearchUrl, discoverLrlLegislators, parseLrlMembershipDetail } from '../src/sources/minnesota/lrl-members.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

test('LRL session search uses the legislative session number', () => {
  assert.equal(buildLrlSessionSearchUrl(getMinnesotaHouseSession('302')), 'https://www.lrl.mn.gov/legdb/results?body=Both&gender=&q=&search=session&sess=94');
  assert.equal(buildLrlSessionSearchUrl(getMinnesotaHouseSession('257')), 'https://www.lrl.mn.gov/legdb/results?body=Both&gender=&q=&search=session&sess=92');
});

test('LRL search discovery preserves stable legislator ids across current link forms', () => {
  const html = `<table><tr><td><a href="/legdb/fulldetail.aspx?ID=12266">Hortman, Melissa</a></td></tr><tr><td><a href="https://www.lrl.mn.gov/legdb/fulldetail?id=15531">Gomez, Aisha</a></td></tr></table>`;
  assert.deepEqual(discoverLrlLegislators(html), [
    { lrlId: '12266', displayName: 'Hortman, Melissa', sourceUrl: 'https://www.lrl.mn.gov/legdb/fulldetail?ID=12266' },
    { lrlId: '15531', displayName: 'Gomez, Aisha', sourceUrl: 'https://www.lrl.mn.gov/legdb/fulldetail?ID=15531' },
  ]);
});

test('LRL detail parser captures exact term dates including unfinished terms', () => {
  const html = `<html><body><h1>Hortman, Melissa - Legislator Record - Minnesota Legislators Past &amp; Present</h1><h3>94th Legislative Session (2025-2026)</h3><p>Body: House</p><p>District: 34B</p><p>Elected: 11/5/2024</p><p>Term of Office: 1/6/2025 to 6/14/2025 (unfinished term)</p><p>Oath Date: 1/12/2025</p><p>Party: Democratic-Farmer-Labor</p><h3>93rd Legislative Session (2023-2024)</h3></body></html>`;
  assert.deepEqual(parseLrlMembershipDetail({
    html,
    session: getMinnesotaHouseSession('302'),
    lrlId: '12266',
    fallbackName: 'Hortman, Melissa',
    sourceUrl: 'https://www.lrl.mn.gov/legdb/fulldetail?ID=12266',
  }), {
    lrlId: '12266',
    name: 'Melissa Hortman',
    normalizedName: 'melissa hortman',
    chamber: 'house',
    district: '34B',
    party: 'DFL',
    startsOn: '2025-01-06',
    endsOn: '2025-06-14',
    electedOn: '2024-11-05',
    oathOn: '2025-01-12',
    sourceUrl: 'https://www.lrl.mn.gov/legdb/fulldetail?ID=12266',
  });
});

test('LRL detail parser normalizes Senate district and Republican party', () => {
  const html = `<h1>Johnson, Mark - Legislator Record</h1><h3>92nd Legislative Session (2021-2022)</h3><p>Body: Senate</p><p>District: 01</p><p>Term of Office: 1/4/2021 to 1/1/2023</p><p>Party: Republican</p>`;
  const record = parseLrlMembershipDetail({ html, session: getMinnesotaHouseSession('257'), lrlId: 'x', fallbackName: 'Johnson, Mark', sourceUrl: 'https://www.lrl.mn.gov/legdb/fulldetail?ID=x' });
  assert.equal(record?.chamber, 'senate');
  assert.equal(record?.district, '1');
  assert.equal(record?.party, 'R');
});
