'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? 'Sign in failed.');
      setPending(false);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">VP</div>
        <p className="eyebrow">Private workspace</p>
        <h1>Sign in to VotePredict</h1>
        <p className="muted">Forecasts, evidence, and revisions stay behind your owner account.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
          <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
            First time here? <Link href="/auth/setup">Create the owner account</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
