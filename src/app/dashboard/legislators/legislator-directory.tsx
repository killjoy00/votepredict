'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { LegislatorDirectoryRow } from '@/legislators/profile';
import styles from './legislators.module.css';

export function LegislatorDirectory({ members }: { members: LegislatorDirectoryRow[] }) {
  const [query, setQuery] = useState('');
  const [chamber, setChamber] = useState('all');
  const [party, setParty] = useState('all');

  const chamberOptions = useMemo(
    () => [...new Map(members.map((member) => [member.chamberSlug, member.chamberName])).entries()],
    [members],
  );
  const partyOptions = useMemo(
    () => [...new Set(members.map((member) => member.party))].sort(),
    [members],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (chamber !== 'all' && member.chamberSlug !== chamber) return false;
      if (party !== 'all' && member.party !== party) return false;
      if (!needle) return true;
      return `${member.name} ${member.party} ${member.district} ${member.chamberName}`.toLowerCase().includes(needle);
    });
  }, [chamber, members, party, query]);

  return (
    <>
      <section className={styles.directoryControls} aria-label="Legislator filters">
        <label className={styles.searchField}>
          <span>Find a legislator</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, district, party…"
            type="search"
          />
        </label>
        <label>
          <span>Chamber</span>
          <select value={chamber} onChange={(event) => setChamber(event.target.value)}>
            <option value="all">Both chambers</option>
            {chamberOptions.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
        </label>
        <label>
          <span>Party</span>
          <select value={party} onChange={(event) => setParty(event.target.value)}>
            <option value="all">All parties</option>
            {partyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className={styles.resultCount}>
          <strong>{visible.length}</strong>
          <span>current legislators</span>
        </div>
      </section>

      <section className={styles.directoryGrid} aria-label="Current legislators">
        {visible.map((member) => (
          <Link
            key={member.membershipId}
            href={`/dashboard/legislators/${member.legislatorId}`}
            className={styles.memberCard}
          >
            <div className={styles.memberCardTopline}>
              <span>{member.chamberName}</span>
              <span>{member.party}</span>
            </div>
            <strong>{member.name}</strong>
            <p>{member.title} · District {member.district}</p>
            <span className={styles.openProfile}>Open profile →</span>
          </Link>
        ))}
      </section>

      {visible.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No current legislators match those filters.</strong>
          <span>Try a broader name, chamber, or party filter.</span>
        </div>
      ) : null}
    </>
  );
}
