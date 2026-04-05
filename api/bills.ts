import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchBills } from '../src/services/openStates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = req.query.q as string | undefined;
  if (!q?.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
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
