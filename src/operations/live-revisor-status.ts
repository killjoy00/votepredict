import { createHash } from 'node:crypto';
import { pool } from '@/lib/db';
import {
  auditRevisorSourceChamberPassage,
  fetchRevisorStatusXml,
  parseRevisorOfficialActions,
} from '@/sources/minnesota/revisor-actions';
import {
  parseRevisorCurrentOfficialTextVersion,
  parseRevisorIntroductionMetadata,
  parseRevisorTextVersions,
  type RevisorTextVersion,
} from '@/sources/minnesota/revisor-introduction';

export const LIVE_REVISOR_STATUS_SESSION = '2027-2028' as const;
export const LIVE_REVISOR_STATUS_PARSER_VERSION = 'revisor-live-status-v1';
export const LIVE_REVISOR_STATUS_BATCH_SIZE = 500;
const FETCH_CONCURRENCY = 2;

type LiveStatusBillRow = {
  bill_id: string;
  session_id: string;
  chamber_id: string;
  identifier: string;
  status_xml_url: string;
  existing_introduced_at: string | null;
};

type FetchedLiveStatus = LiveStatusBillRow & {
  fetchedAt: string;
  sourceSha256: string;
  introduction: ReturnType<typeof parseRevisorIntroductionMetadata>;
  versions: RevisorTextVersion[];
  currentVersion: RevisorTextVersion | null;
  latestActionOn: string | null;
  passageActionObserved: boolean;
};

export type LiveRevisorStatusFailure = {
  identifier: string;
  message: string;
};

export type LiveRevisorStatusResult = {
  session: typeof LIVE_REVISOR_STATUS_SESSION;
  parserVersion: typeof LIVE_REVISOR_STATUS_PARSER_VERSION;
  selected: number;
  fetched: number;
  failed: number;
  introductionDates: number;
  initialVersions: number;
  engrossedBills: number;
  passageActionsObserved: number;
  versionsRecorded: number;
  sourceDocumentsRecorded: number;
  failures: LiveRevisorStatusFailure[];
};

function existingDate(value: string | null): string | null {
  return value?.match(/^(20\d{2}-\d{2}-\d{2})/)?.[1] ?? null;
}

function completeIntroduction(row: FetchedLiveStatus): boolean {
  const initial = row.introduction.initialDocument;
  return Boolean(
    row.introduction.introducedOn
    && initial?.documentName
    && initial.insertedOn
    && initial.htmlUrl,
  );
}

function latestActionDate(xml: string): string | null {
  const dates = parseRevisorOfficialActions(xml)
    .map((action) => action.occurredOn)
    .filter((value): value is string => value !== null)
    .sort();
  return dates[dates.length - 1] ?? null;
}

async function selectBatch(limit: number): Promise<LiveStatusBillRow[]> {
  const result = await pool.query<LiveStatusBillRow>(`
    SELECT b.id::text AS bill_id,
           b.session_id::text AS session_id,
           b.originating_chamber_id::text AS chamber_id,
           b.identifier,
           COALESCE(b.metadata #>> '{revisorUniverse,statusXmlUrl}', b.source_url) AS status_xml_url,
           b.introduced_at::text AS existing_introduced_at
      FROM bills b
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house','senate')
     WHERE s.slug = $1
       AND b.metadata #>> '{revisorUniverse,liveSync}' = 'true'
       AND COALESCE(b.metadata #>> '{revisorUniverse,statusXmlUrl}', b.source_url) IS NOT NULL
     ORDER BY
       CASE WHEN b.metadata #>> '{revisorLiveStatus,fetchedAt}' IS NULL THEN 0 ELSE 1 END,
       NULLIF(b.metadata #>> '{revisorLiveStatus,fetchedAt}', '')::timestamptz NULLS FIRST,
       substring(b.identifier from '[0-9]+$')::integer,
       b.identifier
     LIMIT $2`, [LIVE_REVISOR_STATUS_SESSION, limit]);
  return result.rows;
}

async function fetchOne(row: LiveStatusBillRow): Promise<FetchedLiveStatus> {
  const xml = await fetchRevisorStatusXml(row.status_xml_url);
  const introduction = parseRevisorIntroductionMetadata({ xml, identifier: row.identifier });
  const currentDate = existingDate(row.existing_introduced_at);
  if (currentDate && introduction.introducedOn && currentDate !== introduction.introducedOn) {
    throw new Error(`${row.identifier}: existing introduction date ${currentDate} conflicts with Revisor ${introduction.introducedOn}`);
  }
  const passageAudit = auditRevisorSourceChamberPassage({ xml, identifier: row.identifier });
  return {
    ...row,
    fetchedAt: new Date().toISOString(),
    sourceSha256: createHash('sha256').update(xml).digest('hex'),
    introduction,
    versions: parseRevisorTextVersions(xml),
    currentVersion: parseRevisorCurrentOfficialTextVersion(xml),
    latestActionOn: latestActionDate(xml),
    // This is only a prospective leakage guard. It is never written to the
    // historical sourceChamberPassage outcome label used for model training.
    passageActionObserved: passageAudit.passageActions.length > 0,
  };
}

