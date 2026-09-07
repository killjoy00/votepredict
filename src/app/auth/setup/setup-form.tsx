'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createOwnerAccount, type OwnerSetupState } from './actions';

const initialState: OwnerSetupState = { error: null };

export function OwnerSetupForm() {
  const [state, formAction, pending] = useActionState(createOwnerAccount, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label>
        Owner email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        Confirm password
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        One-time setup code
        <input name="setupCode" type="password" autoComplete="off" required />
      </label>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create owner account'}</button>
      <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
        Already set up? <Link href="/auth/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
