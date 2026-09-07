import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guard';
import { loadCurrentLegislators } from '@/legislators/profile';
import { LegislatorDirectory } from './legislator-directory';
import styles from './legislators.module.css';

export const dynamic = 'force-dynamic';

export default async function LegislatorsPage() {
  await requireOwner();
  const members = await loadCurrentLegislators();

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brandLink}>
          <span className={styles.brandMark}>VP</span>
          <span>VotePredict</span>
        </Link>
        <nav className={styles.topLinks} aria-label="Workspace navigation">
          <Link href="/dashboard" className={styles.backLink}>Forecast desk</Link>
          <Link href="/dashboard/forecasts" className={styles.backLink}>Forecast history</Link>
        </nav>
      </header>

      <section className={styles.directoryHeading}>
        <span className={styles.kicker}>Legislator intelligence</span>
        <h1>Know the chamber.</h1>
        <p>
          Current Minnesota legislators with data-backed profiles built from recorded passage votes,
          issue tags, voting alignment, stored source evidence, and 2025–26 campaign-finance disclosures.
        </p>
      </section>

      <LegislatorDirectory members={members} />
    </main>
  );
}
