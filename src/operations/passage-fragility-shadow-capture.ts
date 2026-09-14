import type { Pool } from 'pg';
import type { PassageRule } from '../forecasting/chamber';
import {
  computePassageFragilityShadow,
  PASSAGE_FRAGILITY_CAPTURE_AFTER,
  PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
  PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
  PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL,
} from '../forecasting/passage-fragility-shadow';

interface RevisionRow {
  revision_id: string;
  forecast_id: string;
  generated_at: string;
  passage_probability: number;
  metadata: Record<string, unknown>;
}

interface MemberRow {
  revision_id: string;
  yes_probability: number | null;
  facts: unknown;
}

function passageRuleFromMetadata(metadata: Record<string, unknown>): PassageRule {
  const value = metadata.passageRule;
  if (!value || typeof value !== 'object') throw new Error('Eligible revision is missing passageRule metadata');
  const rule = value as Record<string, unknown>;
  if (rule.kind === 'majority-of-cast') return { kind: 'majority-of-cast' };
  if (rule.kind === 'absolute-majority' && Number.isInteger(rule.seats)) return { kind: 'absolute-majority', seats: rule.seats as number };
  if (rule.kind === 'fixed' && Number.isInteger(rule.requiredYes)) return { kind: 'fixed', requiredYes: rule.requiredYes as number };
  if (rule.kind === 'fraction-of-seats'
    && Number.isInteger(rule.seats)
    && Number.isInteger(rule.numerator)
    && Number.isInteger(rule.denominator)) {
    return {
      kind: 'fraction-of-seats',
      seats: rule.seats as number,
      numerator: rule.numerator as number,
      denominator: rule.denominator as number,
    };
  }
  throw new Error('Eligible revision has unsupported passageRule metadata');
}

function selectedAnalogueCount(metadata: Record<string, unknown>): number {
  const analogue = metadata.analogue;
  if (!analogue || typeof analogue !== 'object') return 0;
  const selected = (analogue as Record<string, unknown>).selected;
  return Array.isArray(selected) ? selected.length : 0;
}

function analogueWeight(facts: unknown): number {
  if (!Array.isArray(facts)) return 0;
  for (const item of facts) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (row.kind === 'model_support' && typeof row.analogue === 'number' && Number.isFinite(row.analogue)) {
      return Math.max(0, row.analogue);
    }
  }
  return 0;
}

export async function captureProspectivePassageFragilityShadows(pool: Pool) {
  const revisions = await pool.query<RevisionRow>(`
    SELECT r.id AS revision_id,
           r.forecast_id,
           r.generated_at::text,
           r.passage_probability,
           r.metadata
      FROM forecast_revisions r
      JOIN forecasts f ON f.id = r.forecast_id
      JOIN legislative_sessions s ON s.id = f.session_id
      JOIN chambers c ON c.id = f.target_chamber_id
     WHERE s.slug = $1
       AND c.slug = $2
       AND r.research_mode = 'quick'
       AND r.model_version = $3
       AND r.generated_at >= $4::timestamptz
       AND r.passage_probability IS NOT NULL
       AND NOT (r.metadata ? 'passageFragilityShadow')
     ORDER BY r.generated_at, r.id`, [
    PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
    PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
    PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL,
    PASSAGE_FRAGILITY_CAPTURE_AFTER,
  ]);

  if (revisions.rows.length === 0) {
    return {
      schemaVersion: 'passage-fragility-shadow-capture-v1' as const,
      eligibleRevisions: 0,
      capturedRevisions: 0,
      skippedIncompleteRevisions: 0,
      flaggedRevisions: 0,
      productionAction: 'none' as const,
    };
  }

  const ids = revisions.rows.map((row) => row.revision_id);
  const members = await pool.query<MemberRow>(`
    SELECT revision_id, yes_probability, facts
      FROM forecast_member_predictions
     WHERE revision_id = ANY($1::uuid[])
     ORDER BY revision_id, membership_id`, [ids]);
  const byRevision = new Map<string, MemberRow[]>();
  for (const member of members.rows) {
    const rows = byRevision.get(member.revision_id) ?? [];
    rows.push(member);
    byRevision.set(member.revision_id, rows);
  }

  let capturedRevisions = 0;
  let skippedIncompleteRevisions = 0;
  let flaggedRevisions = 0;
  for (const revision of revisions.rows) {
    const memberRows = byRevision.get(revision.revision_id) ?? [];
    if (memberRows.length === 0 || memberRows.some((row) => row.yes_probability === null)) {
      skippedIncompleteRevisions += 1;
      continue;
    }
    const shadow = computePassageFragilityShadow({
      memberProbabilities: memberRows.map((row) => row.yes_probability as number),
      analogueEffectiveWeights: memberRows.map((row) => analogueWeight(row.facts)),
      selectedAnalogues: selectedAnalogueCount(revision.metadata),
      passageRule: passageRuleFromMetadata(revision.metadata),
      servingPassageProbability: revision.passage_probability,
    });
    const captured = {
      ...shadow,
      capturedAt: new Date().toISOString(),
      forecastRevisionGeneratedAt: revision.generated_at,
      prospectiveScope: {
        session: PASSAGE_FRAGILITY_PROSPECTIVE_SESSION,
        chamber: PASSAGE_FRAGILITY_PROSPECTIVE_CHAMBER,
        researchMode: 'quick',
        servingMemberModelVersion: PASSAGE_FRAGILITY_SERVING_MEMBER_MODEL,
      },
    };
    const updated = await pool.query(`
      UPDATE forecast_revisions
         SET metadata = jsonb_set(metadata, '{passageFragilityShadow}', $2::jsonb, true)
       WHERE id = $1
         AND NOT (metadata ? 'passageFragilityShadow')`, [revision.revision_id, JSON.stringify(captured)]);
    if ((updated.rowCount ?? 0) > 0) {
      capturedRevisions += 1;
      if (shadow.flagged) flaggedRevisions += 1;
    }
  }

  return {
    schemaVersion: 'passage-fragility-shadow-capture-v1' as const,
    eligibleRevisions: revisions.rows.length,
    capturedRevisions,
    skippedIncompleteRevisions,
    flaggedRevisions,
    productionAction: 'none' as const,
  };
}
