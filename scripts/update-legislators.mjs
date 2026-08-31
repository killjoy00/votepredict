import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HOUSE_URL = 'https://www.house.mn.gov/members/list';
const SENATE_URL = 'https://www.senate.mn/api/members';

function decodeEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ');
}

function normalizeDistrict(value) {
  const match = String(value).trim().match(/^0*(\d+)([AB])?$/i);
  if (!match) return String(value).trim();
  return `${Number(match[1])}${match[2]?.toUpperCase() ?? ''}`;
}

function normalizeParty(value) {
  const party = String(value).trim().toUpperCase();
  if (party === 'DFL' || party.includes('DEMOCRAT')) return 'DFL';
  if (party === 'R' || party.includes('REPUBLICAN')) return 'Republican';
  if (party === 'I' || party.includes('INDEPENDENT')) return 'Independent';
  return String(value).trim();
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'User-Agent': 'VotePredict roster updater', ...options.headers },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

function parseHouse(html) {
  // The page repeats members in several tab panels, including the original
  // members-elect roster. The alphabetical panel is the authoritative roster
  // shown to visitors for the 94th Legislature.
  const start = html.indexOf('Begin New Row for Alphabetical members');
  const end = html.indexOf('Begin New Row for Members by District Order', start);
  const rosterHtml = start >= 0 && end > start ? html.slice(start, end) : html;
  const members = new Map();
  const pattern = /href="\/members\/profile\/(\d+)"[^>]*><b>([^<]+?) \((\d{1,2}[AB]),\s*(DFL|R|I)\)<\/b>/g;
  for (const match of rosterHtml.matchAll(pattern)) {
    members.set(match[1], {
      id: `mn-house-${match[1]}`,
      name: decodeEntities(match[2].trim()),
      party: normalizeParty(match[4]),
      chamber: 'house',
      district: normalizeDistrict(match[3]),
      title: 'Representative',
    });
  }
  return [...members.values()];
}

function parseSenate(payload) {
  return (payload.members ?? [])
    .filter((member) => member.preferred_full_name && member.dist && String(member.mem_id) !== '0000')
    .map((member) => ({
      id: `mn-senate-${member.mem_id}`,
      name: member.preferred_full_name.trim(),
      party: normalizeParty(member.party),
      chamber: 'senate',
      district: normalizeDistrict(member.dist),
      title: 'Senator',
      imageUrl: member.mem_bio_pic
        ? `https://www.senate.mn/img/member_thumbnails/${member.mem_bio_pic}`
        : undefined,
      email: member.email || undefined,
    }));
}

function validate(members) {
  const house = members.filter((member) => member.chamber === 'house');
  const senate = members.filter((member) => member.chamber === 'senate');
  const districts = new Set();
  const ids = new Set();
  for (const member of members) {
    const districtKey = `${member.chamber}:${member.district}`;
    if (districts.has(districtKey)) throw new Error(`Duplicate district ${districtKey}`);
    if (ids.has(member.id)) throw new Error(`Duplicate member ID ${member.id}`);
    districts.add(districtKey);
    ids.add(member.id);
  }
  if (house.length < 130 || house.length > 134) {
    throw new Error(`Expected 130-134 House members, received ${house.length}`);
  }
  if (senate.length < 65 || senate.length > 67) {
    throw new Error(`Expected 65-67 senators, received ${senate.length}`);
  }
}

function sortMembers(a, b) {
  if (a.chamber !== b.chamber) return a.chamber === 'house' ? -1 : 1;
  return a.district.localeCompare(b.district, undefined, { numeric: true });
}

function renderMember(member) {
  const fields = [
    `id: ${JSON.stringify(member.id)}`,
    `name: ${JSON.stringify(member.name)}`,
    `party: ${JSON.stringify(member.party)}`,
    `chamber: ${JSON.stringify(member.chamber)}`,
    `district: ${JSON.stringify(member.district)}`,
    `title: ${JSON.stringify(member.title)}`,
  ];
  if (member.imageUrl) fields.push(`imageUrl: ${JSON.stringify(member.imageUrl)}`);
  if (member.email) fields.push(`email: ${JSON.stringify(member.email)}`);
  return `  { ${fields.join(', ')} },`;
}

const [houseResponse, senateResponse] = await Promise.all([
  fetchWithRetry(HOUSE_URL),
  fetchWithRetry(SENATE_URL),
]);
const members = [
  ...parseHouse(await houseResponse.text()),
  ...parseSenate(await senateResponse.json()),
].sort(sortMembers);
validate(members);

const asOf = new Date().toISOString().slice(0, 10);
const output = `/**
 * Verified snapshot generated from the official Minnesota House and Senate rosters.
 * Refresh with \`npm run data:update\`. Runtime code tries the official sources first.
 */
import type { Legislator } from '../types/index.js';

export const LEGISLATOR_SNAPSHOT_AS_OF = ${JSON.stringify(asOf)};

export const MN_LEGISLATORS: Legislator[] = [
${members.map(renderMember).join('\n')}
];
`;

const destination = fileURLToPath(new URL('../src/data/legislators.ts', import.meta.url));
await writeFile(destination, output, 'utf8');
process.stdout.write(`Updated ${members.length} legislators (${members.filter((m) => m.chamber === 'house').length} House, ${members.filter((m) => m.chamber === 'senate').length} Senate) as of ${asOf}.\n`);
