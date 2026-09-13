import { NextResponse } from 'next/server';
import type { HistoricalDeepExpansionDiscoveryManifest } from '@/evaluation/historical-deep-expansion-discovery';
import {
  HISTORICAL_DEEP_EXPANSION_OUTCOME_SNAPSHOT_SCHEMA,
  type HistoricalDeepExpansionOutcomeCase,
} from '@/evaluation/historical-deep-expansion-outcome-scorer';
import { pool } from '@/lib/db';

export const maxDuration = 300;

type CandidateArtifactLineage = {
  workflowRunId: string;
  artifactId: number;
  artifactSha256: string;
  headSha: string;
};

type RequestBody = {
  discovery: HistoricalDeepExpansionDiscoveryManifest;
  candidateArtifact: CandidateArtifactLineage;
};

type EventRow = {
  vote_event_id: string;
  external_key: string;
  identifier: string;
  session_slug: string;
  chamber_slug: string;
  occurred_on: string;
  is_passage: boolean;
  passed: boolean | null;
};

type MemberRow = {
  membership_id: string;
  legislator_id: string;
  member_name: string;
  choice: 'yea' | 'nay';
};

function validateRequestBody(body: RequestBody): void {
  if (body.discovery?.schemaVersion !== 'historical-deep-expansion-discovery-manifest-v1') {
    throw new Error('Frozen expansion discovery manifest is required');
  }
  if (!Array.isArray(body.discovery.cases) || body.discovery.cases.length !== 24) {
    throw new Error(`Expected 24 frozen expansion cases, got ${body.discovery?.cases?.length ?? 'unknown'}`);
  }
  if (
    !body.candidateArtifact
    || !body.candidateArtifact.workflowRunId
    || !Number.isInteger(body.candidateArtifact.artifactId)
    || body.candidateArtifact.artifactId <= 0
    || !/^[a-f0-9]{64}$/i.test(body.candidateArtifact.artifactSha256)
    || !/^[a-f0-9]{40}$/i.test(body.candidateArtifact.headSha)
  ) {
    throw new Error('Pinned post-discovery candidate artifact lineage is required');
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ error: 'Production runtime required' }, { status: 409 });
  }

  try {
    const body = await request.json() as RequestBody;
    validateRequestBody(body);
    const seenStableKeys = new Set<string>();
    const seenVoteIds = new Set<string>();
    const cases: HistoricalDeepExpansionOutcomeCase[] = [];

    for (const spec of body.discovery.cases) {
      if (seenStableKeys.has(spec.stableKey)) throw new Error(`Duplicate frozen stable key: ${spec.stableKey}`);
      if (seenVoteIds.has(spec.voteEventId)) throw new Error(`Duplicate frozen vote event: ${spec.voteEventId}`);
      seenStableKeys.add(spec.stableKey);
      seenVoteIds.add(spec.voteEventId);

      const eventResult = await pool.query<EventRow>(`
        SELECT ve.id AS vote_event_id,
               ve.external_key,
               b.identifier,
               s.slug AS session_slug,
               c.slug AS chamber_slug,
               ve.occurred_on::text,
               ve.is_passage,
               ve.passed
          FROM vote_events ve
          JOIN bills b ON b.id = ve.bill_id
          JOIN legislative_sessions s ON s.id = ve.session_id
          JOIN chambers c ON c.id = ve.chamber_id
         WHERE ve.id = $1`, [spec.voteEventId]);
      if (eventResult.rows.length !== 1) {
        throw new Error(`Expected exactly one frozen vote row for ${spec.stableKey}; found ${eventResult.rows.length}`);
      }
      const event = eventResult.rows[0];
      if (
        event.external_key !== spec.externalKey
        || event.identifier !== spec.identifier
        || event.session_slug !== spec.session
        || event.chamber_slug !== spec.chamber
        || event.occurred_on !== spec.occurredOn
      ) {
        throw new Error(`Frozen expansion outcome lineage mismatch for ${spec.stableKey}`);
      }
      if (!event.is_passage || event.passed === null) {
        throw new Error(`Frozen expansion event is not a completed passage vote: ${spec.stableKey}`);
      }

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
         ORDER BY l.name, mv.membership_id`, [spec.voteEventId]);
      if (memberResult.rows.length === 0) {
        throw new Error(`No decisive member outcomes for ${spec.stableKey}`);
      }
      const legislatorIds = new Set<string>();
      for (const row of memberResult.rows) {
        if (legislatorIds.has(row.legislator_id)) {
          throw new Error(`Duplicate decisive legislator outcome for ${spec.stableKey}|${row.legislator_id}`);
        }
        legislatorIds.add(row.legislator_id);
      }

      cases.push({
        stableKey: spec.stableKey,
        caseKey: spec.caseKey,
        externalKey: spec.externalKey,
        tranche: spec.tranche,
        session: spec.session,
        chamber: spec.chamber,
        identifier: spec.identifier,
        occurredOn: spec.occurredOn,
        voteEventId: spec.voteEventId,
        members: memberResult.rows.map((row) => ({
          membershipId: row.membership_id,
          legislatorId: row.legislator_id,
          memberName: row.member_name,
          actualOutcome: row.choice === 'yea' ? 1 : 0,
        })),
      });
    }

    return NextResponse.json({
      schemaVersion: HISTORICAL_DEEP_EXPANSION_OUTCOME_SNAPSHOT_SCHEMA,
      generatedAt: new Date().toISOString(),
      codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      purpose: 'evaluation-only official floor-outcome snapshot created only after the immutable expansion candidate artifact was frozen; exact frozen vote-event IDs and source-derived external keys are revalidated; decisive YEA/NAY labels only; no forecast writes or serving changes',
      candidateArtifact: body.candidateArtifact,
      cases,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Historical Deep expansion outcome snapshot failed', message);
    return NextResponse.json({ error: 'Historical Deep expansion outcome snapshot failed' }, { status: 500 });
  }
}
