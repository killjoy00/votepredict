import { NextResponse } from 'next/server';
import { HISTORICAL_DEEP_PILOT_CASES } from '@/evaluation/historical-deep-pilot';
import {
  HISTORICAL_DEEP_OUTCOME_SNAPSHOT_SCHEMA,
  type HistoricalDeepOutcomeCase,
} from '@/evaluation/historical-deep-outcome-scorer';
import { pool } from '@/lib/db';

export const maxDuration = 300;

type EventRow = { vote_event_id: string };
type MemberRow = {
  membership_id: string;
  legislator_id: string;
  member_name: string;
  choice: 'yea' | 'nay';
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  try {
    const cases: HistoricalDeepOutcomeCase[] = [];
    for (const spec of HISTORICAL_DEEP_PILOT_CASES) {
      const eventResult = await pool.query<EventRow>(`
        SELECT ve.id AS vote_event_id
          FROM vote_events ve
          JOIN bills b ON b.id = ve.bill_id
          JOIN legislative_sessions s ON s.id = ve.session_id
          JOIN chambers c ON c.id = ve.chamber_id
         WHERE s.slug = $1
           AND c.slug = $2
           AND upper(replace(b.identifier, ' ', '')) = upper(replace($3, ' ', ''))
           AND ve.occurred_on = $4::date
           AND ve.is_passage = true
           AND ve.passed IS NOT NULL`, [spec.session, spec.chamber, spec.identifier, spec.occurredOn]);
      if (eventResult.rows.length !== 1) {
        throw new Error(`Expected exactly one official passage vote for ${spec.session}|${spec.chamber}|${spec.identifier}|${spec.occurredOn}; found ${eventResult.rows.length}`);
      }
      const voteEventId = eventResult.rows[0].vote_event_id;
      const memberResult = await pool.query<MemberRow>(`
        SELECT mv.membership_id,
               m.legislator_id,
               l.name AS member_name,
               mv.choice
          FROM member_votes mv
          JOIN memberships m ON m.id = mv.membership_id
          JOIN legislators l ON l.id = m.legislator_id
         WHERE mv.vote_event_id = $1
           AND mv.choice IN ('yea', 'nay')
         ORDER BY l.name, mv.membership_id`, [voteEventId]);
      if (memberResult.rows.length === 0) throw new Error(`No decisive member outcomes for ${voteEventId}`);
      cases.push({
        ...spec,
        voteEventId,
        members: memberResult.rows.map((row) => ({
          membershipId: row.membership_id,
          legislatorId: row.legislator_id,
          memberName: row.member_name,
          actualOutcome: row.choice === 'yea' ? 1 : 0,
        })),
      });
    }

    return NextResponse.json({
      schemaVersion: HISTORICAL_DEEP_OUTCOME_SNAPSHOT_SCHEMA,
      generatedAt: new Date().toISOString(),
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      purpose: 'evaluation-only frozen label snapshot created after discovery candidate extraction; official historical outcomes only, no forecast writes or serving changes',
      cases,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Historical Deep outcome snapshot failed', message);
    return NextResponse.json({ error: 'Historical Deep outcome snapshot failed' }, { status: 500 });
  }
}
