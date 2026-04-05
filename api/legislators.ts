import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchLegislators } from '../src/services/openStates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const chamber = req.query.chamber as 'house' | 'senate' | undefined;
    if (chamber && chamber !== 'house' && chamber !== 'senate') {
      return res.status(400).json({ error: 'chamber must be "house" or "senate"' });
    }

    const legislators = await fetchLegislators(chamber);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(legislators);
  } catch (error) {
    console.error('legislators handler error:', error);
    return res.status(500).json({ error: 'Failed to fetch legislators' });
  }
}
