import { houseAttachmentCaptureIsAfterListingDate } from './house-committee-attachment-content.js';
import type { HouseAttachmentHistoricalDensityPilotRow } from './house-attachment-historical-density-selector.js';

export const HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID = 11381216160 as const;
export const HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST =
  'sha256:e6f795c501db56ec9e009ee14afad54e172604d052914eafbe50778d3f6cec20' as const;
export const HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256 =
  '7b643fc6cf11648163609a07b1619c1984597f70063b0acfe9ae01dc451217fe' as const;
export const HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE = 24 as const;
export const HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS = 5628 as const;

export type HouseAttachmentArchiveProbeTarget = {
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

export type HouseAttachmentArchiveProbeOpportunity = {
  rowKeys: string[];
  voteEventIds: string[];
  membershipIds: string[];
  billIds: string[];
  billIdentifiers: string[];
};

export function houseAttachmentArchiveProbeTargetKey(
  row: Pick<HouseAttachmentArchiveProbeTarget, 'voteEventId' | 'membershipId'>,
): string {
  return row.voteEventId + '|' + row.membershipId;
}

export function houseAttachmentArchiveProbeDiscoveryFrom(listedOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(listedOn)) {
    throw new Error('House attachment listing date is invalid');
  }
  const parsed = new Date(listedOn + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== listedOn) {
    throw new Error('House attachment listing date is invalid');
  }
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateHouseAttachmentDensityPilot(
  pilot: readonly HouseAttachmentHistoricalDensityPilotRow[],
): {
  uniquePotentialRows: number;
  uniqueUrls: number;
  uniqueBills: number;
} {
  if (pilot.length !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE) {
    throw new Error('House attachment density pilot size drifted: ' + pilot.length);
  }
  const urls = new Set<string>();
  const bills = new Set<string>();
  const rowKeys = new Set<string>();

  for (const candidate of pilot) {
    if (!candidate.selectableFreshSurface || candidate.priorWaybackPdf || candidate.priorWaybackScan) {
      throw new Error('House attachment density pilot contains an exhausted/non-fresh surface');
    }
    if (!validDateOnly(candidate.firstOfficialPostedOn) || !validDateOnly(candidate.lastOfficialPostedOn)) {
      throw new Error('House attachment density pilot has an invalid official listing date');
    }
    if (candidate.firstOfficialPostedOn > candidate.lastOfficialPostedOn) {
      throw new Error('House attachment density pilot listing-date range is invalid');
    }
    if (!candidate.firstTargetVoteOn || !candidate.lastTargetVoteOn
      || !validDateOnly(candidate.firstTargetVoteOn) || !validDateOnly(candidate.lastTargetVoteOn)) {
      throw new Error('House attachment density pilot has an invalid target-vote range');
    }
    if (candidate.overlapRows !== candidate.overlapRowKeys.length) {
      throw new Error('House attachment density pilot overlap count drifted');
    }
    if (candidate.billIds.length !== 1 || candidate.billIdentifiers.length !== 1) {
      throw new Error('House attachment density pilot candidate must remain exact to one bill');
    }
    if (urls.has(candidate.attachmentUrl)) {
      throw new Error('House attachment density pilot contains a duplicate physical PDF URL');
    }
    urls.add(candidate.attachmentUrl);
    bills.add(candidate.billIds[0]);
    candidate.overlapRowKeys.forEach((key) => rowKeys.add(key));
  }

  if (rowKeys.size !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS) {
    throw new Error('House attachment density pilot potential-row union drifted: ' + rowKeys.size);
  }
  if (bills.size !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE) {
    throw new Error('House attachment density pilot bill count drifted: ' + bills.size);
  }

  return {
    uniquePotentialRows: rowKeys.size,
    uniqueUrls: urls.size,
    uniqueBills: bills.size,
  };
}

export function houseAttachmentCaptureOpportunity(input: {
  candidate: HouseAttachmentHistoricalDensityPilotRow;
  targetByKey: ReadonlyMap<string, HouseAttachmentArchiveProbeTarget>;
  capturedAt: string;
}): HouseAttachmentArchiveProbeOpportunity {
  const captured = new Date(input.capturedAt);
  if (!Number.isFinite(captured.getTime())) throw new Error('House attachment capture timestamp is invalid');

  // Conservative across any repeated listing rows for the same physical PDF:
  // the archive capture must be on a later calendar date than the latest official listing date.
  if (!houseAttachmentCaptureIsAfterListingDate(input.capturedAt, input.candidate.lastOfficialPostedOn)) {
    return { rowKeys: [], voteEventIds: [], membershipIds: [], billIds: [], billIdentifiers: [] };
  }

  const captureDate = captured.toISOString().slice(0, 10);
  const rows: HouseAttachmentArchiveProbeTarget[] = [];
  for (const key of input.candidate.overlapRowKeys) {
    const target = input.targetByKey.get(key);
    if (!target) throw new Error('House attachment pilot row key missing from immutable target universe: ' + key);
    if (houseAttachmentArchiveProbeTargetKey(target) !== key) {
      throw new Error('House attachment immutable target row-key identity drifted');
    }
    if (target.session !== '2021-2022' || target.chamber !== 'house') {
      throw new Error('House attachment pilot target escaped the frozen 2021-22 House universe');
    }
    if (!input.candidate.billIds.includes(target.billId)
      || !input.candidate.billIdentifiers.includes(target.identifier)) {
      throw new Error('House attachment pilot target bill identity drifted');
    }
    if (!validDateOnly(target.occurredOn)) throw new Error('House attachment target vote date is invalid');
    // Date-granular replay is strict: a capture on the vote date is not eligible.
    if (captureDate >= target.occurredOn) continue;
    rows.push(target);
  }

  return {
    rowKeys: rows.map(houseAttachmentArchiveProbeTargetKey).sort(),
    voteEventIds: [...new Set(rows.map((row) => row.voteEventId))].sort(),
    membershipIds: [...new Set(rows.map((row) => row.membershipId))].sort(),
    billIds: [...new Set(rows.map((row) => row.billId))].sort(),
    billIdentifiers: [...new Set(rows.map((row) => row.identifier))].sort(),
  };
}


export const HOUSE_ATTACHMENT_DENSITY_ARCHIVE_PROBE_ARTIFACT_ID = 11381821796 as const;
export const HOUSE_ATTACHMENT_DENSITY_ARCHIVE_PROBE_ARTIFACT_DIGEST =
  'sha256:8142a38cfbe4b609d94bdaa5755bd598e1f9f8cd41afcd3fe58dffd1c7748cea' as const;
export const HOUSE_ATTACHMENT_DENSITY_ARCHIVE_RETRY_SIZE = 2 as const;

export type HouseAttachmentArchiveProbeFrozenRow = {
  attachmentUrl: string;
  billIdentifiers: string[];
  classification: string;
  verified: unknown | null;
};

export type HouseAttachmentArchiveProbeFrozenReport = {
  schemaVersion: string;
  selectorLineage: {
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
  rows: HouseAttachmentArchiveProbeFrozenRow[];
};

export function selectHouseAttachmentArchiveRetryCandidates(input: {
  priorProbe: HouseAttachmentArchiveProbeFrozenReport;
  pilot: readonly HouseAttachmentHistoricalDensityPilotRow[];
}): HouseAttachmentHistoricalDensityPilotRow[] {
  const prior = input.priorProbe;
  if (prior.schemaVersion !== 'historical-density-house-attachment-archive-probe-v1') {
    throw new Error('House attachment prior archive-probe schema drifted');
  }
  if (
    prior.selectorLineage.artifactId !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_ID
    || prior.selectorLineage.artifactDigest !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_ARTIFACT_DIGEST
    || prior.selectorLineage.candidateInputSha256 !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_INPUT_SHA256
    || prior.selectorLineage.pilotSize !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
    || prior.selectorLineage.potentialRows !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_POTENTIAL_ROWS
  ) {
    throw new Error('House attachment prior archive-probe selector lineage drifted');
  }
  if (
    prior.currentMatrix.artifactId !== 11380755983
    || prior.currentMatrix.artifactDigest !== 'sha256:fe2254fc9d2ed0ea00712feab384958e4942cf387e442c29515b3a75183692d7'
    || prior.currentMatrix.exactBillCoveredRows !== 38
    || prior.currentMatrix.trainingExactBillCoveredRows !== 3
    || prior.currentMatrix.frozenPilotRowsAlreadyCovered !== 0
  ) {
    throw new Error('House attachment prior archive-probe v1.5 matrix lineage drifted');
  }
  if (
    prior.summary.probedPdfs !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE
    || prior.summary.verifiedPdfs !== 0
    || prior.summary.verifiedBills !== 0
    || prior.summary.verifiedPotentialRows !== 0
    || prior.summary.verifiedEvents !== 0
    || prior.summary.verifiedMemberships !== 0
    || prior.summary.classificationCounts.no_archive_pdf_capture !== 22
    || prior.summary.classificationCounts.ambiguous_discovery_failure !== HOUSE_ATTACHMENT_DENSITY_ARCHIVE_RETRY_SIZE
    || Object.keys(prior.summary.classificationCounts).sort().join('|')
      !== 'ambiguous_discovery_failure|no_archive_pdf_capture'
  ) {
    throw new Error('House attachment prior archive-probe result counts drifted');
  }
  if (prior.rows.length !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE) {
    throw new Error('House attachment prior archive-probe row count drifted');
  }

  const pilotByUrl = new Map(input.pilot.map((row) => [row.attachmentUrl, row]));
  if (pilotByUrl.size !== HOUSE_ATTACHMENT_DENSITY_SELECTOR_PILOT_SIZE) {
    throw new Error('House attachment retry pilot URL identity drifted');
  }

  const closedNegativeUrls = new Set(
    prior.rows
      .filter((row) => row.classification === 'no_archive_pdf_capture')
      .map((row) => row.attachmentUrl),
  );
  if (closedNegativeUrls.size !== 22) {
    throw new Error('House attachment retry closed-negative surface count drifted');
  }

  const ambiguous = prior.rows.filter((row) => row.classification === 'ambiguous_discovery_failure');
  if (ambiguous.length !== HOUSE_ATTACHMENT_DENSITY_ARCHIVE_RETRY_SIZE) {
    throw new Error('House attachment retry ambiguity count drifted');
  }
  if (ambiguous.some((row) => row.verified !== null)) {
    throw new Error('House attachment retry cannot include an already verified PDF');
  }

  const selected = ambiguous.map((row) => {
    if (closedNegativeUrls.has(row.attachmentUrl)) {
      throw new Error('House attachment retry attempted to reopen a closed negative surface');
    }
    const candidate = pilotByUrl.get(row.attachmentUrl);
    if (!candidate) throw new Error('House attachment retry URL missing from frozen selector pilot');
    if (
      candidate.billIdentifiers.length !== row.billIdentifiers.length
      || candidate.billIdentifiers.some((value, index) => value !== row.billIdentifiers[index])
    ) {
      throw new Error('House attachment retry bill identity drifted');
    }
    return candidate;
  });

  const urls = new Set(selected.map((row) => row.attachmentUrl));
  if (urls.size !== HOUSE_ATTACHMENT_DENSITY_ARCHIVE_RETRY_SIZE) {
    throw new Error('House attachment retry contains duplicate ambiguous URLs');
  }

  return selected.sort((a, b) => a.attachmentUrl.localeCompare(b.attachmentUrl));
}
