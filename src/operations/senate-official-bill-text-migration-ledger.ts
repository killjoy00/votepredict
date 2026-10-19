/**
 * Verify the protected official-text migration ledger without requiring other
 * independent evidence tracks to deploy migrations merged after our own 0027.
 *
 * All earlier prerequisites must have identical, applied checksums. Every
 * later migration *already applied* must also be the exact reviewed prefix,
 * in order, with identical checksums. Later reviewed but unapplied migrations
 * are permitted because this collector never uses their tables.
 *
 * A missing 0027 remains the only permitted ledger gap when other agents have
 * already deployed newer migrations (matching the original deployment guard).
 */
export interface BillTextMigrationLedgerRow {
  filename: string;
  checksum: string;
}
export const OFFICIAL_TEXT_MIGRATION = '0027_senate_official_bill_text_raw.sql';

function matches(a: BillTextMigrationLedgerRow[], b: BillTextMigrationLedgerRow[]): boolean {
  return a.length === b.length &&
    a.every((row, index) =>
      row.filename === b[index].filename && row.checksum === b[index].checksum);
}

export function validateBillTextMigrationLedger(
  applied: BillTextMigrationLedgerRow[],
  reviewed: BillTextMigrationLedgerRow[],
): boolean {
  const index = reviewed.findIndex(row => row.filename === OFFICIAL_TEXT_MIGRATION);
  if (index !== 26 || !reviewed[25]?.filename.startsWith('0026_')) {
    throw Error('official_text_migration_inventory_moved');
  }
  if (!reviewed.every((row, i) => i === 0 || reviewed[i - 1].filename < row.filename) ||
      !applied.every((row, i) => i === 0 || applied[i - 1].filename < row.filename)) {
    throw Error('official_text_migration_ledger_unsorted_or_duplicate');
  }
  const required = reviewed.slice(0, index + 1);
  const installedBeforeOrAt = applied.filter(row => row.filename <= OFFICIAL_TEXT_MIGRATION);
  const installedLater = applied.filter(row => row.filename > OFFICIAL_TEXT_MIGRATION);
  const laterReviewed = reviewed.slice(index + 1);

  // A recorded future migration must be known, checksum-identical and in
  // sequence. Never silently allow an unknown, edited or out-of-order schema.
  if (!matches(installedLater, laterReviewed.slice(0, installedLater.length))) {
    throw Error('production_migration_checksum_drift_or_out_of_order');
  }
  if (matches(installedBeforeOrAt, required)) return true;
  if (matches(installedBeforeOrAt,
    required.filter(row => row.filename !== OFFICIAL_TEXT_MIGRATION))) return false;
  throw Error('production_migration_checksum_drift_or_prerequisite_missing');
}
