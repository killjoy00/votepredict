import { fetchRevisorBillText } from '../src/services/revisor.js';
import { enforceRateLimit } from '../src/services/rateLimit.js';
import type { ApiRequest, ApiResponse } from '../src/types/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!enforceRateLimit(req, res, 'bill-text', { maxRequests: 30, windowMs: 5 * 60_000 })) {
    return;
  }

  const url = req.query.url;
  if (typeof url !== 'string' || !url) {
    return res.status(400).json({ error: 'Query parameter "url" is required' });
  }
  if (url.length > 300) {
    return res.status(400).json({ error: 'Bill text URL is too long' });
  }

  try {
    const billText = await fetchRevisorBillText(url);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(billText);
  } catch (error) {
    const isValidationError = error instanceof Error
      && (error.message.startsWith('Invalid') || error.message.startsWith('Only official'));
    if (!isValidationError) console.error('bill text handler error:', error);
    return res.status(isValidationError ? 400 : 502).json({
      error: isValidationError
        ? 'A valid official Minnesota Revisor bill URL is required'
        : 'Official bill text is temporarily unavailable',
    });
  }
}
