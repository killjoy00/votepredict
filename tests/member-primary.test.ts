import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directoryProfileMatchesMember,
  findSenateMemberProfileUrl,
  houseArchiveMatchesMember,
  houseMemberNewsUrl,
  senateDflFallbackProfileUrl,
  memberPrimaryArticleMatches,
  memberPrimaryPublishedAt,
  parseHouseMemberNewsArchiveEntries,
  selectMemberPrimaryArticleCandidates,
  type MemberPrimaryDiscovery,
  type MemberPrimaryMember,
} from '../src/evidence/member-primary.js';
import type { PublicPage } from '../src/evidence/public-http.js';

function page(input: Partial<PublicPage> & Pick<PublicPage, 'canonicalUrl' | 'rawContent' | 'text'>): PublicPage {
  return {
    requestedUrl: input.canonicalUrl,
    finalUrl: input.canonicalUrl,
    fetchedAt: '2026-09-18T12:00:00.000Z',
    httpStatus: 200,
    contentType: 'text/html',
    contentSha256: 'a'.repeat(64),
    bytes: input.rawContent.length,
    title: input.title,
    publishedAt: input.publishedAt,
    excerpt: input.text.slice(0, 1600),
    links: input.links ?? [],
    ...input,
  };
}

const dflMember: MemberPrimaryMember = {
  name: 'D. Scott Dibble',
  chamber_slug: 'senate',
  district: '61',
  party: 'DFL',
  external_key: 'lrl:10142',
};

const republicanMember: MemberPrimaryMember = {
  name: 'Robert Farnsworth',
  chamber_slug: 'senate',
  district: '7',
  party: 'R',
  external_key: 'lrl:15591',
};

test('House member news archive is derived from durable LRL identity', () => {
  assert.equal(houseMemberNewsUrl('lrl:15347'), 'https://www.house.mn.gov/members/profile/news/15347');
  assert.equal(houseMemberNewsUrl('other:15347'), undefined);
});

test('House archive identity accepts deterministic LRL pages even when district text is absent', () => {
  const member: MemberPrimaryMember = {
    name: 'John Burkel',
    chamber_slug: 'house',
    district: '1A',
    party: 'R',
    external_key: 'lrl:15555',
  };
  const archive = page({
    canonicalUrl: 'https://www.house.mn.gov/members/profile/news/15555',
    rawContent: '',
    text: 'Legislative News and Views Representative John Burkel Recent Updates',
  });
  assert.equal(houseArchiveMatchesMember(archive, member), true);
});

test('Senate DFL fallback profile URLs follow the live senator-first-last slug and remain verify-before-use', () => {
  assert.equal(senateDflFallbackProfileUrl('John A. Hoffman'), 'https://senatedfl.mn/home/members/senator-john-hoffman/');
  assert.equal(senateDflFallbackProfileUrl('John J. Marty'), 'https://senatedfl.mn/home/members/senator-john-marty/');
  assert.equal(senateDflFallbackProfileUrl('Nick A. Frentz'), 'https://senatedfl.mn/home/members/senator-nick-frentz/');
  assert.equal(senateDflFallbackProfileUrl('Omar Fateh'), 'https://senatedfl.mn/home/members/senator-omar-fateh/');
  assert.equal(senateDflFallbackProfileUrl('Bobby Joe Champion'), 'https://senatedfl.mn/home/members/senator-bobby-joe-champion/');
  assert.equal(senateDflFallbackProfileUrl('Erin Maye Quade'), 'https://senatedfl.mn/home/members/senator-erin-maye-quade/');
});

test('Senate DFL directory matching can resolve public-name variants from the canonical profile path', () => {
  const directory = page({
    canonicalUrl: 'https://senatedfl.mn/senators/',
    rawContent: '<a href="/home/members/senator-ron-latz/"><img alt="" /></a><span>Ron Latz Senate District 46</span>',
    text: 'Ron Latz Senate District 46',
  });
  assert.equal(
    findSenateMemberProfileUrl(directory, {
      name: 'Ronald Steven Latz',
      party: 'DFL',
    }),
    'https://senatedfl.mn/home/members/senator-ron-latz/',
  );
});

