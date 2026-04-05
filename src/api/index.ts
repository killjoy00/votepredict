import type { Legislator, Bill, VotePredictionResult } from '../types/index.js';

const BASE = '/api';

export async function fetchLegislators(chamber?: 'house' | 'senate'): Promise<Legislator[]> {
  const url = chamber ? `${BASE}/legislators?chamber=${chamber}` : `${BASE}/legislators`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to fetch legislators');
  }
  return res.json();
}

export async function searchBills(query: string): Promise<Bill[]> {
  const res = await fetch(`${BASE}/bills?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to search bills');
  }
  return res.json();
}

export async function predictVotes(payload: {
  billDescription: string;
  billTitle?: string;
  billNumber?: string;
  subjects?: string[];
  sponsors?: string[];
}): Promise<VotePredictionResult> {
  const res = await fetch(`${BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Prediction failed');
  }
  return res.json();
}
