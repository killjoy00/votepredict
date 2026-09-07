import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getOwnerIdentity, userMatchesOwner } from '@/lib/auth/owner';
import { OwnerSetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default async function OwnerSetupPage() {
  const { data: session } = await auth.getSession();

  let owner;
  try {
    owner = await getOwnerIdentity();
  } catch {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark">VP</div>
          <p className="eyebrow">Private workspace</p>
          <h1>Owner setup is temporarily unavailable</h1>
          <p className="muted">VotePredict cannot currently reach its production database. The account setup form will return once the database connection is healthy.</p>
        </section>
      </main>
    );
  }

  if (owner) {
    if (session?.user && await userMatchesOwner(session.user)) redirect('/dashboard');
    redirect('/auth/sign-in');
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">VP</div>
        <p className="eyebrow">Private workspace</p>
        <h1>Create the VotePredict owner account</h1>
        <p className="muted">
          This is a one-time bootstrap. Enter the email you want to use, choose a password, and enter the setup code provided privately.
        </p>
        <OwnerSetupForm />
      </section>
    </main>
  );
}
