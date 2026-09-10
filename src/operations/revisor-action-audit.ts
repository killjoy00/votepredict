import { pool } from '@/lib/db';
import { auditRevisorSourceChamberPassage, fetchRevisorStatusXml } from '@/sources/minnesota/revisor-actions';

type BillRow = {
  bill_id: string;
  identifier: string;
  session_slug: string;
  chamber_slug: 'house' | 'senate';
  status_xml_url: string;
  provisional_outcome: boolean | null;
};

type XmlDiagnostic = {
  identifier: string;
  xmlLength: number;
  prefix: string;
  tagNames: string[];
  actionLikeTags: string[];
  actionTokenIndex: number;
  actionFragment: string | null;
};

type AuditRow = BillRow & {
  officialPassed: boolean;
  officialFailed: boolean;
  actionCount: number;
  classifiedActions: number;
  unclassifiedActions: number;
  fieldNames: string[];
  passageDescriptions: string[];
  xmlDiagnostic: XmlDiagnostic | null;
};

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function boundedText(value: string, max = 800): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function diagnoseXml(identifier: string, xml: string): XmlDiagnostic {
  const tagNames = [...new Set(
    [...xml.matchAll(/<\s*\/?\s*([A-Za-z_][A-Za-z0-9_.:-]*)\b/g)].map((match) => match[1]),
  )].sort();
  const actionTokenIndex = xml.search(/action/i);
  const fragmentStart = actionTokenIndex < 0 ? -1 : Math.max(0, actionTokenIndex - 300);
  return {
    identifier,
    xmlLength: xml.length,
    prefix: boundedText(xml, 600),
    tagNames: tagNames.slice(0, 120),
    actionLikeTags: tagNames.filter((tag) => /action/i.test(tag)).slice(0, 60),
    actionTokenIndex,
    actionFragment: fragmentStart < 0 ? null : boundedText(xml.slice(fragmentStart, fragmentStart + 1400), 1000),
  };
}

async function mapConcurrent<T, R>(values: readonly T[], concurrency: number, fn: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await fn(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

export async function runRevisorActionHistoryAudit() {
  const result = await pool.query<BillRow>(`
    WITH candidates AS (
      SELECT b.id::text AS bill_id,
             b.identifier,
             s.slug AS session_slug,
             c.slug AS chamber_slug,
             COALESCE(b.metadata #>> '{revisorUniverse,statusXmlUrl}', b.source_url) AS status_xml_url,
             CASE b.metadata #>> '{sourceChamberPassage,outcome}'
               WHEN 'true' THEN true
               WHEN 'false' THEN false
               ELSE NULL
             END AS provisional_outcome,
             row_number() OVER (
               PARTITION BY s.slug, c.slug, COALESCE(b.metadata #>> '{sourceChamberPassage,outcome}', 'unknown')
               ORDER BY b.identifier
             ) AS sample_rank
        FROM bills b
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN chambers c ON c.id = b.originating_chamber_id AND c.slug IN ('house', 'senate')
       WHERE b.metadata ? 'revisorUniverse'
         AND COALESCE(b.metadata #>> '{revisorUniverse,statusXmlUrl}', b.source_url) IS NOT NULL
    )
    SELECT bill_id, identifier, session_slug, chamber_slug, status_xml_url, provisional_outcome
      FROM candidates
     WHERE sample_rank <= 5
     ORDER BY session_slug, chamber_slug, provisional_outcome NULLS LAST, identifier`);

  const failures: Array<{ identifier: string; error: string }> = [];
  const audits = (await mapConcurrent(result.rows, 6, async (bill, index): Promise<AuditRow | null> => {
    try {
      const xml = await fetchRevisorStatusXml(bill.status_xml_url);
      const audit = auditRevisorSourceChamberPassage({ xml, identifier: bill.identifier });
      return {
        ...bill,
        officialPassed: audit.sourceChamberPassed,
        officialFailed: audit.sourceChamberFailed,
        actionCount: audit.actions.length,
        classifiedActions: audit.classifiedActions,
        unclassifiedActions: audit.unclassifiedActions,
        fieldNames: [...new Set(audit.actions.flatMap((action) => Object.keys(action.fields)))].sort(),
        passageDescriptions: audit.passageActions.map((action) => action.description),
        xmlDiagnostic: index < 3 ? diagnoseXml(bill.identifier, xml) : null,
      };
    } catch (error) {
      failures.push({ identifier: bill.identifier, error: safeError(error) });
      return null;
    }
  })).filter((row): row is AuditRow => row !== null);

  const fieldNames = [...new Set(audits.flatMap((row) => row.fieldNames))].sort();
  const mismatches = audits.filter((row) => row.provisional_outcome !== null && row.officialPassed !== row.provisional_outcome);
  return {
    purpose: 'Audit only. No production bill labels are modified.',
    sampledBills: result.rows.length,
    fetchedBills: audits.length,
    fetchFailures: failures,
    xmlDiagnostics: audits.flatMap((row) => row.xmlDiagnostic ? [row.xmlDiagnostic] : []),
    actionFieldNames: fieldNames,
    parsedActions: audits.reduce((sum, row) => sum + row.actionCount, 0),
    classifiedActions: audits.reduce((sum, row) => sum + row.classifiedActions, 0),
    unclassifiedActions: audits.reduce((sum, row) => sum + row.unclassifiedActions, 0),
    officialSourcePasses: audits.filter((row) => row.officialPassed).length,
    officialSourceFailures: audits.filter((row) => row.officialFailed).length,
    provisionalMismatches: mismatches.map((row) => ({
      identifier: row.identifier,
      session: row.session_slug,
      chamber: row.chamber_slug,
      provisionalOutcome: row.provisional_outcome,
      officialPassed: row.officialPassed,
      officialFailed: row.officialFailed,
      passageDescriptions: row.passageDescriptions,
      fieldNames: row.fieldNames,
    })),
    samples: audits.slice(0, 12).map((row) => ({
      identifier: row.identifier,
      session: row.session_slug,
      chamber: row.chamber_slug,
      provisionalOutcome: row.provisional_outcome,
      officialPassed: row.officialPassed,
      actionCount: row.actionCount,
      classifiedActions: row.classifiedActions,
      unclassifiedActions: row.unclassifiedActions,
      passageDescriptions: row.passageDescriptions,
      fieldNames: row.fieldNames,
    })),
  };
}
