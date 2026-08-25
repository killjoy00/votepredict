// Server-side only — used by Vercel API routes, not imported by frontend
import axios from 'axios';
import { MN_LEGISLATORS } from '../data/legislators.js';

const BASE_URL = 'https://v3.openstates.org';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(process.env.OPEN_STATES_API_KEY ? { 'X-API-KEY': process.env.OPEN_STATES_API_KEY } : {}),
  };
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

  // If no API key is configured, use the embedded static roster immediately.
  if (!process.env.OPEN_STATES_API_KEY) {
    const result = filterByChamber(MN_LEGISLATORS, chamber);
    setCached(cacheKey, result);
    return result;
  }

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
      console.error('OpenStates fetch error — falling back to static roster:', error);
      // Fall back to static data so the app stays functional.
      const result = filterByChamber(MN_LEGISLATORS, chamber);
      setCached(cacheKey, result);
      return result;
    }
  }

  if (legislators.length === 0) {
    // OpenStates returned nothing (rate-limited or empty) — use static roster.
    const result = filterByChamber(MN_LEGISLATORS, chamber);
    setCached(cacheKey, result);
    return result;
  }

  legislators.sort((a, b) => a.name.localeCompare(b.name));
  setCached(cacheKey, legislators);
  return legislators;
}

function filterByChamber(list: Legislator[], chamber?: 'house' | 'senate'): Legislator[] {
  const filtered = chamber ? list.filter((l) => l.chamber === chamber) : list;
  return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchBills(query: string): Promise<Bill[]> {
  // Try OpenStates first if an API key is available.
  if (process.env.OPEN_STATES_API_KEY) {
    try {
      const { data } = await axios.get<OpenStatesPagedResponse<OpenStatesBill>>(
        `${BASE_URL}/bills`,
        {
          headers: getHeaders(),
          params: { jurisdiction: 'mn', q: query, per_page: 20 },
          timeout: 10000,
        }
      );
      return data.results.map(mapBill);
    } catch (error) {
      console.error('OpenStates bill search error:', error);
      // Fall through to MN Revisor search.
    }
  }

  // Fall back to the Minnesota Legislature Revisor's public search (no key needed).
  return searchMNRevisor(query);
}

async function searchMNRevisor(query: string): Promise<Bill[]> {
  try {
    // MN Legislature full-text bill search — returns JSON when Accept header is set.
    const { data } = await axios.get<RevisorSearchResponse>(
      'https://www.revisor.mn.gov/bills/status_search.php',
      {
        params: {
          keyword: query,
          session: '93',          // 93rd Legislature (2025-2026)
          session_year: '2025',
          session_number: '0',
          type: 'bill',
          SDivision: 'all',
          HDivision: 'all',
        },
        headers: { Accept: 'application/json', 'User-Agent': 'MN-VotePredictor/1.0' },
        timeout: 10000,
      }
    );

    if (!Array.isArray(data?.bills)) return [];

    return data.bills.slice(0, 20).map((b) => ({
      id: b.bill_id ?? b.number ?? '',
      number: b.number ?? '',
      title: b.title ?? '(no title)',
      session: '2025-2026',
      sponsors: b.chief_author ? [{ name: b.chief_author, primary: true }] : [],
      status: b.status ?? 'Introduced',
      subjects: b.subjects ?? [],
      abstract: b.description,
      lastActionDate: b.last_action_date,
      committee: b.committee,
    }));
  } catch {
    // Revisor search also unavailable — throw a user-friendly error.
    throw new Error(
      'Bill search is currently unavailable. Use "Enter Manually" mode to paste a bill description directly.'
    );
  }
}

interface RevisorSearchResponse {
  bills?: Array<{
    bill_id?: string;
    number?: string;
    title?: string;
    chief_author?: string;
    status?: string;
    subjects?: string[];
    description?: string;
    last_action_date?: string;
    committee?: string;
  }>;
}

function mapBill(b: OpenStatesBill): Bill {
  return {
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
  };
}