test('uniquely resolved Senate caucus profiles can verify identity without repeating district text', () => {
  const member: MemberPrimaryMember = {
    name: 'Steve A. Cwodzinski',
    chamber_slug: 'senate',
    district: '49',
    party: 'DFL',
    external_key: 'lrl:12345',
  };
  const profile = page({
    canonicalUrl: 'https://senatedfl.mn/home/members/senator-steve-cwodzinski/',
    rawContent: '',
    text: 'Senator Steve Cwodzinski Education Policy Biography and legislative work.',
  });
  assert.equal(directoryProfileMatchesMember(profile, member), true);
});

test('Senate DFL directory matching accepts live profile cards with descriptive nested text', () => {
  const directory = page({
    canonicalUrl: 'https://senatedfl.mn/senators/',
    rawContent: '<a href="/home/members/senator-nick-frentz/"><div>Nick Frentz</div><span>Assistant Majority Leader Senate District 18 North Mankato</span></a>',
    text: 'Nick Frentz Assistant Majority Leader Senate District 18 North Mankato',
  });
  assert.equal(
    findSenateMemberProfileUrl(directory, {
      name: 'Nick A. Frentz',
      party: 'DFL',
    }),
    'https://senatedfl.mn/home/members/senator-nick-frentz/',
  );
});

test('Senate directory matching tolerates initials and common first-name variants while keeping surname unique', () => {
  const dflDirectory = page({
    canonicalUrl: 'https://senatedfl.mn/senators/',
    rawContent: '<a href="/home/members/dibble/">Scott Dibble</a><span>Senate District 61</span>',
    text: 'Scott Dibble Senate District 61',
  });
  assert.equal(
    findSenateMemberProfileUrl(dflDirectory, dflMember),
    'https://senatedfl.mn/home/members/dibble/',
  );

  const republicanDirectory = page({
    canonicalUrl: 'https://www.mnsenaterepublicans.com/senators/',
    rawContent: '<a href="/rob-farnsworth/">Rob Farnsworth</a>',
    text: 'Rob Farnsworth',
  });
  assert.equal(
    findSenateMemberProfileUrl(republicanDirectory, republicanMember),
    'https://www.mnsenaterepublicans.com/rob-farnsworth/',
  );
});

test('House article selection keeps only member-specific legislative news items', () => {
  const member: MemberPrimaryMember = {
    name: 'Mary Franson',
    chamber_slug: 'house',
    district: '12B',
    party: 'R',
    external_key: 'lrl:15347',
  };
  const index = page({
    canonicalUrl: 'https://www.house.mn.gov/members/profile/news/15347',
    rawContent: '',
    text: 'Legislative News and Views - Rep. Mary Franson 12B',
    links: [
      'https://www.house.mn.gov/members/profile/news/15347/50001',
      'https://www.house.mn.gov/members/profile/news/15347/50002',
      'https://www.house.mn.gov/members/profile/15347',
      'https://www.house.mn.gov/members/profile/news/99999/1',
    ],
  });
  const discovery: MemberPrimaryDiscovery = {
    hostKind: 'house_official',
    publisher: 'Minnesota House of Representatives',
    registryPage: index,
    articleIndexPage: index,
  };
  assert.deepEqual(selectMemberPrimaryArticleCandidates(discovery, member), [
    'https://www.house.mn.gov/members/profile/news/15347/50001',
    'https://www.house.mn.gov/members/profile/news/15347/50002',
  ]);
});

