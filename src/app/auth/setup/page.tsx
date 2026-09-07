import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { OwnerSetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default async function OwnerSetupPage() {
  const { data: session } = await auth.getSession();
  const ownerEmail = process.env.VOTEPREDICT_OWNER_EMAIL?.trim().toLowerCase();
  const userEmail = session?.user?.email?.trim().toLowerCase();

  if (ownerEmail && userEmail === ownerEmail) redirect('/dashboard');

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">VP</div>
        <p className="eyebrow">Private workspace</p>
        <h1>Create the VotePredict owner account</h1>
        <p className="muted">
          This is a one-time bootstrap. Use the configured owner email, choose a password, and enter the setup code provided privately.
        </p>
        <OwnerSetupForm />
      </section>
    </main>
  );
}