async function fetchBatch(rows: readonly LiveStatusBillRow[]): Promise<{
  fetched: FetchedLiveStatus[];
  failures: LiveRevisorStatusFailure[];
}> {
  const fetched: FetchedLiveStatus[] = [];
  const failures: LiveRevisorStatusFailure[] = [];
  for (let offset = 0; offset < rows.length; offset += FETCH_CONCURRENCY) {
    const group = rows.slice(offset, offset + FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(group.map(fetchOne));
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        fetched.push(result.value);
      } else {
        failures.push({
          identifier: group[index].identifier,
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });
  }
  return { fetched, failures };
}

function introductionMetadata(row: FetchedLiveStatus): Record<string, unknown> | null {
  if (!completeIntroduction(row)) return null;
  const initial = row.introduction.initialDocument!;
  const modelEligible = row.introduction.initialDocumentKnownByIntroduction;
  return {
    parserVersion: 'revisor-introduction-v1',
    source: 'Minnesota Revisor Bill Status API v1 live sync',
    sourceFormat: 'xml',
    statusXmlUrl: row.status_xml_url,
    statusXmlSha256: row.sourceSha256,
    fetchedAt: row.fetchedAt,
    introducedOn: row.introduction.introducedOn,
    introducedAtPrecision: 'date',
    initialDocument: {
      documentName: initial.documentName,
      insertedAt: initial.insertedAt,
      insertedOn: initial.insertedOn,
      htmlUrl: initial.htmlUrl,
      engrossment: initial.engrossment,
      availableAtIntroduction: modelEligible,
      modelEligible,
    },
    currentCompanion: row.introduction.currentCompanionIdentifier
      ? { identifier: row.introduction.currentCompanionIdentifier, observedAt: row.fetchedAt, modelEligible: false }
      : null,
    currentAuthorsModelEligible: false,
  };
}

async function persistFetched(rows: readonly FetchedLiveStatus[]): Promise<{
  versionsRecorded: number;
  sourceDocumentsRecorded: number;
}> {
  if (rows.length === 0) return { versionsRecorded: 0, sourceDocumentsRecorded: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sourcePayload = rows.map((row) => ({
      session_id: row.session_id,
      chamber_id: row.chamber_id,
      source_url: row.status_xml_url,
      fetched_at: row.fetchedAt,
      content_sha256: row.sourceSha256,
      identifier: row.identifier,
      current_engrossment: row.currentVersion?.engrossment ?? null,
      passage_action_observed: row.passageActionObserved,
    }));
    const sources = await client.query(`
      WITH payload AS (
        SELECT session_id, chamber_id, source_url, fetched_at, content_sha256, identifier,
               current_engrossment, passage_action_observed
          FROM jsonb_to_recordset($1::jsonb) AS x(
            session_id uuid,
            chamber_id uuid,
            source_url text,
            fetched_at timestamptz,
            content_sha256 text,
            identifier text,
            current_engrossment integer,
            passage_action_observed boolean
          )
      )
      INSERT INTO source_documents (
        jurisdiction_id, session_id, chamber_id, source_kind, source_url,
        fetched_at, content_sha256, http_status, metadata
      )
      SELECT (SELECT id FROM jurisdictions WHERE slug = 'us-mn'),
             p.session_id,
             p.chamber_id,
             'revisor_live_bill_status',
             p.source_url,
             p.fetched_at,
             p.content_sha256,
             200,
             jsonb_build_object(
               'identifier', p.identifier,
               'parserVersion', $2::text,
               'currentEngrossment', p.current_engrossment,
               'passageActionObserved', p.passage_action_observed,
               'semantics', 'live status/introduction/version observation; passage-action presence is a prospective leakage blocker, not a training outcome label',
               'outcomeBlind', true
             )
        FROM payload p
      ON CONFLICT (source_url, content_sha256) DO UPDATE SET
        fetched_at = GREATEST(source_documents.fetched_at, EXCLUDED.fetched_at),
        metadata = source_documents.metadata || EXCLUDED.metadata
      RETURNING id`, [JSON.stringify(sourcePayload), LIVE_REVISOR_STATUS_PARSER_VERSION]);

    const billPayload = rows.map((row) => {
      const introMetadata = introductionMetadata(row);
      return {
        bill_id: row.bill_id,
        introduced_at: row.introduction.introducedOn ? `${row.introduction.introducedOn}T12:00:00Z` : null,
        latest_action_at: row.latestActionOn ? `${row.latestActionOn}T12:00:00Z` : null,
        live_status: {
          parserVersion: LIVE_REVISOR_STATUS_PARSER_VERSION,
          source: 'Minnesota Revisor Bill Status API v1',
          statusXmlUrl: row.status_xml_url,
          statusXmlSha256: row.sourceSha256,
          fetchedAt: row.fetchedAt,
          outcomeBlind: true,
          currentVersionKind: row.currentVersion
            ? row.currentVersion.engrossment > 0 ? 'engrossment' : 'introduction'
            : 'unknown',
          currentEngrossment: row.currentVersion?.engrossment ?? null,
          currentVersion: row.currentVersion,
          latestActionOn: row.latestActionOn,
          passageActionObserved: row.passageActionObserved,
        },
        introduction_metadata: introMetadata,
      };
    });
    await client.query(`
      WITH payload AS (
        SELECT bill_id, introduced_at, latest_action_at, live_status, introduction_metadata
          FROM jsonb_to_recordset($1::jsonb) AS x(
            bill_id uuid,
            introduced_at timestamptz,
            latest_action_at timestamptz,
            live_status jsonb,
            introduction_metadata jsonb
          )
      )
      UPDATE bills b
         SET introduced_at = COALESCE(b.introduced_at, p.introduced_at),
             latest_action_at = CASE
               WHEN p.latest_action_at IS NULL THEN b.latest_action_at
               WHEN b.latest_action_at IS NULL OR p.latest_action_at > b.latest_action_at THEN p.latest_action_at
               ELSE b.latest_action_at
             END,
             metadata = b.metadata
               || jsonb_build_object('revisorLiveStatus', p.live_status)
               || CASE
                    WHEN p.introduction_metadata IS NULL THEN '{}'::jsonb
                    ELSE jsonb_build_object('revisorIntroduction', p.introduction_metadata)
                  END,
             updated_at = now()
        FROM payload p
       WHERE b.id = p.bill_id`, [JSON.stringify(billPayload)]);

    const versionPayload = rows.flatMap((row) => row.versions
      .filter((version) => version.documentName && version.htmlUrl)
      .map((version) => ({
        bill_id: row.bill_id,
        version_key: version.documentName,
        published_at: version.insertedOn ? `${version.insertedOn}T12:00:00Z` : null,
        text_url: version.htmlUrl,
        source_url: row.status_xml_url,
      })));
    let versionsRecorded = 0;
    if (versionPayload.length > 0) {
      const versions = await client.query(`
        WITH payload AS (
          SELECT bill_id, version_key, published_at, text_url, source_url
            FROM jsonb_to_recordset($1::jsonb) AS x(
              bill_id uuid,
              version_key text,
              published_at timestamptz,
              text_url text,
              source_url text
            )
        )
        INSERT INTO bill_versions (bill_id, version_key, published_at, text_url, source_url)
        SELECT p.bill_id, p.version_key, p.published_at, p.text_url, p.source_url
          FROM payload p
        ON CONFLICT (bill_id, version_key) DO UPDATE SET
          published_at = COALESCE(bill_versions.published_at, EXCLUDED.published_at),
          text_url = COALESCE(bill_versions.text_url, EXCLUDED.text_url),
          source_url = COALESCE(bill_versions.source_url, EXCLUDED.source_url)
        RETURNING id`, [JSON.stringify(versionPayload)]);
      versionsRecorded = versions.rowCount ?? 0;
    }

    await client.query('COMMIT');
    return {
      versionsRecorded,
      sourceDocumentsRecorded: sources.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function syncLiveRevisorStatusBatch(limit = LIVE_REVISOR_STATUS_BATCH_SIZE): Promise<LiveRevisorStatusResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > LIVE_REVISOR_STATUS_BATCH_SIZE) {
    throw new Error(`Live Revisor status limit must be between 1 and ${LIVE_REVISOR_STATUS_BATCH_SIZE}`);
  }
  const selected = await selectBatch(limit);
  const { fetched, failures } = await fetchBatch(selected);
  const persisted = await persistFetched(fetched);
  return {
    session: LIVE_REVISOR_STATUS_SESSION,
    parserVersion: LIVE_REVISOR_STATUS_PARSER_VERSION,
    selected: selected.length,
    fetched: fetched.length,
    failed: failures.length,
    introductionDates: fetched.filter((row) => row.introduction.introducedOn !== null).length,
    initialVersions: fetched.filter((row) => row.introduction.initialDocument !== null).length,
    engrossedBills: fetched.filter((row) => (row.currentVersion?.engrossment ?? 0) > 0).length,
    passageActionsObserved: fetched.filter((row) => row.passageActionObserved).length,
    versionsRecorded: persisted.versionsRecorded,
    sourceDocumentsRecorded: persisted.sourceDocumentsRecorded,
    failures,
  };
}
