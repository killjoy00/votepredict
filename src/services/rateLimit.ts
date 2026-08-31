import type { ApiRequest, ApiResponse } from '../types/http.js';

export interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function header(req: ApiRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getClientIp(req: ApiRequest): string {
  const forwarded = header(req, 'x-vercel-forwarded-for') || header(req, 'x-forwarded-for');
  return forwarded?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, bucket);
  }

  const allowed = bucket.count < rule.maxRequests;
  if (allowed) bucket.count += 1;

  if (buckets.size > 5_000) {
    for (const [bucketKey, candidate] of buckets) {
      if (now >= candidate.resetAt) buckets.delete(bucketKey);
    }
  }

  return {
    allowed,
    remaining: Math.max(0, rule.maxRequests - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

export function enforceRateLimit(
  req: ApiRequest,
  res: ApiResponse,
  namespace: string,
  rule: RateLimitRule,
): boolean {
  const result = consumeRateLimit(`${namespace}:${getClientIp(req)}`, rule);
  res.setHeader('RateLimit-Limit', String(rule.maxRequests));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt / 1_000)));

  if (result.allowed) return true;

  res.setHeader('Retry-After', String(result.retryAfterSeconds));
  res.status(429).json({
    error: 'Too many requests. Please wait before trying again.',
    retryAfterSeconds: result.retryAfterSeconds,
  });
  return false;
}

export function isSameOriginRequest(req: ApiRequest): boolean {
  const origin = header(req, 'origin');
  if (!origin) return true;

  const forwardedHost = header(req, 'x-forwarded-host');
  const host = forwardedHost || header(req, 'host');
  if (!host) return false;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    if (originHost === host.toLowerCase()) return true;

    const configuredOrigin = process.env.PUBLIC_SITE_URL;
    return configuredOrigin ? origin === new URL(configuredOrigin).origin : false;
  } catch {
    return false;
  }
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
