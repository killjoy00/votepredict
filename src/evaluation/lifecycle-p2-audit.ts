import { pool } from '@/lib/db';
import { MIN_REVISOR_PROCESS_RESEARCH_COVERAGE } from '@/operations/revisor-process-source-policy';
import {
  REVISOR_PROCESS_AUDIT_VERSION,
  REVISOR_PROCESS_PARSER_VERSION,
} from '@/sources/minnesota/revisor-process';

export const LIFECYCLE_P2_AUDIT_SCHEMA_VERSION = 'lifecycle-p2-audit-v1' as const;

type StageCountRow = {
  session_slug: string;
  chamber_slug: string | null;
  stage_kind: string;
  events: string;
  bills: string;
};

type ExclusionRow = {
  reason: string;
  bills: string;
};

type ExampleRow = {
  session_slug: string;
  chamber_slug: string;
  identifier: string;
  value: string | null;
  details: unknown;
};

export interface LifecycleP2AuditReport {
  schemaVersion: typeof LIFECYCLE_P2_AUDIT_SCHEMA_VERSION;
  generatedAt: string;
  parserVersion: typeof REVISOR_PROCESS_PARSER_VERSION;
  auditVersion: typeof REVISOR_PROCESS_AUDIT_VERSION;
  minimumProcessCoverage: number;
  coverage: {
    targetBills: number;
    parsedBills: number;
    auditedBills: number;
    excludedBills: number;
    deferredBills: number;
    pendingBills: number;
    processSourceResolvedCoverage: number;
    parserCoverage: number;
    auditCoverageOfParsed: number;
    authoritativeOutcomeLabels: number;
  };
  actionAudit: {
    officialActions: number;
    datedOfficialActions: number;
    undatedOfficialActions: number;
    processClassifiedDatedActions: number;
    introductionActions: number;
    sourceChamberPassageActions: number;
    sourceChamberFailedPassageActions: number;
    otherUnclassifiedDatedActions: number;
    billsWithOtherUnclassifiedDatedActions: number;
    unclassifiedChamberDatedActions: number;
  };
  lifecycle: {
    processStageEvents: number;
    parsedBillsWithNoClassifiedProcessEvents: number;
    eventsBeforeIntroduction: number;
    eventsAfterSessionExpiration: number;
    eventsAfterSourceChamberPassage: number;
    authoritativePassages: number;
    processSourcePassages: number;
    authoritativePassagesMissingProcessPassage: number;
    authoritativeNonPassagesWithProcessPassage: number;
    authoritativeNonPassagesMissingSessionExpiration: number;
    authoritativePassagesWithSessionExpiration: number;
  };
  stageCounts: Array<{
    session: string;
    chamber: string | null;
    stageKind: string;
    events: number;
    bills: number;
  }>;
  exclusions: Array<{ reason: string; bills: number }>;
  examples: {
    otherUnclassifiedDatedActions: ExampleRow[];
    passageMismatches: ExampleRow[];
    preIntroductionEvents: ExampleRow[];
    postExpirationEvents: ExampleRow[];
    noClassifiedProcessEvents: ExampleRow[];
  };
  gate: {
    hardFailures: string[];
    taxonomyReviewRequired: boolean;
    postTerminalReviewRequired: boolean;
    passed: boolean;
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export async function buildLifecycleP2Audit(): Promise<LifecycleP2AuditReport> {
  const summary = await pool.query<{
    target_bills: string;
    parsed_bills: string;
    audited_bills: string;
    excluded_bills: string;
    deferred_bills: string;
    authoritative_outcome_labels: string;
    official_actions: string;
    dated_official_actions: string;
    undated_official_actions: string;
    process_classified_dated_actions: string;
    introduction_actions: string;
    source_chamber_passage_actions: string;
    source_chamber_failed_passage_actions: string;
    other_unclassified_dated_actions: string;
    bills_with_other_unclassified_dated_actions: string;
    unclassified_chamber_dated_actions: string;
    process_stage_events: string;
    parsed_bills_with_no_classified_process_events: string;
    events_before_introduction: string;
    events_after_session_expiration: string;
    events_after_source_chamber_passage: string;
    authoritative_passages: string;
    process_source_passages: string;
    authoritative_passages_missing_process_passage: string;
    authoritative_non_passages_with_process_passage: string;
    authoritative_non_passages_missing_session_expiration: string;
    authoritative_passages_with_session_expiration: string;
  }>(`
    WITH target AS (
      SELECT b.id,
             b.identifier,
             b.introduced_at,
             b.metadata,
             s.slug AS session_slug,
             s.starts_on,
             s.ends_on,
             c.slug AS chamber_slug
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
        LEFT JOIN chambers c ON c.id = b.originating_chamber_id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND b.identifier ~ '^(HF|SF)[0-9]+$'
    ),
    parsed AS (
      SELECT *
        FROM target
       WHERE metadata #>> '{revisorProcessHistory,parserVersion}' = $1
    ),
    audited AS (
      SELECT *
        FROM parsed
       WHERE metadata #>> '{revisorProcessHistory,auditVersion}' = $2
    ),
    expirations AS (
      SELECT se.bill_id, min(se.occurred_at) AS expired_at
        FROM legislative_stage_events se
        JOIN target t ON t.id = se.bill_id
       WHERE se.stage_kind = 'session_expiration'
       GROUP BY se.bill_id
    ),
    process_events AS (
      SELECT se.*
        FROM legislative_stage_events se
        JOIN target t ON t.id = se.bill_id
       WHERE se.metadata ->> 'parserVersion' = $1
    )
    SELECT
      (SELECT count(*) FROM target)::text AS target_bills,
      (SELECT count(*) FROM parsed)::text AS parsed_bills,
      (SELECT count(*) FROM audited)::text AS audited_bills,
      (SELECT count(*) FROM target
        WHERE metadata #>> '{revisorProcessHistory,exclusionVersion}' = $1)::text AS excluded_bills,
      (SELECT count(*) FROM target
        WHERE metadata #>> '{revisorProcessHistory,status}' = 'deferred'
          AND (
            metadata #>> '{revisorProcessHistory,parserVersion}' IS DISTINCT FROM $1
            OR metadata #>> '{revisorProcessHistory,auditVersion}' IS DISTINCT FROM $2
          ))::text AS deferred_bills,
      (SELECT count(*) FROM target
        WHERE metadata #>> '{sourceChamberPassage,outcome}' IN ('true','false'))::text AS authoritative_outcome_labels,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,officialActions}','')::integer),0) FROM audited)::text AS official_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,datedOfficialActions}','')::integer),0) FROM audited)::text AS dated_official_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,undatedOfficialActions}','')::integer),0) FROM audited)::text AS undated_official_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,processClassifiedDatedActions}','')::integer),0) FROM audited)::text AS process_classified_dated_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,introductionActions}','')::integer),0) FROM audited)::text AS introduction_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,sourceChamberPassageActions}','')::integer),0) FROM audited)::text AS source_chamber_passage_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,sourceChamberFailedPassageActions}','')::integer),0) FROM audited)::text AS source_chamber_failed_passage_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,otherUnclassifiedDatedActions}','')::integer),0) FROM audited)::text AS other_unclassified_dated_actions,
      (SELECT count(*) FROM audited
        WHERE coalesce(NULLIF(metadata #>> '{revisorProcessHistory,otherUnclassifiedDatedActions}','')::integer,0) > 0)::text AS bills_with_other_unclassified_dated_actions,
      (SELECT coalesce(sum(NULLIF(metadata #>> '{revisorProcessHistory,unclassifiedChamberDatedActions}','')::integer),0) FROM audited)::text AS unclassified_chamber_dated_actions,
      (SELECT count(*) FROM process_events)::text AS process_stage_events,
      (SELECT count(*) FROM parsed p
        WHERE NOT EXISTS (SELECT 1 FROM process_events pe WHERE pe.bill_id = p.id))::text AS parsed_bills_with_no_classified_process_events,
      (SELECT count(*) FROM process_events pe
        JOIN target t ON t.id = pe.bill_id
       WHERE t.introduced_at IS NOT NULL
         AND pe.occurred_at::date < t.introduced_at::date)::text AS events_before_introduction,
      (SELECT count(*) FROM process_events pe
        JOIN expirations e ON e.bill_id = pe.bill_id
       WHERE pe.occurred_at > e.expired_at)::text AS events_after_session_expiration,
      (SELECT count(*) FROM process_events pe
        JOIN audited a ON a.id = pe.bill_id
       WHERE a.metadata #>> '{revisorProcessHistory,sourceChamberPassageOn}' IS NOT NULL
         AND pe.occurred_at::date >
             (a.metadata #>> '{revisorProcessHistory,sourceChamberPassageOn}')::date)::text AS events_after_source_chamber_passage,
      (SELECT count(*) FROM target
        WHERE metadata #>> '{sourceChamberPassage,outcome}' = 'true')::text AS authoritative_passages,
      (SELECT count(*) FROM audited
        WHERE metadata #>> '{revisorProcessHistory,sourceChamberPassed}' = 'true')::text AS process_source_passages,
      (SELECT count(*) FROM audited
        WHERE metadata #>> '{sourceChamberPassage,outcome}' = 'true'
          AND metadata #>> '{revisorProcessHistory,sourceChamberPassed}' IS DISTINCT FROM 'true')::text AS authoritative_passages_missing_process_passage,
      (SELECT count(*) FROM audited
        WHERE metadata #>> '{sourceChamberPassage,outcome}' = 'false'
          AND metadata #>> '{revisorProcessHistory,sourceChamberPassed}' = 'true')::text AS authoritative_non_passages_with_process_passage,
      (SELECT count(*) FROM target t
        WHERE t.metadata #>> '{sourceChamberPassage,outcome}' = 'false'
          AND NOT EXISTS (SELECT 1 FROM expirations e WHERE e.bill_id = t.id))::text AS authoritative_non_passages_missing_session_expiration,
      (SELECT count(*) FROM target t
        WHERE t.metadata #>> '{sourceChamberPassage,outcome}' = 'true'
          AND EXISTS (SELECT 1 FROM expirations e WHERE e.bill_id = t.id))::text AS authoritative_passages_with_session_expiration
  `, [REVISOR_PROCESS_PARSER_VERSION, REVISOR_PROCESS_AUDIT_VERSION]);

  const row = summary.rows[0];
  if (!row) throw new Error('Lifecycle P2 audit summary returned no row');

  const stageRows = await pool.query<StageCountRow>(`
    SELECT s.slug AS session_slug,
           c.slug AS chamber_slug,
           se.stage_kind,
           count(*)::text AS events,
           count(DISTINCT se.bill_id)::text AS bills
      FROM legislative_stage_events se
      JOIN bills b ON b.id = se.bill_id
      JOIN legislative_sessions s ON s.id = b.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
      LEFT JOIN chambers c ON c.id = se.chamber_id
     WHERE se.metadata ->> 'parserVersion' = $1
       AND s.slug IN ('2021-2022','2023-2024','2025-2026')
     GROUP BY s.slug, c.slug, se.stage_kind
     ORDER BY s.slug, c.slug NULLS LAST, se.stage_kind
  `, [REVISOR_PROCESS_PARSER_VERSION]);

  const exclusionRows = await pool.query<ExclusionRow>(`
    SELECT coalesce(metadata #>> '{revisorProcessHistory,exclusionReason}','unknown') AS reason,
           count(*)::text AS bills
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
     WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
       AND b.identifier ~ '^(HF|SF)[0-9]+$'
       AND b.metadata #>> '{revisorProcessHistory,exclusionVersion}' = $1
     GROUP BY reason
     ORDER BY count(*) DESC, reason
  `, [REVISOR_PROCESS_PARSER_VERSION]);

  const unclassifiedExamples = await pool.query<ExampleRow>(`
    SELECT s.slug AS session_slug,
           c.slug AS chamber_slug,
           b.identifier,
           b.metadata #>> '{revisorProcessHistory,otherUnclassifiedDatedActions}' AS value,
           b.metadata #> '{revisorProcessHistory,otherUnclassifiedDatedActionDescriptions}' AS details
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
      JOIN chambers c ON c.id=b.originating_chamber_id
     WHERE b.metadata #>> '{revisorProcessHistory,parserVersion}' = $1
       AND b.metadata #>> '{revisorProcessHistory,auditVersion}' = $2
       AND coalesce(NULLIF(b.metadata #>> '{revisorProcessHistory,otherUnclassifiedDatedActions}','')::integer,0) > 0
     ORDER BY NULLIF(b.metadata #>> '{revisorProcessHistory,otherUnclassifiedDatedActions}','')::integer DESC,
              s.starts_on, c.slug, b.identifier
     LIMIT 50
  `, [REVISOR_PROCESS_PARSER_VERSION, REVISOR_PROCESS_AUDIT_VERSION]);

  const passageMismatchExamples = await pool.query<ExampleRow>(`
    SELECT s.slug AS session_slug,
           c.slug AS chamber_slug,
           b.identifier,
           b.metadata #>> '{sourceChamberPassage,outcome}' AS value,
           jsonb_build_object(
             'processSourceChamberPassed', b.metadata #>> '{revisorProcessHistory,sourceChamberPassed}',
             'processSourceChamberFailed', b.metadata #>> '{revisorProcessHistory,sourceChamberFailed}',
             'processPassageOn', b.metadata #>> '{revisorProcessHistory,sourceChamberPassageOn}',
             'processFailureOn', b.metadata #>> '{revisorProcessHistory,sourceChamberFailureOn}'
           ) AS details
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
      JOIN chambers c ON c.id=b.originating_chamber_id
     WHERE b.metadata #>> '{revisorProcessHistory,parserVersion}' = $1
       AND b.metadata #>> '{revisorProcessHistory,auditVersion}' = $2
       AND (
         (b.metadata #>> '{sourceChamberPassage,outcome}' = 'true'
           AND b.metadata #>> '{revisorProcessHistory,sourceChamberPassed}' IS DISTINCT FROM 'true')
         OR
         (b.metadata #>> '{sourceChamberPassage,outcome}' = 'false'
           AND b.metadata #>> '{revisorProcessHistory,sourceChamberPassed}' = 'true')
       )
     ORDER BY s.starts_on, c.slug, b.identifier
     LIMIT 50
  `, [REVISOR_PROCESS_PARSER_VERSION, REVISOR_PROCESS_AUDIT_VERSION]);

  const preIntroductionExamples = await pool.query<ExampleRow>(`
    SELECT s.slug AS session_slug,
           c.slug AS chamber_slug,
           b.identifier,
           se.occurred_at::date::text AS value,
           jsonb_build_object(
             'introducedOn', b.introduced_at::date,
             'stageKind', se.stage_kind,
             'descriptions', se.metadata -> 'actionDescriptions',
             'sourceUrl', se.source_url
           ) AS details
      FROM legislative_stage_events se
      JOIN bills b ON b.id=se.bill_id
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
      JOIN chambers c ON c.id=b.originating_chamber_id
     WHERE se.metadata ->> 'parserVersion' = $1
       AND b.introduced_at IS NOT NULL
       AND se.occurred_at::date < b.introduced_at::date
     ORDER BY s.starts_on, c.slug, b.identifier, se.occurred_at
     LIMIT 50
  `, [REVISOR_PROCESS_PARSER_VERSION]);

  const postExpirationExamples = await pool.query<ExampleRow>(`
    WITH expirations AS (
      SELECT bill_id, min(occurred_at) AS expired_at
        FROM legislative_stage_events
       WHERE stage_kind='session_expiration'
       GROUP BY bill_id
    )
    SELECT s.slug AS session_slug,
           c.slug AS chamber_slug,
           b.identifier,
           se.occurred_at::date::text AS value,
           jsonb_build_object(
             'expiredOn', e.expired_at::date,
             'stageKind', se.stage_kind,
             'descriptions', se.metadata -> 'actionDescriptions',
             'sourceUrl', se.source_url
           ) AS details
      FROM legislative_stage_events se
      JOIN expirations e ON e.bill_id=se.bill_id
      JOIN bills b ON b.id=se.bill_id
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
      JOIN chambers c ON c.id=b.originating_chamber_id
     WHERE se.metadata ->> 'parserVersion' = $1
       AND se.occurred_at > e.expired_at
     ORDER BY s.starts_on, c.slug, b.identifier, se.occurred_at
     LIMIT 50
  `, [REVISOR_PROCESS_PARSER_VERSION]);

  const noActionExamples = await pool.query<ExampleRow>(`
    SELECT s.slug AS session_slug,
           c.slug AS chamber_slug,
           b.identifier,
           b.metadata #>> '{revisorProcessHistory,datedOfficialActions}' AS value,
           jsonb_build_object(
             'sourceUrl', b.metadata #>> '{revisorProcessHistory,sourceUrl}',
             'introducedOn', b.introduced_at::date,
             'otherUnclassifiedDatedActions', b.metadata #>> '{revisorProcessHistory,otherUnclassifiedDatedActions}'
           ) AS details
      FROM bills b
      JOIN legislative_sessions s ON s.id=b.session_id
      JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
      JOIN chambers c ON c.id=b.originating_chamber_id
     WHERE b.metadata #>> '{revisorProcessHistory,parserVersion}' = $1
       AND NOT EXISTS (
         SELECT 1
           FROM legislative_stage_events se
          WHERE se.bill_id=b.id
            AND se.metadata ->> 'parserVersion' = $1
       )
     ORDER BY s.starts_on,c.slug,b.identifier
     LIMIT 50
  `, [REVISOR_PROCESS_PARSER_VERSION]);

  const targetBills = Number(row.target_bills);
  const parsedBills = Number(row.parsed_bills);
  const auditedBills = Number(row.audited_bills);
  const excludedBills = Number(row.excluded_bills);
  const deferredBills = Number(row.deferred_bills);
  const pendingBills = Math.max(0, targetBills - parsedBills - excludedBills);
  const processSourceResolvedCoverage = ratio(parsedBills + excludedBills, targetBills);
  const parserCoverage = ratio(parsedBills, targetBills);
  const auditCoverageOfParsed = ratio(auditedBills, parsedBills);

  const lifecycle = {
    processStageEvents: Number(row.process_stage_events),
    parsedBillsWithNoClassifiedProcessEvents: Number(row.parsed_bills_with_no_classified_process_events),
    eventsBeforeIntroduction: Number(row.events_before_introduction),
    eventsAfterSessionExpiration: Number(row.events_after_session_expiration),
    eventsAfterSourceChamberPassage: Number(row.events_after_source_chamber_passage),
    authoritativePassages: Number(row.authoritative_passages),
    processSourcePassages: Number(row.process_source_passages),
    authoritativePassagesMissingProcessPassage: Number(row.authoritative_passages_missing_process_passage),
    authoritativeNonPassagesWithProcessPassage: Number(row.authoritative_non_passages_with_process_passage),
    authoritativeNonPassagesMissingSessionExpiration: Number(row.authoritative_non_passages_missing_session_expiration),
    authoritativePassagesWithSessionExpiration: Number(row.authoritative_passages_with_session_expiration),
  };

  const actionAudit = {
    officialActions: Number(row.official_actions),
    datedOfficialActions: Number(row.dated_official_actions),
    undatedOfficialActions: Number(row.undated_official_actions),
    processClassifiedDatedActions: Number(row.process_classified_dated_actions),
    introductionActions: Number(row.introduction_actions),
    sourceChamberPassageActions: Number(row.source_chamber_passage_actions),
    sourceChamberFailedPassageActions: Number(row.source_chamber_failed_passage_actions),
    otherUnclassifiedDatedActions: Number(row.other_unclassified_dated_actions),
    billsWithOtherUnclassifiedDatedActions: Number(row.bills_with_other_unclassified_dated_actions),
    unclassifiedChamberDatedActions: Number(row.unclassified_chamber_dated_actions),
  };

  const hardFailures: string[] = [];
  if (parserCoverage < MIN_REVISOR_PROCESS_RESEARCH_COVERAGE) {
    hardFailures.push(`Parser coverage ${(parserCoverage * 100).toFixed(2)}% is below the frozen ${(MIN_REVISOR_PROCESS_RESEARCH_COVERAGE * 100).toFixed(2)}% gate`);
  }
  if (auditCoverageOfParsed < MIN_REVISOR_PROCESS_RESEARCH_COVERAGE) {
    hardFailures.push(`Action-audit coverage ${(auditCoverageOfParsed * 100).toFixed(2)}% of parsed bills is below the frozen ${(MIN_REVISOR_PROCESS_RESEARCH_COVERAGE * 100).toFixed(2)}% gate`);
  }
  if (lifecycle.eventsBeforeIntroduction > 0) {
    hardFailures.push(`${lifecycle.eventsBeforeIntroduction} process stage event(s) occur before introduction`);
  }
  if (lifecycle.eventsAfterSessionExpiration > 0) {
    hardFailures.push(`${lifecycle.eventsAfterSessionExpiration} process stage event(s) occur after session expiration`);
  }
  if (lifecycle.authoritativePassagesMissingProcessPassage > 0) {
    hardFailures.push(`${lifecycle.authoritativePassagesMissingProcessPassage} authoritative passage label(s) lack a matching source-chamber passage action in audited process history`);
  }
  if (lifecycle.authoritativeNonPassagesWithProcessPassage > 0) {
    hardFailures.push(`${lifecycle.authoritativeNonPassagesWithProcessPassage} authoritative non-passage label(s) conflict with a source-chamber passage action in audited process history`);
  }
  if (lifecycle.authoritativeNonPassagesMissingSessionExpiration > 0) {
    hardFailures.push(`${lifecycle.authoritativeNonPassagesMissingSessionExpiration} authoritative non-passage bill(s) lack a session-expiration terminal event`);
  }

  return {
    schemaVersion: LIFECYCLE_P2_AUDIT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    parserVersion: REVISOR_PROCESS_PARSER_VERSION,
    auditVersion: REVISOR_PROCESS_AUDIT_VERSION,
    minimumProcessCoverage: MIN_REVISOR_PROCESS_RESEARCH_COVERAGE,
    coverage: {
      targetBills,
      parsedBills,
      auditedBills,
      excludedBills,
      deferredBills,
      pendingBills,
      processSourceResolvedCoverage,
      parserCoverage,
      auditCoverageOfParsed,
      authoritativeOutcomeLabels: Number(row.authoritative_outcome_labels),
    },
    actionAudit,
    lifecycle,
    stageCounts: stageRows.rows.map((item) => ({
      session: item.session_slug,
      chamber: item.chamber_slug,
      stageKind: item.stage_kind,
      events: Number(item.events),
      bills: Number(item.bills),
    })),
    exclusions: exclusionRows.rows.map((item) => ({ reason: item.reason, bills: Number(item.bills) })),
    examples: {
      otherUnclassifiedDatedActions: unclassifiedExamples.rows,
      passageMismatches: passageMismatchExamples.rows,
      preIntroductionEvents: preIntroductionExamples.rows,
      postExpirationEvents: postExpirationExamples.rows,
      noClassifiedProcessEvents: noActionExamples.rows,
    },
    gate: {
      hardFailures,
      taxonomyReviewRequired: actionAudit.otherUnclassifiedDatedActions > 0
        || actionAudit.unclassifiedChamberDatedActions > 0,
      postTerminalReviewRequired: lifecycle.eventsAfterSourceChamberPassage > 0
        || lifecycle.authoritativePassagesWithSessionExpiration > 0,
      passed: hardFailures.length === 0,
    },
  };
}
