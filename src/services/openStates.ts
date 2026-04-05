// Server-side only — used by Vercel API routes, not imported by frontend
import axios from 'axios';

const BASE_URL = 'https://v3.openstates.org';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.OPEN_STATES_API_KEY) {
    headers['X-API-KEY'] = process.env.OPEN_STATES_API_KEY;
  }
  return headers;
}

// Simple in-memory cache (works within a single Vercel function invocation;
// may persist across warm instances in production)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export interface Legislator {
  id: string;
  name: string;
  party: string;
  chamber: 'house' | 'senate';
  district: string;
  title: string;
  imageUrl?: string;
  email?: string;
}

export interface Bill {
  id: string;
  number: string;
  title: string;
  session: string;
  sponsors: Array<{ name: string; primary: boolean }>;
  status: string;
  subjects: string[];
  abstract?: string;
  lastActionDate?: string;
  committee?: string;
}

interface OpenStatesPerson {
  id: string;
  name: string;
  party: string;
  current_role: {
    title: string;
    org_classification: 'lower' | 'upper';
    district: string;
  };
  image?: string;
  email?: string;
}

interface OpenStatesPagedResponse<T> {
  results: T[];
  pagination: {
    total_items: number;
    per_page: number;
    page: number;
    max_page: number;
  };
}

interface OpenStatesBill {
  id: string;
  identifier: string;
  title: string;
  session: string;
  sponsorships: Array<{ name: string; primary: boolean }>;
  latest_action_description: string;
  subject: string[];
  abstracts?: Array<{ abstract: string }>;
  latest_action_date?: string;
  from_organization?: { name: string };
}

function normalizeParty(party: string): string {
  const lower = party.toLowerCase();
  if (lower.includes('democrat') || lower === 'dfl') return 'DFL';
  if (lower.includes('republican') || lower === 'gop') return 'Republican';
  if (lower.includes('independent')) return 'Independent';
  return party;
}

export async function fetchLegislators(chamber?: 'house' | 'senate'): Promise<Legislator[]> {
  const cacheKey = `legislators_${chamber ?? 'all'}`;
  const cached = getCached<Legislator[]>(cacheKey);
  if (cached) return cached;

  const legislators: Legislator[] = [];
  let page = 1;
  let hasMore = true;

  const orgClass = chamber === 'house' ? 'lower' : chamber === 'senate' ? 'upper' : undefined;

  while (hasMore) {
    const params: Record<string, string | number> = {
      jurisdiction: 'mn',
      current_role: 'true',
      per_page: 100,
      page,
    };
    if (orgClass) params['org_classification'] = orgClass;

    try {
      const { data } = await axios.get<OpenStatesPagedResponse<OpenStatesPerson>>(
        `${BASE_URL}/people`,
        { headers: getHeaders(), params, timeout: 15000 }
      );

      for (const person of data.results) {
        if (!person.current_role) continue;
        const org = person.current_role.org_classification;
        if (org !== 'lower' && org !== 'upper') continue;

        legislators.push({
          id: person.id,
          name: person.name,
          party: normalizeParty(person.party),
          chamber: org === 'lower' ? 'house' : 'senate',
          district: person.current_role.district,
          title: person.current_role.title,
          imageUrl: person.image,
          email: person.email,
        });
      }

      hasMore = page < data.pagination.max_page;
      page++;
    } catch (error) {
      console.error('OpenStates fetch error:', error);
      hasMore = false;
    }
  }

  legislators.sort((a, b) => a.name.localeCompare(b.name));
  setCached(cacheKey, legislators);
  return legislators;
}

export async function searchBills(query: string): Promise<Bill[]> {
  try {
    const { data } = await axios.get<OpenStatesPagedResponse<OpenStatesBill>>(
      `${BASE_URL}/bills`,
      {
        headers: getHeaders(),
        params: { jurisdiction: 'mn', q: query, per_page: 20 },
        timeout: 10000,
      }
    );

    return data.results.map((b) => ({
      id: b.id,
      number: b.identifier,
      title: b.title,
      session: b.session,
      sponsors: b.sponsorships ?? [],
      status: b.latest_action_description ?? 'Unknown',
      subjects: b.subject ?? [],
      abstract: b.abstracts?.[0]?.abstract,
      lastActionDate: b.latest_action_date,
      committee: b.from_organization?.name,
    }));
  } catch (error) {
    console.error('Bill search error:', error);
    return [];
  }
}
