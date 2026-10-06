export const HOUSE_ATTACHMENT_ARCHIVE_PROBE_ARTIFACT_ID = 11381821796 as const;
export const HOUSE_ATTACHMENT_ARCHIVE_PROBE_ARTIFACT_DIGEST =
  'sha256:8142a38cfbe4b609d94bdaa5755bd598e1f9f8cd41afcd3fe58dffd1c7748cea' as const;

export const HOUSE_ATTACHMENT_ARCHIVE_RETRY_EXPECTED = [
  {
    billIdentifier: 'HF109',
    attachmentUrl: 'https://www.house.mn.gov/comm/docs/kaOG5oQL_kugPOO2YiuowQ.pdf',
    potentialRows: 134,
  },
  {
    billIdentifier: 'HF1952',
    attachmentUrl: 'https://www.house.mn.gov/comm/docs/-RhtYzzLNU2aun2Gbxpseg.pdf',
    potentialRows: 134,
  },
] as const;

export type HouseAttachmentArchiveProbePriorRow = {
  attachmentUrl: string;
  attachmentNames: string[];
  attachmentKinds: string[];
  billIds: string[];
  billIdentifiers: string[];
  firstOfficialPostedOn: string;
  lastOfficialPostedOn: string;
  firstTargetVoteOn: string | null;
  lastTargetVoteOn: string | null;
  potentialRows: number;
  classification: string;
  discoveryError: string | null;
  captureCount: number;
  eligibleCaptureCount: number;
};

export type HouseAttachmentArchiveProbePriorReport = {
  schemaVersion: string;
  selectorLineage: {
    runId: number;
    artifactId: number;
    artifactDigest: string;
    candidateInputSha256: string;
    pilotSize: number;
    potentialRows: number;
  };
  currentMatrix: {
    artifactId: number;
    artifactDigest: string;
    exactBillCoveredRows: number;
    trainingExactBillCoveredRows: number;
    frozenPilotRowsAlreadyCovered: number;
  };
  summary: {
    probedPdfs: number;
    classificationCounts: Record<string, number>;
    verifiedPdfs: number;
    verifiedBills: number;
    verifiedPotentialRows: number;
    verifiedEvents: number;
    verifiedMemberships: number;
  };
  rows: HouseAttachmentArchiveProbePriorRow[];
};

function transientDiscoveryFailure(message: string | null): boolean {
  return Boolean(message && /TimeoutError|timed? out|fetch failed|HTTP (?:429|500|502|503|504)\b/i.test(message));
}

export function selectHouseAttachmentArchiveAmbiguousRetryRows(
  report: HouseAttachmentArchiveProbePriorReport,
): HouseAttachmentArchiveProbePriorRow[] {
  if (report.schemaVersion !== 'historical-density-house-attachment-archive-probe-v1') {
    throw new Error('House attachment archive probe schema drifted');
  }
  if (
    report.selectorLineage.runId !== 37390453287
    || report.selectorLineage.artifactId !== 11381216160
    || report.selectorLineage.artifactDigest !== 'sha256:e6f795c501db56ec9e009ee14afad54e172604d052914eafbe50778d3f6cec20'
    || report.selectorLineage.pilotSize !== 24
    || report.selectorLineage.potentialRows !== 5628
  ) {
    throw new Error('House attachment archive probe selector lineage drifted');
  }
  if (
    report.currentMatrix.artifactId !== 11380755983
    || report.currentMatrix.artifactDigest !== 'sha256:fe2254fc9d2ed0ea00712feab384958e4942cf387e442c29515b3a75183692d7'
    || report.currentMatrix.exactBillCoveredRows !== 38
    || report.currentMatrix.trainingExactBillCoveredRows !== 3
    || report.currentMatrix.frozenPilotRowsAlreadyCovered !== 0
  ) {
    throw new Error('House attachment archive probe v1.5 baseline drifted');
  }

  const counts = report.summary.classificationCounts;
  if (
    report.summary.probedPdfs !== 24
    || counts.no_archive_pdf_capture !== 22
    || counts.ambiguous_discovery_failure !== 2
    || Object.keys(counts).length !== 2
    || report.summary.verifiedPdfs !== 0
    || report.summary.verifiedBills !== 0
    || report.summary.verifiedPotentialRows !== 0
    || report.summary.verifiedEvents !== 0
    || report.summary.verifiedMemberships !== 0
    || report.rows.length !== 24
  ) {
    throw new Error('House attachment archive probe result contract drifted');
  }

  const ambiguous = report.rows
    .filter((row) => row.classification === 'ambiguous_discovery_failure')
    .sort((a, b) => a.attachmentUrl.localeCompare(b.attachmentUrl));

  if (ambiguous.length !== HOUSE_ATTACHMENT_ARCHIVE_RETRY_EXPECTED.length) {
    throw new Error('House attachment archive retry row count drifted');
  }
  for (const expected of HOUSE_ATTACHMENT_ARCHIVE_RETRY_EXPECTED) {
    const row = ambiguous.find((candidate) => candidate.attachmentUrl === expected.attachmentUrl);
    if (
      !row
      || row.billIdentifiers.length !== 1
      || row.billIdentifiers[0] !== expected.billIdentifier
      || row.potentialRows !== expected.potentialRows
      || row.captureCount !== 0
      || row.eligibleCaptureCount !== 0
      || !transientDiscoveryFailure(row.discoveryError)
    ) {
      throw new Error('House attachment archive retry identity/reason drifted for ' + expected.billIdentifier);
    }
  }

  const nonAmbiguous = report.rows.filter((row) => row.classification !== 'ambiguous_discovery_failure');
  if (nonAmbiguous.some((row) => row.classification !== 'no_archive_pdf_capture')) {
    throw new Error('House attachment archive retry would reopen a non-canonical result');
  }

  return ambiguous;
}