test('Senate DFL search results require a matching member byline before becoming member-primary evidence', () => {
  const registry = page({
    canonicalUrl: 'https://senatedfl.mn/home/members/dibble/',
    rawContent: '',
    text: 'Senator Scott Dibble represents Senate District 61.',
  });
  const index = page({
    canonicalUrl: 'https://senatedfl.mn/?s=D.+Scott+Dibble',
    rawContent: '',
    text: 'Search results',
    links: [
      'https://senatedfl.mn/senator-scott-dibble-announces-transportation-package/',
      'https://senatedfl.mn/news/',
      'https://senatedfl.mn/home/members/dibble/',
    ],
  });
  const discovery: MemberPrimaryDiscovery = {
    hostKind: 'senate_dfl_caucus',
    publisher: 'Minnesota Senate DFL Caucus',
    registryPage: registry,
    articleIndexPage: index,
  };
  assert.deepEqual(selectMemberPrimaryArticleCandidates(discovery, dflMember), [
    'https://senatedfl.mn/senator-scott-dibble-announces-transportation-package/',
  ]);

  const authored = page({
    canonicalUrl: 'https://senatedfl.mn/senator-scott-dibble-announces-transportation-package/',
    rawContent: '',
    text: 'Senator Scott Dibble announces transportation package by Senator Scott Dibble May 1, 2026. Senator Dibble said...',
  });
  const merelyMentioned = page({
    canonicalUrl: 'https://senatedfl.mn/another-story/',
    rawContent: '',
    text: 'Another story mentions Senator Scott Dibble in passing but is by Senator Ann Rest.',
  });
  assert.equal(memberPrimaryArticleMatches(authored, discovery, dflMember), true);
  assert.equal(memberPrimaryArticleMatches(merelyMentioned, discovery, dflMember), false);
});

test('Senate Republican profile news links are bounded to article-like same-host pages', () => {
  const registry = page({
    canonicalUrl: 'https://www.mnsenaterepublicans.com/rob-farnsworth/',
    rawContent: '',
    text: 'Senator Rob Farnsworth proudly representing Senate District 7',
    links: [
      'https://www.mnsenaterepublicans.com/senator-farnsworth-announces-local-projects/',
      'https://www.mnsenaterepublicans.com/news/',
      'https://www.mnsenaterepublicans.com/senators/',
      'https://example.com/external',
    ],
  });
  const discovery: MemberPrimaryDiscovery = {
    hostKind: 'senate_republican_caucus',
    publisher: 'Minnesota Senate Republican Caucus',
    registryPage: registry,
    articleIndexPage: registry,
  };
  assert.deepEqual(selectMemberPrimaryArticleCandidates(discovery, republicanMember), [
    'https://www.mnsenaterepublicans.com/senator-farnsworth-announces-local-projects/',
  ]);
});

test('member-primary publication date falls back to a visible article date', () => {
  const article = page({
    canonicalUrl: 'https://www.house.mn.gov/members/profile/news/15347/50001',
    rawContent: '',
    text: 'Legislative update Wednesday, May 20, 2026 Dear neighbors...',
  });
  assert.equal(memberPrimaryPublishedAt(article), '2026-05-20T12:00:00.000Z');
});


test('House historical news archive parser preserves official article dates and member scope', () => {
  const archive = page({
    canonicalUrl: 'https://www.house.mn.gov/members/profile/news/15347',
    rawContent: [
      '<ul>',
      '<li><a href="/members/profile/news/15347/50001"><strong>First update</strong></a> - (Friday, May 10, 2024)</li>',
      '<li><a href="https://www.house.mn.gov/members/profile/news/15347/50002">Second update</a> - (Wednesday, January 5, 2022)</li>',
      '<li><a href="/members/profile/news/99999/1">Other member</a> - (Monday, May 1, 2023)</li>',
      '<li><a href="/members/profile/news/15347/50003">Impossible date</a> - (Friday, February 31, 2024)</li>',
      '</ul>',
    ].join(''),
    text: 'archive',
  });

  assert.deepEqual(parseHouseMemberNewsArchiveEntries(archive, 'lrl:15347'), [
    {
      url: 'https://www.house.mn.gov/members/profile/news/15347/50002',
      title: 'Second update',
      publishedOn: '2022-01-05',
    },
    {
      url: 'https://www.house.mn.gov/members/profile/news/15347/50001',
      title: 'First update',
      publishedOn: '2024-05-10',
    },
  ]);
  assert.deepEqual(parseHouseMemberNewsArchiveEntries(archive, 'other:15347'), []);
});
