/** Only replacements known to the system by the requested cutoff can hide a row. */
export function supersessionAsOfSql(cutoff: '$2' | '$3'): string {
  return `NOT EXISTS (
    SELECT 1 FROM evidence_relationships er
    JOIN evidence_items replacing ON replacing.id=er.from_evidence_id
    JOIN source_documents replacing_source ON replacing_source.id=replacing.source_document_id
    WHERE er.to_evidence_id=ei.id AND er.relation_kind='supersedes'
      AND replacing.created_at <= ${cutoff}::timestamptz
      AND replacing_source.fetched_at <= ${cutoff}::timestamptz
      AND (replacing.published_at IS NULL OR replacing.published_at <= ${cutoff}::timestamptz)
  )`;
}
