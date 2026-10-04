export type QuickEvidenceManualAnnotation = {
  claims?: Array<{
    memberNames?: string[];
    billIdentifiers?: string[];
    stance?: string;
    claimType?: string;
    normalizedClaim?: string;
  }>;
};

export type QuickEvidenceManualAnnotationRow = {
  sourceDocumentId: string;
  annotation: QuickEvidenceManualAnnotation;
};

function normBill(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}

export function mergeQuickEvidenceManualAnnotationsBySource(
  rows: readonly QuickEvidenceManualAnnotationRow[],
): Map<string, QuickEvidenceManualAnnotation> {
  const result = new Map<string, QuickEvidenceManualAnnotation>();
  for (const row of rows) {
    const existing = result.get(row.sourceDocumentId);
    result.set(row.sourceDocumentId, {
      claims: [
        ...(existing?.claims ?? []),
        ...(row.annotation.claims ?? []),
      ],
    });
  }
  return result;
}

export function compareQuickEvidenceToManual(
  annotation: QuickEvidenceManualAnnotation | undefined,
  memberName: string,
  billIdentifier: string,
  stance: string,
): 'agree' | 'opposite' | 'no_match' | 'unreviewed' {
  if (!annotation) return 'unreviewed';
  const bill = normBill(billIdentifier);
  const claims = (annotation.claims ?? []).filter((claim) =>
    ['supports', 'opposes', 'mixed'].includes(claim.stance ?? '')
    && (claim.memberNames ?? []).includes(memberName)
    && (claim.billIdentifiers ?? []).some((identifier) => normBill(identifier) === bill));

  if (claims.length === 0) return 'no_match';
  if (claims.some((claim) => claim.stance === stance || claim.stance === 'mixed')) return 'agree';
  if (claims.some((claim) =>
    (claim.stance === 'supports' && stance === 'opposes')
    || (claim.stance === 'opposes' && stance === 'supports'))) return 'opposite';
  return 'no_match';
}
