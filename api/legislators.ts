import { fetchLegislatorRoster } from '../src/services/openStates.js';
import { enforceRateLimit } from '../src/services/rateLimit.js';
import type { ApiRequest, ApiResponse } from '../src/types/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, 'legislators', { maxRequests: 120, windowMs: 5 * 60_000 })) {
    return;
  }

  try {
    const requestedChamber = req.query.chamber;
    if (requestedChamber && requestedChamber !== 'house' && requestedChamber !== 'senate') {
      return res.status(400).json({ error: 'chamber must be "house" or "senate"' });
    }
    const chamber = requestedChamber === 'house' || requestedChamber === 'senate'
      ? requestedChamber
      : undefined;

    const roster = await fetchLegislatorRoster(chamber);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(roster);
  } catch (error) {
    console.error('legislators handler error:', error);
    return res.status(500).json({ error: 'Failed to fetch legislators' });
  }
}
