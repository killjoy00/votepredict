export type MigrationLedgerEntry = {
  filename: string;
  checksum: string;
};

export type MigrationLedgerDrift = {
  missing: string[];
  unexpected: string[];
  checksumMismatches: Array<{ filename: string; expected: string; actual: string }>;
};

export function compareMigrationLedgers(
  expected: readonly MigrationLedgerEntry[],
  applied: readonly MigrationLedgerEntry[],
): MigrationLedgerDrift {
  const expectedByFilename = new Map(expected.map((entry) => [entry.filename, entry.checksum]));
  const appliedByFilename = new Map(applied.map((entry) => [entry.filename, entry.checksum]));

  const missing = [...expectedByFilename.keys()]
    .filter((filename) => !appliedByFilename.has(filename))
    .sort();
  const unexpected = [...appliedByFilename.keys()]
    .filter((filename) => !expectedByFilename.has(filename))
    .sort();
  const checksumMismatches = [...expectedByFilename.entries()]
    .flatMap(([filename, expectedChecksum]) => {
      const actualChecksum = appliedByFilename.get(filename);
      if (!actualChecksum || actualChecksum === expectedChecksum) return [];
      return [{ filename, expected: expectedChecksum, actual: actualChecksum }];
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));

  return { missing, unexpected, checksumMismatches };
}

export function hasMigrationLedgerDrift(drift: MigrationLedgerDrift): boolean {
  return drift.missing.length > 0 || drift.unexpected.length > 0 || drift.checksumMismatches.length > 0;
}
