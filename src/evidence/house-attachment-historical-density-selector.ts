import { canonicalHouseCommitteeAttachmentPdfUrl } from './house-committee-attachment-content.js';

export const HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SELECTOR_VERSION =
  'historical-density-house-attachment-selector-v1' as const;
export const HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SESSION = '2021-2022' as const;
export const HOUSE_ATTACHMENT_HISTORICAL_DENSITY_PILOT_SIZE = 24 as const;

export type HouseAttachmentHistoricalDensityTarget = {
  voteEventId: string;
  membershipId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

export type HouseAttachmentHistoricalDensityEvidenceRow = {
  archiveEvidenceId: string;
  billId: string;
  billIdentifier: string;
  attachmentUrl: string;
  attachmentName: string;
  attachmentSubtype: string;
  officialPostedOn: string;
  priorWaybackPdf: boolean;
  priorWaybackScan: boolean;
  currentBodyPresent: boolean;
};

export type HouseAttachmentHistoricalDensityCandidate = {
  attachmentUrl: string;
  attachmentNames: string[];
  attachmentKinds: string[];
  archiveEvidenceIds: string[];
  billIds: string[];
  billIdentifiers: string[];
  firstOfficialPostedOn: string;
  lastOfficialPostedOn: string;
  priorWaybackPdf: boolean;
  priorWaybackScan: boolean;
  currentBodyPresent: boolean;
  selectableFreshSurface: boolean;
  valueTier: number;
  valueTierReason: string;
  overlapRowKeys: string[];
  overlapRows: number;
  overlapEvents: number;
  overlapMemberships: number;
  overlapBillIds: string[];
  overlapBillIdentifiers: string[];
  firstTargetVoteOn: string | null;
  lastTargetVoteOn: string | null;
};

export type HouseAttachmentHistoricalDensityPilotRow =
  HouseAttachmentHistoricalDensityCandidate & {
    marginalRows: number;
    cumulativeRows: number;
    marginalEvents: number;
    cumulativeEvents: number;
  };

const KIND_PRIORITY: Record<string, { tier: number; reason: string }> = {
  committee_rollcall: {
    tier: 1,
    reason: 'member-specific committee action is plausible if the archived body is recovered',
  },
  minutes: {
    tier: 1,
    reason: 'member/speaker/action attribution is plausible if the archived body is recovered',
  },
  testimony_handout: {
    tier: 1,
    reason: 'directional authored testimony or handout text is plausible if the archived body is recovered',
  },
  testifier_list: {
    tier: 2,
    reason: 'named participant attribution is plausible but directional content is less likely',
  },
  amendment: {
    tier: 2,
    reason: 'bill-specific legislative content is likely but member directionality is not guaranteed',
  },
  attachment: {
    tier: 2,
    reason: 'generic attachment may contain useful member/bill text but content class is unknown',
  },
  bill_summary: {
    tier: 3,
    reason: 'bill context is useful but member-specific directionality is unlikely',
  },
  fiscal_note: {
    tier: 3,
    reason: 'bill context is useful but member-specific directionality is unlikely',
  },
  agenda: {
    tier: 4,
    reason: 'scheduling context has low expected member-specific semantic yield',
  },
};

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function kindFromSubtype(subtype: string): string {
  const normalized = subtype.trim().replace(/^committee_archive_/, '');
  return normalized || 'attachment';
}

function candidateValue(kinds: readonly string[]) {
  const ranked = kinds
    .map((kind) => KIND_PRIORITY[kind] ?? {
      tier: 3,
      reason: 'unrecognized attachment class receives conservative mid-low priority',
    })
    .sort((a, b) => a.tier - b.tier || a.reason.localeCompare(b.reason));
  return ranked[0] ?? KIND_PRIORITY.attachment;
}

function attachmentIdentityUrl(value: string): string {
  const canonical = canonicalHouseCommitteeAttachmentPdfUrl(value);
  const url = new URL(canonical);
  if (url.hostname.toLowerCase() === 'house.mn.gov') url.hostname = 'www.house.mn.gov';
  return url.toString();
}

function rowKey(row: Pick<HouseAttachmentHistoricalDensityTarget, 'voteEventId' | 'membershipId'>): string {
  return row.voteEventId + '|' + row.membershipId;
}

export function buildHouseAttachmentHistoricalDensityCandidates(input: {
  evidenceRows: readonly HouseAttachmentHistoricalDensityEvidenceRow[];
  targets: readonly HouseAttachmentHistoricalDensityTarget[];
  coveredRowKeys: ReadonlySet<string>;
}): HouseAttachmentHistoricalDensityCandidate[] {
  const targetByBill = new Map<string, HouseAttachmentHistoricalDensityTarget[]>();
  for (const target of input.targets) {
    if (target.session !== HOUSE_ATTACHMENT_HISTORICAL_DENSITY_SESSION || target.chamber !== 'house') continue;
    if (!validDateOnly(target.occurredOn)) throw new Error('House attachment target has invalid vote date');
    const rows = targetByBill.get(target.billId) ?? [];
    rows.push(target);
    targetByBill.set(target.billId, rows);
  }

  type Aggregate = {
    attachmentUrl: string;
    names: Set<string>;
    kinds: Set<string>;
    archiveEvidenceIds: Set<string>;
    billIds: Set<string>;
    billIdentifiers: Set<string>;
    dates: Set<string>;
    priorWaybackPdf: boolean;
    priorWaybackScan: boolean;
    currentBodyPresent: boolean;
    overlapRows: Map<string, HouseAttachmentHistoricalDensityTarget>;
    overlapBillIds: Set<string>;
    overlapBillIdentifiers: Set<string>;
  };

  const byUrl = new Map<string, Aggregate>();

  for (const row of input.evidenceRows) {
    if (!validDateOnly(row.officialPostedOn)) throw new Error('House attachment candidate has invalid official posted date');
    const attachmentUrl = attachmentIdentityUrl(row.attachmentUrl);
    let aggregate = byUrl.get(attachmentUrl);
    if (!aggregate) {
      aggregate = {
        attachmentUrl,
        names: new Set(),
        kinds: new Set(),
        archiveEvidenceIds: new Set(),
        billIds: new Set(),
        billIdentifiers: new Set(),
        dates: new Set(),
        priorWaybackPdf: false,
        priorWaybackScan: false,
        currentBodyPresent: false,
        overlapRows: new Map(),
        overlapBillIds: new Set(),
        overlapBillIdentifiers: new Set(),
      };
      byUrl.set(attachmentUrl, aggregate);
    }

    aggregate.names.add(row.attachmentName.trim() || 'House committee attachment');
    aggregate.kinds.add(kindFromSubtype(row.attachmentSubtype));
    aggregate.archiveEvidenceIds.add(row.archiveEvidenceId);
    aggregate.billIds.add(row.billId);
    aggregate.billIdentifiers.add(row.billIdentifier);
    aggregate.dates.add(row.officialPostedOn);
    aggregate.priorWaybackPdf ||= row.priorWaybackPdf;
    aggregate.priorWaybackScan ||= row.priorWaybackScan;
    aggregate.currentBodyPresent ||= row.currentBodyPresent;

    for (const target of targetByBill.get(row.billId) ?? []) {
      const key = rowKey(target);
      if (input.coveredRowKeys.has(key)) continue;
      if (row.officialPostedOn >= target.occurredOn) continue;
      aggregate.overlapRows.set(key, target);
      aggregate.overlapBillIds.add(row.billId);
      aggregate.overlapBillIdentifiers.add(row.billIdentifier);
    }
  }

  return [...byUrl.values()].map((aggregate) => {
    const dates = [...aggregate.dates].sort();
    const overlapTargets = [...aggregate.overlapRows.values()];
    const targetDates = overlapTargets.map((row) => row.occurredOn).sort();
    const value = candidateValue([...aggregate.kinds]);
    const selectableFreshSurface = !aggregate.priorWaybackPdf && !aggregate.priorWaybackScan;
    return {
      attachmentUrl: aggregate.attachmentUrl,
      attachmentNames: [...aggregate.names].sort(),
      attachmentKinds: [...aggregate.kinds].sort(),
      archiveEvidenceIds: [...aggregate.archiveEvidenceIds].sort(),
      billIds: [...aggregate.billIds].sort(),
      billIdentifiers: [...aggregate.billIdentifiers].sort(),
      firstOfficialPostedOn: dates[0]!,
      lastOfficialPostedOn: dates.at(-1)!,
      priorWaybackPdf: aggregate.priorWaybackPdf,
      priorWaybackScan: aggregate.priorWaybackScan,
      currentBodyPresent: aggregate.currentBodyPresent,
      selectableFreshSurface,
      valueTier: value.tier,
      valueTierReason: value.reason,
      overlapRowKeys: [...aggregate.overlapRows.keys()].sort(),
      overlapRows: aggregate.overlapRows.size,
      overlapEvents: new Set(overlapTargets.map((row) => row.voteEventId)).size,
      overlapMemberships: new Set(overlapTargets.map((row) => row.membershipId)).size,
      overlapBillIds: [...aggregate.overlapBillIds].sort(),
      overlapBillIdentifiers: [...aggregate.overlapBillIdentifiers].sort(),
      firstTargetVoteOn: targetDates[0] ?? null,
      lastTargetVoteOn: targetDates.at(-1) ?? null,
    };
  }).sort((a, b) =>
    b.overlapRows - a.overlapRows
    || a.valueTier - b.valueTier
    || b.overlapEvents - a.overlapEvents
    || a.firstOfficialPostedOn.localeCompare(b.firstOfficialPostedOn)
    || a.attachmentUrl.localeCompare(b.attachmentUrl)
  );
}

function marginalEventCount(candidate: HouseAttachmentHistoricalDensityCandidate, coveredRowKeys: ReadonlySet<string>) {
  const events = new Set<string>();
  for (const key of candidate.overlapRowKeys) {
    if (coveredRowKeys.has(key)) continue;
    events.add(key.split('|', 1)[0]!);
  }
  return events.size;
}

export function selectHouseAttachmentHistoricalDensityPilot(
  candidates: readonly HouseAttachmentHistoricalDensityCandidate[],
  limit = HOUSE_ATTACHMENT_HISTORICAL_DENSITY_PILOT_SIZE,
): HouseAttachmentHistoricalDensityPilotRow[] {
  const remaining = candidates.filter((candidate) => candidate.selectableFreshSurface && candidate.overlapRows > 0);
  const coveredRows = new Set<string>();
  const coveredEvents = new Set<string>();
  const selected: HouseAttachmentHistoricalDensityPilotRow[] = [];

  while (selected.length < Math.max(0, limit) && remaining.length) {
    remaining.sort((a, b) => {
      const aMarginal = a.overlapRowKeys.filter((key) => !coveredRows.has(key)).length;
      const bMarginal = b.overlapRowKeys.filter((key) => !coveredRows.has(key)).length;
      return bMarginal - aMarginal
        || a.valueTier - b.valueTier
        || marginalEventCount(b, coveredRows) - marginalEventCount(a, coveredRows)
        || Number(b.currentBodyPresent) - Number(a.currentBodyPresent)
        || a.firstOfficialPostedOn.localeCompare(b.firstOfficialPostedOn)
        || a.attachmentUrl.localeCompare(b.attachmentUrl);
    });

    const candidate = remaining.shift()!;
    const marginalRowKeys = candidate.overlapRowKeys.filter((key) => !coveredRows.has(key));
    if (!marginalRowKeys.length) break;
    const marginalEvents = new Set(marginalRowKeys.map((key) => key.split('|', 1)[0]!));
    for (const key of marginalRowKeys) coveredRows.add(key);
    for (const event of marginalEvents) coveredEvents.add(event);

    selected.push({
      ...candidate,
      marginalRows: marginalRowKeys.length,
      cumulativeRows: coveredRows.size,
      marginalEvents: marginalEvents.size,
      cumulativeEvents: coveredEvents.size,
    });
  }

  return selected;
}
