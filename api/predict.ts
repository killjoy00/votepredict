import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchLegislators } from '../src/services/openStates.js';
import { predictVotes } from '../src/services/claude.js';

// Extend timeout to 60s — Claude needs time to analyze all legislators
export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { billDescription, billTitle, billNumber, subjects, sponsors } = req.body ?? {};

  if (!billDescription?.trim()) {
    return res.status(400).json({ error: 'billDescription is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on this server' });
  }

  try {
    const legislators = await fetchLegislators();
    if (legislators.length === 0) {
      return res.status(503).json({ error: 'Could not fetch legislators from OpenStates. Try again shortly.' });
    }

    const result = await predictVotes({
      billTitle: billTitle?.trim() || 'Untitled Bill',
      billNumber: billNumber?.trim(),
      billDescription: billDescription.trim(),
      subjects: Array.isArray(subjects) ? subjects : [],
      sponsors: Array.isArray(sponsors) ? sponsors : [],
      legislators,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('predict handler error:', error);
    const message = error instanceof Error ? error.message : 'Prediction failed';
    return res.status(500).json({ error: message });
  }
}
