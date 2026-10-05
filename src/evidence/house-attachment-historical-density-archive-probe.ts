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
