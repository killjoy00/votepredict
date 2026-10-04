export interface TemporalEvidenceHistoryRow {
  id: string;
  evidence_kind: string;
  stance: string | null;
  claim: string;
  evidence_series_key: string | null;
}

export function isTemporalStatementKind(kind: string): boolean {
  return kind === 'direct_statement' || kind === 'related_statement';
}

function normalizeClaim(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function temporalEvidenceHistoryKey(row: TemporalEvidenceHistoryRow): string {
  if (!isTemporalStatementKind(row.evidence_kind)) return 'item:' + row.id;
  const series = row.evidence_series_key?.trim();
  if (!series) return 'statement-item:' + row.id;
  return ['statement-series', series, row.evidence_kind, row.stance ?? 'unclear', normalizeClaim(row.claim)].join('|');
}

export function dedupeTemporalEvidenceHistory<T extends TemporalEvidenceHistoryRow>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const row of rows) {
    const key = temporalEvidenceHistoryKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}
