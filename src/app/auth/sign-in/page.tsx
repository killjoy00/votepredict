import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getOwnerIdentity, userMatchesOwner } from '@/lib/auth/owner';
import { SignInForm } from './sign-in-form';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const owner = await getOwnerIdentity();
  if (!owner) redirect('/auth/setup');

  const { data: session } = await auth.getSession();
  if (session?.user && await userMatchesOwner(session.user)) redirect('/dashboard');

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">VP</div>
        <p className="eyebrow">Private workspace</p>
        <h1>Sign in to VotePredict</h1>
        <p className="muted">Forecasts, evidence, and revisions stay behind your owner account.</p>
        <SignInForm />
      </section>
    </main>
  );
}
