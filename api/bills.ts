import { searchBills } from '../src/services/openStates.js';
import { enforceRateLimit } from '../src/services/rateLimit.js';
import type { ApiRequest, ApiResponse } from '../src/types/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, 'bills', { maxRequests: 60, windowMs: 5 * 60_000 })) {
    return;
  }

  const q = req.query.q;
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  if (q.length > 120) {
    return res.status(400).json({ error: 'Query parameter "q" must be 120 characters or fewer' });
  }

  try {
    const bills = await searchBills(q.trim());
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(bills);
  } catch (error) {
    console.error('bills handler error:', error);
    return res.status(500).json({ error: 'Failed to search bills' });
  }
}
