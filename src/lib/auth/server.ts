import { createNeonAuth } from '@neondatabase/auth/next/server';

const buildFallbackSecret = 'votepredict-build-only-cookie-secret-not-for-runtime';

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? 'https://auth.invalid',
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET ?? buildFallbackSecret,
    sessionDataTtl: 300,
  },
});
