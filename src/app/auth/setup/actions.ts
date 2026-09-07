'use server';

import { createHash, timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { pool } from '@/lib/db';

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
  const configuredOwner = process.env.VOTEPREDICT_OWNER_EMAIL?.trim().toLowerCase();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const setupCode = String(formData.get('setupCode') ?? '').trim();

  if (!configuredOwner) {
    return { error: 'Owner access is not configured on this deployment.' };
  }
  if (!email || email !== configuredOwner || !matchesSetupToken(setupCode)) {
    return { error: 'The owner email or one-time setup code is not valid.' };
  }
  if (password.length < 8) {
    return { error: 'Choose a password with at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { error: 'The passwords do not match.' };
  }

  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM neon_auth."user" WHERE lower(email) = $1 LIMIT 1',
    [configuredOwner],
  );
  if (existing.rowCount) {
    return { error: 'The owner account already exists. Sign in instead.' };
  }

  const result = await auth.signUp.email({
    email: configuredOwner,
    password,
    name: 'VotePredict Owner',
  });
  if (result.error) {
    return { error: result.error.message ?? 'Owner account creation failed.' };
  }

  redirect('/dashboard');
}
