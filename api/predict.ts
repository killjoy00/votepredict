import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchLegislators } from '../src/services/openStates.js';
import { predictVotes } from '../src/services/claude.js';

// Extend timeout to 60s — Claude needs time to analyze all legislators
export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { billDescription, billTitle, billNumber, subjects, sponsors } = req.body ?? {};

  if (typeof billDescription !== 'string' || !billDescription.trim()) {
    return res.status(400).json({ error: 'billDescription is required' });
  }
  if (billDescription.length > 12_000) {
    return res.status(400).json({ error: 'billDescription must be 12,000 characters or fewer' });
  }
  if (billTitle !== undefined && typeof billTitle !== 'string') {
    return res.status(400).json({ error: 'billTitle must be a string' });
  }
  if (billNumber !== undefined && typeof billNumber !== 'string') {
    return res.status(400).json({ error: 'billNumber must be a string' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Vote prediction is not configured on this server' });
  }

  try {
    const legislators = await fetchLegislators();
    if (legislators.length === 0) {
      return res.status(503).json({ error: 'Could not fetch legislators from OpenStates. Try again shortly.' });
    }

    const result = await predictVotes({
      billTitle: billTitle?.trim().slice(0, 300) || 'Untitled Bill',
      billNumber: billNumber?.trim().slice(0, 40),
      billDescription: billDescription.trim(),
      subjects: Array.isArray(subjects)
        ? subjects.filter((value): value is string => typeof value === 'string').slice(0, 20).map((value) => value.slice(0, 120))
        : [],
      sponsors: Array.isArray(sponsors)
        ? sponsors.filter((value): value is string => typeof value === 'string').slice(0, 20).map((value) => value.slice(0, 120))
        : [],
      legislators,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (error) {
    console.error('predict handler error:', error);
    return res.status(500).json({ error: 'Prediction failed. Please try again.' });
  }
}
