import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { fetchRevisorStatusXml } from '@/sources/minnesota/revisor-actions';
import { parseRevisorIntroductionMetadata } from '@/sources/minnesota/revisor-introduction';

export const maxDuration = 300;

const SAMPLE_BUCKETS = 12;
const FETCH_CONCURRENCY = 2;

type SampleRow = {
  bill_id: string;
  session_slug: string;
  chamber_slug: 'house' | 'senate';
  identifier: string;
  status_xml_url: string;
  sample_bucket: number;
};

type AuditRow = {
  session: string;
  chamber: 'house' | 'senate';
  identifier: string;
  introducedOn: string | null;
  initialDocumentOn: string | null;
  initialDocumentUrl: string | null;
  initialDocumentKnownByIntroduction: boolean;
  currentCompanionIdentifier: string | null;
  error: string | null;
};

async function sampleUniverse(): Promise<SampleRow[]> {
  const result = await pool.query<SampleRow>(`
    WITH universe AS (
      SELECT b.id::text AS bill_id,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             b.identifier,
             b.metadata #>> '{revisorUniverse,statusXmlUrl}' AS status_xml_url,
             substring(b.identifier from '[0-9]+$')::integer AS bill_number
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
       WHERE b.metadata ? 'revisorUniverse'
         AND b.metadata #>> '{revisorUniverse,statusXmlUrl}' IS NOT NULL
    ), tiled AS (
      SELECT *, ntile($1::integer) OVER (
        PARTITION BY session_slug, chamber_slug
        ORDER BY bill_number, identifier
      ) AS sample_bucket
      FROM universe
    )
    SELECT DISTINCT ON (session_slug, chamber_slug, sample_bucket)
           bill_id, session_slug, chamber_slug, identifier, status_xml_url, sample_bucket
      FROM tiled
     ORDER BY session_slug, chamber_slug, sample_bucket, bill_number, identifier`, [SAMPLE_BUCKETS]);
  return result.rows;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 240);
}

async function auditSamples(samples: readonly SampleRow[]): Promise<AuditRow[]> {
  const output: AuditRow[] = [];
  for (let offset = 0; offset < samples.length; offset += FETCH_CONCURRENCY) {
    const batch = samples.slice(offset, offset + FETCH_CONCURRENCY);
    const rows = await Promise.all(batch.map(async (sample): Promise<AuditRow> => {
      try {
        const xml = await fetchRevisorStatusXml(sample.status_xml_url);
        const metadata = parseRevisorIntroductionMetadata({ xml, identifier: sample.identifier });
        return {
          session: sample.session_slug,
          chamber: sample.chamber_slug,
          identifier: sample.identifier,
          introducedOn: metadata.introducedOn,
          initialDocumentOn: metadata.initialDocument?.insertedOn ?? null,
          initialDocumentUrl: metadata.initialDocument?.htmlUrl ?? null,
          initialDocumentKnownByIntroduction: metadata.initialDocumentKnownByIntroduction,
          currentCompanionIdentifier: metadata.currentCompanionIdentifier,
          error: null,
        };
      } catch (error) {
        return {
          session: sample.session_slug,
          chamber: sample.chamber_slug,
          identifier: sample.identifier,
          introducedOn: null,
          initialDocumentOn: null,
          initialDocumentUrl: null,
          initialDocumentKnownByIntroduction: false,
          currentCompanionIdentifier: null,
          error: safeError(error),
        };
      }
    }));
    output.push(...rows);
  }
  return output;
}

function summarize(rows: readonly AuditRow[]) {
  const summarizeRows = (scopeRows: readonly AuditRow[]) => ({
    sampled: scopeRows.length,
    fetched: scopeRows.filter((row) => !row.error).length,
    failures: scopeRows.filter((row) => row.error).length,
    introductionDateFound: scopeRows.filter((row) => row.introducedOn).length,
    initialDocumentFound: scopeRows.filter((row) => row.initialDocumentOn && row.initialDocumentUrl).length,
    initialDocumentKnownByIntroduction: scopeRows.filter((row) => row.initialDocumentKnownByIntroduction).length,
    currentCompanionFound: scopeRows.filter((row) => row.currentCompanionIdentifier).length,
  });

  const scopes = Object.fromEntries(
    [...new Set(rows.map((row) => `${row.session}/${row.chamber}`))]
      .sort()
      .map((scope) => [scope, summarizeRows(rows.filter((row) => `${row.session}/${row.chamber}` === scope))]),
  );

  return {
    overall: summarizeRows(rows),
    scopes,
    failures: rows.filter((row) => row.error).map((row) => ({
      session: row.session,
      chamber: row.chamber,
      identifier: row.identifier,
      error: row.error,
    })),
    timingMismatches: rows
      .filter((row) => !row.error && row.initialDocumentOn && row.introducedOn && !row.initialDocumentKnownByIntroduction)
      .map((row) => ({
        session: row.session,
        chamber: row.chamber,
        identifier: row.identifier,
        initialDocumentOn: row.initialDocumentOn,
        introducedOn: row.introducedOn,
      })),
  };
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
    const samples = await sampleUniverse();
    const rows = await auditSamples(samples);
    return NextResponse.json({
      metadata: {
        generatedAt: new Date().toISOString(),
        codeSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        sampleDesign: `${SAMPLE_BUCKETS} bill-number tiles per session/chamber; first bill in each tile`,
        fetchConcurrency: FETCH_CONCURRENCY,
        modelEligibility: {
          introductionDate: 'eligible when source-chamber introduction/first-reading action is dated',
          initialDocument: 'eligible only when zero-engrossment official document is dated on/before introduction',
          currentCompanion: 'audit only; not model eligible because the current status record does not establish when the relationship became known',
          currentAuthors: 'not parsed; current author lists can include later additions and are not model eligible',
        },
      },
      ...summarize(rows),
    });
  } catch (error) {
    console.error('Revisor introduction audit failed', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Revisor introduction audit failed' }, { status: 500 });
  }
}
