// Server-side legislature and bill data services used by Vercel API routes.
import axios from 'axios';
import { MN_LEGISLATORS, LEGISLATOR_SNAPSHOT_AS_OF } from '../data/legislators.js';
import { buildRevisorTextUrl, searchRevisorBills } from './revisor.js';
import type { Bill, Legislator, LegislatorRoster } from '../types/index.js';

export type { Bill, Legislator } from '../types/index.js';

const OPEN_STATES_BASE_URL = 'https://v3.openstates.org';
const HOUSE_ROSTER_URL = 'https://www.house.mn.gov/members/list';
const SENATE_ROSTER_URL = 'https://www.senate.mn/api/members';
const CACHE_TTL = 60 * 60 * 1000;
const DEFAULT_OPEN_STATES_SESSION = '2025-2026';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data as T;
  return null;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ')
    .trim();
}

function normalizeDistrict(value: string): string {
  const match = String(value).trim().match(/^0*(\d+)([AB])?$/i);
  if (!match) return String(value).trim();
  return `${Number(match[1])}${match[2]?.toUpperCase() ?? ''}`;
}

function normalizeParty(party: string): string {
  const value = party.trim().toUpperCase();
  if (value === 'DFL' || value.includes('DEMOCRAT')) return 'DFL';
  if (value === 'R' || value === 'GOP' || value.includes('REPUBLICAN')) return 'Republican';
  if (value === 'I' || value.includes('INDEPENDENT')) return 'Independent';
  return party.trim();
}

function sortRoster(members: Legislator[]): Legislator[] {
  return [...members].sort((a, b) => {
    if (a.chamber !== b.chamber) return a.chamber === 'house' ? -1 : 1;
    return a.district.localeCompare(b.district, undefined, { numeric: true });
  });
}

export function validateRoster(members: Legislator[]): string[] {
  const errors: string[] = [];
  const house = members.filter((member) => member.chamber === 'house');
  const senate = members.filter((member) => member.chamber === 'senate');
  if (house.length < 130 || house.length > 134) errors.push(`House count is ${house.length}`);
  if (senate.length < 65 || senate.length > 67) errors.push(`Senate count is ${senate.length}`);

  const ids = new Set<string>();
  const districts = new Set<string>();
  for (const member of members) {
    if (!member.id || !member.name || !member.district) errors.push('Roster contains an incomplete member');
    if (ids.has(member.id)) errors.push(`Duplicate member ID: ${member.id}`);
    ids.add(member.id);
    const districtKey = `${member.chamber}:${member.district}`;
    if (districts.has(districtKey)) errors.push(`Duplicate district: ${districtKey}`);
    districts.add(districtKey);
  }
  return errors;
}

function requireValidRoster(members: Legislator[], source: string): Legislator[] {
  const sorted = sortRoster(members);
  const errors = validateRoster(sorted);
  if (errors.length) throw new Error(`${source} roster failed validation: ${errors.join('; ')}`);
  return sorted;
}

export function parseHouseRoster(html: string): Legislator[] {
  const start = html.indexOf('Begin New Row for Alphabetical members');
  const end = html.indexOf('Begin New Row for Members by District Order', start);
  const rosterHtml = start >= 0 && end > start ? html.slice(start, end) : html;
  const members = new Map<string, Legislator>();
  const pattern = /href="\/members\/profile\/(\d+)"[^>]*><b>([^<]+?) \((\d{1,2}[AB]),\s*(DFL|R|I)\)<\/b>/gi;

  for (const match of rosterHtml.matchAll(pattern)) {
    members.set(match[1], {
      id: `mn-house-${match[1]}`,
      name: decodeHtml(match[2]),
      party: normalizeParty(match[4]),
      chamber: 'house',
      district: normalizeDistrict(match[3]),
      title: 'Representative',
    });
  }
  return [...members.values()];
}

interface SenateMember {
  mem_id: number | string;
  preferred_full_name?: string;
  party?: string;
  dist?: string;
  mem_bio_pic?: string;
  email?: string;
}

interface SenateResponse {
  members?: SenateMember[];
}

export function parseSenateRoster(payload: SenateResponse): Legislator[] {
  return (payload.members ?? [])
    .filter((member) => member.preferred_full_name && member.dist && String(member.mem_id) !== '0000')
    .map((member) => ({
      id: `mn-senate-${member.mem_id}`,
      name: member.preferred_full_name!.trim(),
      party: normalizeParty(member.party ?? ''),
      chamber: 'senate' as const,
      district: normalizeDistrict(member.dist!),
      title: 'Senator',
      imageUrl: member.mem_bio_pic
        ? `https://www.senate.mn/img/member_thumbnails/${member.mem_bio_pic}`
        : undefined,
      email: member.email || undefined,
    }));
}

async function fetchOfficialRoster(): Promise<Legislator[]> {
  const [houseResponse, senateResponse] = await Promise.all([
    axios.get<string>(HOUSE_ROSTER_URL, {
      responseType: 'text',
      timeout: 12_000,
      maxContentLength: 3_000_000,
      headers: { 'User-Agent': 'VotePredict/2.0 roster reader' },
    }),
    axios.get<SenateResponse>(SENATE_ROSTER_URL, {
      timeout: 12_000,
      maxContentLength: 1_000_000,
      headers: { 'User-Agent': 'VotePredict/2.0 roster reader' },
    }),
  ]);
  return requireValidRoster([
    ...parseHouseRoster(houseResponse.data),
    ...parseSenateRoster(senateResponse.data),
  ], 'Minnesota Legislature');
}

