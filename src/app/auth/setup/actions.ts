'use server';

import { createHash, timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { pool } from '@/lib/db';
import { claimOwnerIdentity, getOwnerIdentity } from '@/lib/auth/owner';

const OWNER_SETUP_TOKEN_SHA256 = '7d5b2ac0c35bafc449d08ebbd2c244283967b212ffae1aeaff186d1fd43ce78c';

export type OwnerSetupState = {
  error: string | null;
};

function matchesSetupToken(value: string): boolean {
  const actual = createHash('sha256').update(value).digest();
  const expected = Buffer.from(OWNER_SETUP_TOKEN_SHA256, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createOwnerAccount(
  _previousState: OwnerSetupState,
  formData: FormData,
): Promise<OwnerSetupState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const setupCode = String(formData.get('setupCode') ?? '').trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !matchesSetupToken(setupCode)) {
    return { error: 'The email or one-time setup code is not valid.' };
  }
  if (password.length < 8) {
    return { error: 'Choose a password with at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { error: 'The passwords do not match.' };
  }

  if (await getOwnerIdentity()) {
    return { error: 'The owner account has already been created. Sign in instead.' };
  }

  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM neon_auth."user" WHERE lower(email) = $1 LIMIT 1',
    [email],
  );

  let userId = existing.rows[0]?.id;
  if (userId) {
    const signIn = await auth.signIn.email({ email, password });
    if (signIn.error) {
      return { error: 'An account with this email already exists, but the password did not match.' };
    }
  } else {
    const signUp = await auth.signUp.email({
      email,
      password,
      name: 'VotePredict Owner',
    });
    if (signUp.error) {
      return { error: signUp.error.message ?? 'Owner account creation failed.' };
    }

    const created = await pool.query<{ id: string }>(
      'SELECT id FROM neon_auth."user" WHERE lower(email) = $1 ORDER BY "createdAt" DESC LIMIT 1',
      [email],
    );
    userId = created.rows[0]?.id;
  }

  if (!userId) {
    return { error: 'The account was authenticated, but VotePredict could not bind it as owner.' };
  }

  const claimed = await claimOwnerIdentity(userId, email);
  if (!claimed) {
    return { error: 'The owner account was claimed by another setup attempt. Sign in with the owner account.' };
  }

  redirect('/dashboard');
}
