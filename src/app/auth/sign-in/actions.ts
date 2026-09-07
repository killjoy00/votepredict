'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getOwnerIdentity } from '@/lib/auth/owner';

export type SignInState = {
  error: string | null;
};

export async function signInOwner(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const owner = await getOwnerIdentity();
  if (!owner) redirect('/auth/setup');

  if (email !== owner.email.trim().toLowerCase()) {
    return { error: 'This account is not the VotePredict owner.' };
  }

  try {
    const result = await auth.signIn.email({ email, password });
    if (result.error) {
      return { error: result.error.message ?? 'Sign in failed.' };
    }
  } catch {
    return { error: 'Sign in could not be completed. Please try again.' };
  }

  redirect('/dashboard');
}