interface OpenStatesPerson {
  id: string;
  name: string;
  party: string;
  current_role?: {
    title: string;
    org_classification: 'lower' | 'upper';
    district: string;
  };
  image?: string;
  email?: string;
}

interface OpenStatesPagedResponse<T> {
  results: T[];
  pagination: { page: number; max_page: number };
}

async function fetchOpenStatesRoster(): Promise<Legislator[]> {
  const legislators: Legislator[] = [];
  let page = 1;

  while (true) {
    const { data } = await axios.get<OpenStatesPagedResponse<OpenStatesPerson>>(
      `${OPEN_STATES_BASE_URL}/people`,
      {
        headers: { 'X-API-KEY': process.env.OPEN_STATES_API_KEY! },
        params: { jurisdiction: 'mn', current_role: 'true', per_page: 100, page },
        timeout: 15_000,
      },
    );

    for (const person of data.results) {
      const role = person.current_role;
      if (!role || !['lower', 'upper'].includes(role.org_classification)) continue;
      legislators.push({
        id: person.id,
        name: person.name,
        party: normalizeParty(person.party),
        chamber: role.org_classification === 'lower' ? 'house' : 'senate',
        district: normalizeDistrict(role.district),
        title: role.title,
        imageUrl: person.image,
        email: person.email,
      });
    }
    if (page >= data.pagination.max_page) break;
    page += 1;
  }

  return requireValidRoster(legislators, 'OpenStates');
}

export async function fetchLegislatorRoster(
  chamber?: 'house' | 'senate',
): Promise<LegislatorRoster> {
  const cached = getCached<LegislatorRoster>('legislator_roster');
  let roster = cached;

  if (!roster) {
    if (process.env.OPEN_STATES_API_KEY) {
      try {
        roster = {
          legislators: await fetchOpenStatesRoster(),
          source: 'openstates',
          asOf: new Date().toISOString(),
        };
      } catch (error) {
        console.error('OpenStates roster failed validation or loading:', error);
      }
    }

    if (!roster) {
      try {
        roster = {
          legislators: await fetchOfficialRoster(),
          source: 'minnesota-legislature',
          asOf: new Date().toISOString(),
        };
      } catch (error) {
        console.error('Official Minnesota roster unavailable; using verified snapshot:', error);
        roster = {
          legislators: requireValidRoster(MN_LEGISLATORS, 'Verified snapshot'),
          source: 'verified-snapshot',
          asOf: LEGISLATOR_SNAPSHOT_AS_OF,
        };
      }
    }
    setCached('legislator_roster', roster);
  }

  return {
    ...roster,
    legislators: chamber
      ? roster.legislators.filter((member) => member.chamber === chamber)
      : roster.legislators,
  };
}

export async function fetchLegislators(chamber?: 'house' | 'senate'): Promise<Legislator[]> {
  return (await fetchLegislatorRoster(chamber)).legislators;
}

export interface OpenStatesBill {
  id: string;
  identifier: string;
  title: string;
  session: string;
  sponsorships?: Array<{ name: string; primary: boolean }>;
  latest_action_description?: string;
  subject?: string[];
  abstracts?: Array<{ abstract: string }>;
  latest_action_date?: string;
  from_organization?: { name: string };
  openstates_url?: string;
}

export function mapOpenStatesBill(bill: OpenStatesBill): Bill {
  return {
    id: bill.id,
    number: bill.identifier,
    title: bill.title,
    session: bill.session,
    sponsors: bill.sponsorships ?? [],
    status: bill.latest_action_description ?? 'Unknown',
    subjects: bill.subject ?? [],
    abstract: bill.abstracts?.[0]?.abstract,
    lastActionDate: bill.latest_action_date,
    committee: bill.from_organization?.name,
    sourceUrl: bill.openstates_url,
    textUrl: buildRevisorTextUrl(bill.identifier),
  };
}

export function buildOpenStatesBillSearchParams(query: string): Record<string, string | number> {
  return {
    jurisdiction: 'mn',
    session: process.env.MN_OPENSTATES_SESSION || DEFAULT_OPEN_STATES_SESSION,
    q: query,
    per_page: 20,
  };
}

export async function searchBills(query: string): Promise<Bill[]> {
  if (process.env.OPEN_STATES_API_KEY) {
    try {
      const { data } = await axios.get<OpenStatesPagedResponse<OpenStatesBill>>(
        `${OPEN_STATES_BASE_URL}/bills`,
        {
          headers: { 'X-API-KEY': process.env.OPEN_STATES_API_KEY },
          params: buildOpenStatesBillSearchParams(query),
          timeout: 12_000,
        },
      );
      const activeSession = process.env.MN_OPENSTATES_SESSION || DEFAULT_OPEN_STATES_SESSION;
      const bills = data.results
        .filter((bill) => bill.session === activeSession)
        .map(mapOpenStatesBill);
      if (bills.length) return bills;
    } catch (error) {
      console.error('OpenStates bill search failed; trying the Minnesota Revisor:', error);
    }
  }

  return searchRevisorBills(query);
}
