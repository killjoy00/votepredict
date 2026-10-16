/**
 * Persist raw Minnesota Senate elections. Only this additive lane is written;
 * do not update members, historical votes, forecasts or evidence.
 */
import type { PoolClient } from 'pg';
import { normalizeMemberName } from '../sources/minnesota/house-votes.js';
import type { SenateElectionDownload,SenateElectionEvent } from '../sources/minnesota/senate-election-results.js';

// Even-year November elections elect members for the NEXT biennium.
// Other special elections fill the CURRENT biennium.
function electedServiceSession(event: SenateElectionEvent): string {
  const year = Number(event.date.slice(0, 4));
  const month = Number(event.date.slice(5, 7));
  const starts = event.type === 'general' && year % 2 === 0 && month >= 11
    ? year + 1 : year % 2 === 0 ? year - 1 : year;
  return String(starts) + '-' + String(starts + 1);
}
interface SenatorMembership {
  id: string;
  district: string;
  name: string;
  aliases: string[];
}

/** Only a unique exact normalized district + name/alias match is linked. */
async function memberLinks(client: PoolClient, event: SenateElectionEvent): Promise<Map<string, string>> {
  const result = await client.query<SenatorMembership>([
    'SELECT m.id, m.district, l.name,',
    "COALESCE(array_agg(a.source_name) FILTER (WHERE a.source_name IS NOT NULL), ARRAY[]::text[]) AS aliases",
    'FROM memberships m',
    'JOIN legislative_sessions s ON s.id=m.session_id',
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'",
    'JOIN legislators l ON l.id=m.legislator_id',
    'LEFT JOIN membership_source_aliases a ON a.membership_id=m.id',
    'WHERE s.slug=$1 GROUP BY m.id,m.district,l.name',
  ].join(' '), [electedServiceSession(event)]);
  const possible = new Map<string, Set<string>>();
  for (const member of result.rows) {
    for (const name of [member.name, ...member.aliases]) {
      const key = member.district + '|' + normalizeMemberName(name);
      const ids = possible.get(key) ?? new Set<string>();
      ids.add(member.id);
      possible.set(key, ids);
    }
  }
  const unique = new Map<string, string>();
  for (const [key, ids] of possible) if (ids.size === 1) unique.set(key, [...ids][0]);
  return unique;
}

export async function storeSenateElectionDownload(client: PoolClient, download: SenateElectionDownload): Promise<number> {
  const { event } = download;
  await client.query('BEGIN');
  try {
    const source = await client.query<{ id: string }>([
      'INSERT INTO mn_senate_election_source_snapshots',
      '(election_date,election_type,post_2022_redistricting,source_url,source_index_url,source_kind,original_observed_on,',
      'fetched_at,content_type,content_sha256,raw_content,raw_bytes_base64)',
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      'ON CONFLICT (election_date,election_type,source_url,content_sha256)',
      'DO UPDATE SET fetched_at=EXCLUDED.fetched_at RETURNING id',
    ].join(' '), [
      event.date, event.type, download.post2022Redistricting, download.sourceUrl,
      download.indexUrl, download.sourceKind, download.originalObservedOn, download.fetchedAt,
      download.contentType, download.contentSha256, download.rawContent, download.rawBase64,
    ]);
    const sourceId = source.rows[0].id;
    const members = event.type === 'primary' || event.type === 'special_primary'
      ? new Map<string, string>() : await memberLinks(client, event);
    let matched = 0;
    for (const record of download.candidates) {
      const membershipId = record.winner
        ? members.get(record.district + '|' + normalizeMemberName(record.candidate)) ?? null : null;
      if (membershipId) matched++;
      await client.query([
        'INSERT INTO mn_senate_election_raw_results',
        '(source_snapshot_id,source_ordinal,election_date,election_type,',
        'post_2022_redistricting,district,candidate_name,party,votes,total_votes,',
        'vote_share_percent,winner,membership_id,source_url,fetched_at,raw_line)',
        'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
        'ON CONFLICT (source_snapshot_id,source_ordinal) DO UPDATE SET',
        'membership_id=EXCLUDED.membership_id,fetched_at=EXCLUDED.fetched_at',
      ].join(' '), [
        sourceId, record.sourceOrdinal, event.date, event.type, download.post2022Redistricting,
        record.district, record.candidate, record.party, record.votes,
        record.totalVotes, record.voteShare, record.winner, membershipId,
        download.sourceUrl, download.fetchedAt, record.rawLine,
      ]);
    }
    await client.query('COMMIT');
    return matched;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

