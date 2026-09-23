import { createHash } from 'node:crypto';

export const LIFECYCLE_P7_LINEAGE_SCHEMA_VERSION = 'lifecycle-p7-lineage-v1' as const;
export const LIFECYCLE_P7_POPULATION_VERSION = 'mn-2021-2026-p3-bills-v1' as const;
export const LIFECYCLE_P7_EXPECTED_BILLS = 31_010;
export const LIFECYCLE_P7_FROZEN_P3_CONTENT_SHA256 =
  '45030a9780ce76690ea960605385f501c24047b461a82e1368a427a7267be39d';
export const LIFECYCLE_P7_FROZEN_LINEAGE_CONTENT_SHA256 =
  'f7aa44574c109fc5a26968e0f7e5b6fd66d0ac9aa6705fdd41abb2cd798a4112';
export const LIFECYCLE_P7_FROZEN_ARTIFACT_CONTENT_SHA256 =
  'e529128ed20c7a096f5ef639407924a7526b002e9382121f97a353ec8808fc49';
export const LIFECYCLE_P7_MIN_CANONICAL_TEXT_CHARS = 500;

export type LifecycleP7Chamber = 'house' | 'senate';

export interface LifecycleP7Bill {
  billId: string;
  session: string;
  chamber: LifecycleP7Chamber;
  identifier: string;
  currentCompanionIdentifier: string | null;
  currentCompanionObservedAt: string | null;
  currentCompanionSourceUrl: string | null;
  currentCompanionSourceSha256: string | null;
}

export interface LifecycleP7ProcessReference {
  eventId: string;
  billId: string;
  occurredOn: string;
  sourceUrl: string | null;
  sourceDocumentId: string | null;
  sourceContentSha256: string | null;
  descriptions: string[];
  companionIdentifiers: string[];
}

export interface LifecycleP7BillVersion {
  billVersionId: string;
  billId: string;
  versionKey: string;
  publishedOn: string | null;
  sourceUrl: string | null;
  textSha256: string | null;
  rawText: string;
}

export type LifecycleP7EvidenceKind =
  | 'dated-substitution'
  | 'dated-explicit-companion'
  | 'dated-comparison'
  | 'dated-reference-unlineaged'
  | 'reciprocal-current-companion'
  | 'current-companion-one-sided'
  | 'current-companion-unlineaged'
  | 'exact-substantive-text';

export interface LifecycleP7EdgeEvidence {
  kind: LifecycleP7EvidenceKind;
  sourceBillIdentifier: string;
  targetBillIdentifier: string;
  occurredOn: string | null;
  sourceUrl: string | null;
  sourceDocumentId: string | null;
  sourceContentSha256: string | null;
  details: Record<string, string | number | boolean | null | string[]>;
}

export interface LifecycleP7LineageEdge {
  edgeId: string;
  session: string;
  left: Pick<LifecycleP7Bill, 'billId' | 'identifier' | 'chamber'>;
  right: Pick<LifecycleP7Bill, 'billId' | 'identifier' | 'chamber'>;
  acceptedReasons: Array<
    'dated-substitution'
    | 'dated-explicit-companion'
    | 'reciprocal-current-companion'
    | 'exact-substantive-text'
  >;
  evidence: LifecycleP7EdgeEvidence[];
}

export interface LifecycleP7LineageComponent {
  componentId: string;
  session: string;
  bills: Array<Pick<LifecycleP7Bill, 'billId' | 'identifier' | 'chamber'>>;
  edgeIds: string[];
}

export interface LifecycleP7Unresolved {
  kind:
    | 'orphan-process-reference'
    | 'orphan-current-companion'
    | 'weak-unconfirmed-pair'
    | 'ambiguous-exact-text-group'
    | 'same-chamber-exact-text-group';
  session: string;
  sourceIdentifier: string | null;
  targetIdentifier: string | null;
  identifiers: string[];
  details: Record<string, string | number | boolean | null | string[]>;
}

interface CandidatePair {
  left: LifecycleP7Bill;
  right: LifecycleP7Bill;
  evidence: LifecycleP7EdgeEvidence[];
  acceptedReasons: Set<LifecycleP7LineageEdge['acceptedReasons'][number]>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashRows(rows: readonly unknown[]): string {
  const digest = createHash('sha256');
  for (const row of rows) digest.update(JSON.stringify(row) + '\n');
  return digest.digest('hex');
}

export function normalizeLifecycleP7Identifier(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(HF|SF)\s*0*(\d+)$/i);
  return match ? match[1].toUpperCase() + String(Number(match[2])) : null;
}

function billSortKey(bill: LifecycleP7Bill): string {
  return bill.session + '|' + bill.identifier + '|' + bill.billId;
}

function orderedBills(
  left: LifecycleP7Bill,
  right: LifecycleP7Bill,
): [LifecycleP7Bill, LifecycleP7Bill] {
  return billSortKey(left).localeCompare(billSortKey(right)) <= 0
    ? [left, right]
    : [right, left];
}

function pairKey(left: LifecycleP7Bill, right: LifecycleP7Bill): string {
  const ordered = orderedBills(left, right);
  return ordered[0].billId + '|' + ordered[1].billId;
}

function evidenceSortKey(evidence: LifecycleP7EdgeEvidence): string {
  return [
    evidence.kind,
    evidence.occurredOn ?? '',
    evidence.sourceBillIdentifier,
    evidence.targetBillIdentifier,
    evidence.sourceDocumentId ?? '',
    evidence.sourceUrl ?? '',
    JSON.stringify(evidence.details),
  ].join('|');
}

function candidateFor(
  candidates: Map<string, CandidatePair>,
  left: LifecycleP7Bill,
  right: LifecycleP7Bill,
): CandidatePair {
  const key = pairKey(left, right);
  const existing = candidates.get(key);
  if (existing) return existing;
  const ordered = orderedBills(left, right);
  const created: CandidatePair = {
    left: ordered[0],
    right: ordered[1],
    evidence: [],
    acceptedReasons: new Set(),
  };
  candidates.set(key, created);
  return created;
}

function addEvidence(
  candidates: Map<string, CandidatePair>,
  left: LifecycleP7Bill,
  right: LifecycleP7Bill,
  evidence: LifecycleP7EdgeEvidence,
  acceptedReason?: LifecycleP7LineageEdge['acceptedReasons'][number],
): void {
  if (left.billId === right.billId || left.session !== right.session) return;
  const candidate = candidateFor(candidates, left, right);
  const key = evidenceSortKey(evidence);
  if (!candidate.evidence.some((item) => evidenceSortKey(item) === key)) {
    candidate.evidence.push(evidence);
  }
  if (acceptedReason) candidate.acceptedReasons.add(acceptedReason);
}

function relationshipDescriptionKinds(descriptions: readonly string[]): {
  substitution: boolean;
  explicitCompanion: boolean;
  comparison: boolean;
} {
  const text = descriptions.join(' ');
  return {
    substitution: /\bsubstitut(?:e|ed|ion|ing)\b/i.test(text),
    explicitCompanion: /\bcompanion\b/i.test(text),
    comparison: /\bcomparison\s+with\b/i.test(text),
  };
}

export function canonicalizeLifecycleP7SubstantiveText(rawText: string): string | null {
  const normalizedUnicode = rawText.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  const marker = normalizedUnicode.search(/\b(?:a bill for an act|a resolution)\b/i);
  if (marker < 0) return null;
  const substantive = normalizedUnicode.slice(marker)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return substantive.length >= LIFECYCLE_P7_MIN_CANONICAL_TEXT_CHARS ? substantive : null;
}

export function lifecycleP7SubstantiveTextSha256(rawText: string): string | null {
  const canonical = canonicalizeLifecycleP7SubstantiveText(rawText);
  return canonical ? sha256(canonical) : null;
}

function buildComponents(
  billsById: Map<string, LifecycleP7Bill>,
  edges: readonly LifecycleP7LineageEdge[],
): LifecycleP7LineageComponent[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) {
      parent.set(id, id);
      return id;
    }
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const first = leftRoot.localeCompare(rightRoot) <= 0 ? leftRoot : rightRoot;
    const second = first === leftRoot ? rightRoot : leftRoot;
    parent.set(second, first);
  };

  for (const edge of edges) {
    union(edge.left.billId, edge.right.billId);
  }

  const idsByRoot = new Map<string, Set<string>>();
  for (const edge of edges) {
    for (const id of [edge.left.billId, edge.right.billId]) {
      const root = find(id);
      const ids = idsByRoot.get(root) ?? new Set<string>();
      ids.add(id);
      idsByRoot.set(root, ids);
    }
  }

  const components: LifecycleP7LineageComponent[] = [];
  for (const ids of idsByRoot.values()) {
    const bills = [...ids]
      .map((id) => billsById.get(id))
      .filter((bill): bill is LifecycleP7Bill => Boolean(bill))
      .sort((a, b) => billSortKey(a).localeCompare(billSortKey(b)));
    if (bills.length < 2) continue;
    const billIds = new Set(bills.map((bill) => bill.billId));
    const componentEdges = edges
      .filter((edge) => billIds.has(edge.left.billId) && billIds.has(edge.right.billId))
      .map((edge) => edge.edgeId)
      .sort();
    const identity = bills.map((bill) => bill.identifier).join('|');
    components.push({
      componentId: sha256(bills[0].session + '|' + identity).slice(0, 24),
      session: bills[0].session,
      bills: bills.map((bill) => ({
        billId: bill.billId,
        identifier: bill.identifier,
        chamber: bill.chamber,
      })),
      edgeIds: componentEdges,
    });
  }
  return components.sort((a, b) =>
    (a.session + '|' + a.bills.map((bill) => bill.identifier).join('|'))
      .localeCompare(b.session + '|' + b.bills.map((bill) => bill.identifier).join('|')));
}

export function lifecycleP7DirectVehicleIds(
  billId: string,
  edges: readonly LifecycleP7LineageEdge[],
): string[] {
  const ids = new Set<string>([billId]);
  for (const edge of edges) {
    if (edge.left.billId === billId) ids.add(edge.right.billId);
    if (edge.right.billId === billId) ids.add(edge.left.billId);
  }
  return [...ids].sort();
}

export function buildLifecycleP7Lineage(input: {
  bills: readonly LifecycleP7Bill[];
  processReferences: readonly LifecycleP7ProcessReference[];
  billVersions: readonly LifecycleP7BillVersion[];
}) {
  const bills = [...input.bills].sort((a, b) => billSortKey(a).localeCompare(billSortKey(b)));
  const billsById = new Map(bills.map((bill) => [bill.billId, bill]));
  const billsBySessionIdentifier = new Map(
    bills.map((bill) => [bill.session + '|' + bill.identifier, bill]),
  );
  const candidates = new Map<string, CandidatePair>();
  const unresolved: LifecycleP7Unresolved[] = [];

  for (const reference of input.processReferences) {
    const source = billsById.get(reference.billId);
    if (!source) continue;
    const kinds = relationshipDescriptionKinds(reference.descriptions);
    for (const rawIdentifier of reference.companionIdentifiers) {
      const identifier = normalizeLifecycleP7Identifier(rawIdentifier);
      const target = identifier
        ? billsBySessionIdentifier.get(source.session + '|' + identifier)
        : undefined;
      if (!identifier || !target) {
        unresolved.push({
          kind: 'orphan-process-reference',
          session: source.session,
          sourceIdentifier: source.identifier,
          targetIdentifier: identifier,
          identifiers: identifier ? [source.identifier, identifier] : [source.identifier],
          details: {
            eventId: reference.eventId,
            occurredOn: reference.occurredOn,
            descriptions: [...reference.descriptions].sort(),
          },
        });
        continue;
      }

      const common = {
        sourceBillIdentifier: source.identifier,
        targetBillIdentifier: target.identifier,
        occurredOn: reference.occurredOn,
        sourceUrl: reference.sourceUrl,
        sourceDocumentId: reference.sourceDocumentId,
        sourceContentSha256: reference.sourceContentSha256,
        details: {
          eventId: reference.eventId,
          descriptions: [...reference.descriptions].sort(),
        },
      };
      const sourceLineaged = Boolean(
        reference.sourceUrl && reference.sourceDocumentId && reference.sourceContentSha256,
      );
      if (kinds.substitution) {
        addEvidence(candidates, source, target, sourceLineaged ? {
          kind: 'dated-substitution',
          ...common,
        } : {
          kind: 'dated-reference-unlineaged',
          ...common,
          details: {
            ...common.details,
            intendedKind: 'dated-substitution',
          },
        }, sourceLineaged ? 'dated-substitution' : undefined);
      }
      if (kinds.explicitCompanion) {
        addEvidence(candidates, source, target, sourceLineaged ? {
          kind: 'dated-explicit-companion',
          ...common,
        } : {
          kind: 'dated-reference-unlineaged',
          ...common,
          details: {
            ...common.details,
            intendedKind: 'dated-explicit-companion',
          },
        }, sourceLineaged ? 'dated-explicit-companion' : undefined);
      }
      if (kinds.comparison && !kinds.substitution && !kinds.explicitCompanion) {
        addEvidence(candidates, source, target, {
          kind: 'dated-comparison',
          ...common,
        });
      }
    }
  }

  for (const source of bills) {
    const identifier = normalizeLifecycleP7Identifier(source.currentCompanionIdentifier);
    if (!identifier) continue;
    const target = billsBySessionIdentifier.get(source.session + '|' + identifier);
    if (!target) {
      unresolved.push({
        kind: 'orphan-current-companion',
        session: source.session,
        sourceIdentifier: source.identifier,
        targetIdentifier: identifier,
        identifiers: [source.identifier, identifier],
        details: {
          observedAt: source.currentCompanionObservedAt,
        },
      });
      continue;
    }
    const reciprocal = normalizeLifecycleP7Identifier(target.currentCompanionIdentifier) === source.identifier;
    const sourceLineaged = Boolean(
      source.currentCompanionSourceUrl &&
      source.currentCompanionSourceSha256 &&
      target.currentCompanionSourceUrl &&
      target.currentCompanionSourceSha256
    );
    const acceptedReciprocal = reciprocal && sourceLineaged;
    addEvidence(candidates, source, target, {
      kind: acceptedReciprocal
        ? 'reciprocal-current-companion'
        : reciprocal
          ? 'current-companion-unlineaged'
          : 'current-companion-one-sided',
      sourceBillIdentifier: source.identifier,
      targetBillIdentifier: target.identifier,
      occurredOn: null,
      sourceUrl: source.currentCompanionSourceUrl,
      sourceDocumentId: null,
      sourceContentSha256: source.currentCompanionSourceSha256,
      details: {
        observedAt: source.currentCompanionObservedAt,
        targetSourceUrl: target.currentCompanionSourceUrl,
        targetSourceSha256: target.currentCompanionSourceSha256,
        retrospectiveRelationshipOnly: true,
        eventTimeFeatureEligible: false,
      },
    }, acceptedReciprocal ? 'reciprocal-current-companion' : undefined);
  }

  const textGroups = new Map<string, Map<string, {
    bill: LifecycleP7Bill;
    version: LifecycleP7BillVersion;
    canonicalSha256: string;
  }>>();
  let canonicalizableVersions = 0;
  let sourceLineagedVersions = 0;
  let unlineagedCanonicalVersions = 0;
  for (const version of input.billVersions) {
    const bill = billsById.get(version.billId);
    if (!bill) continue;
    const canonicalSha256 = lifecycleP7SubstantiveTextSha256(version.rawText);
    if (!canonicalSha256) continue;
    canonicalizableVersions += 1;
    if (!version.sourceUrl || !version.textSha256) {
      unlineagedCanonicalVersions += 1;
      continue;
    }
    sourceLineagedVersions += 1;
    const key = bill.session + '|' + canonicalSha256;
    const byBill = textGroups.get(key) ?? new Map();
    const current = byBill.get(bill.billId);
    const sortKey = (item: LifecycleP7BillVersion) =>
      (item.publishedOn ?? '') + '|' + item.versionKey + '|' + item.billVersionId;
    if (!current || sortKey(version).localeCompare(sortKey(current.version)) < 0) {
      byBill.set(bill.billId, { bill, version, canonicalSha256 });
    }
    textGroups.set(key, byBill);
  }

  let ambiguousExactTextGroups = 0;
  let sameChamberExactTextGroups = 0;
  for (const byBill of textGroups.values()) {
    const rows = [...byBill.values()].sort((a, b) =>
      billSortKey(a.bill).localeCompare(billSortKey(b.bill)));
    if (rows.length < 2) continue;
    if (rows.length !== 2) {
      ambiguousExactTextGroups += 1;
      unresolved.push({
        kind: 'ambiguous-exact-text-group',
        session: rows[0].bill.session,
        sourceIdentifier: null,
        targetIdentifier: null,
        identifiers: rows.map((row) => row.bill.identifier),
        details: {
          canonicalSha256: rows[0].canonicalSha256,
          bills: rows.length,
        },
      });
      continue;
    }
    if (rows[0].bill.chamber === rows[1].bill.chamber) {
      sameChamberExactTextGroups += 1;
      unresolved.push({
        kind: 'same-chamber-exact-text-group',
        session: rows[0].bill.session,
        sourceIdentifier: rows[0].bill.identifier,
        targetIdentifier: rows[1].bill.identifier,
        identifiers: rows.map((row) => row.bill.identifier),
        details: {
          canonicalSha256: rows[0].canonicalSha256,
        },
      });
      continue;
    }
    addEvidence(candidates, rows[0].bill, rows[1].bill, {
      kind: 'exact-substantive-text',
      sourceBillIdentifier: rows[0].bill.identifier,
      targetBillIdentifier: rows[1].bill.identifier,
      occurredOn: null,
      sourceUrl: rows[0].version.sourceUrl,
      sourceDocumentId: null,
      sourceContentSha256: null,
      details: {
        canonicalSha256: rows[0].canonicalSha256,
        leftVersionId: rows[0].version.billVersionId,
        leftVersionKey: rows[0].version.versionKey,
        leftPublishedOn: rows[0].version.publishedOn,
        leftStoredTextSha256: rows[0].version.textSha256,
        rightVersionId: rows[1].version.billVersionId,
        rightVersionKey: rows[1].version.versionKey,
        rightPublishedOn: rows[1].version.publishedOn,
        rightStoredTextSha256: rows[1].version.textSha256,
      },
    }, 'exact-substantive-text');
  }

  const edges: LifecycleP7LineageEdge[] = [];
  for (const candidate of candidates.values()) {
    if (candidate.acceptedReasons.size === 0) {
      unresolved.push({
        kind: 'weak-unconfirmed-pair',
        session: candidate.left.session,
        sourceIdentifier: candidate.left.identifier,
        targetIdentifier: candidate.right.identifier,
        identifiers: [candidate.left.identifier, candidate.right.identifier],
        details: {
          evidenceKinds: [...new Set(candidate.evidence.map((item) => item.kind))].sort(),
          evidenceCount: candidate.evidence.length,
        },
      });
      continue;
    }
    const evidence = [...candidate.evidence].sort((a, b) =>
      evidenceSortKey(a).localeCompare(evidenceSortKey(b)));
    const acceptedReasons = [...candidate.acceptedReasons].sort();
    const edgeIdentity = [
      candidate.left.session,
      candidate.left.identifier,
      candidate.right.identifier,
      acceptedReasons.join(','),
    ].join('|');
    edges.push({
      edgeId: sha256(edgeIdentity).slice(0, 24),
      session: candidate.left.session,
      left: {
        billId: candidate.left.billId,
        identifier: candidate.left.identifier,
        chamber: candidate.left.chamber,
      },
      right: {
        billId: candidate.right.billId,
        identifier: candidate.right.identifier,
        chamber: candidate.right.chamber,
      },
      acceptedReasons,
      evidence,
    });
  }
  edges.sort((a, b) =>
    (a.session + '|' + a.left.identifier + '|' + a.right.identifier)
      .localeCompare(b.session + '|' + b.left.identifier + '|' + b.right.identifier));

  unresolved.sort((a, b) =>
    [
      a.session,
      a.kind,
      a.sourceIdentifier ?? '',
      a.targetIdentifier ?? '',
      a.identifiers.join('|'),
      JSON.stringify(a.details),
    ].join('|').localeCompare([
      b.session,
      b.kind,
      b.sourceIdentifier ?? '',
      b.targetIdentifier ?? '',
      b.identifiers.join('|'),
      JSON.stringify(b.details),
    ].join('|')));

  const components = buildComponents(billsById, edges);
  const matchedBillIds = new Set(
    components.flatMap((component) => component.bills.map((bill) => bill.billId)),
  );
  const evidenceTypeCounts = Object.fromEntries(
    ([
      'dated-substitution',
      'dated-explicit-companion',
      'dated-comparison',
      'dated-reference-unlineaged',
      'reciprocal-current-companion',
      'current-companion-one-sided',
      'current-companion-unlineaged',
      'exact-substantive-text',
    ] as LifecycleP7EvidenceKind[]).map((kind) => [
      kind,
      edges.reduce(
        (count, edge) => count + edge.evidence.filter((item) => item.kind === kind).length,
        0,
      ),
    ]),
  );

  const edgeContentSha256 = hashRows(edges);
  const componentContentSha256 = hashRows(components);
  const unresolvedContentSha256 = hashRows(unresolved);
  const lineageContentSha256 = sha256(JSON.stringify({
    schemaVersion: LIFECYCLE_P7_LINEAGE_SCHEMA_VERSION,
    edgeContentSha256,
    componentContentSha256,
  }));
  const artifactContentSha256 = sha256(JSON.stringify({
    schemaVersion: LIFECYCLE_P7_LINEAGE_SCHEMA_VERSION,
    edgeContentSha256,
    componentContentSha256,
    unresolvedContentSha256,
  }));

  return {
    report: {
      schemaVersion: LIFECYCLE_P7_LINEAGE_SCHEMA_VERSION,
      populationVersion: LIFECYCLE_P7_POPULATION_VERSION,
      frozenUpstreamP3ContentSha256: LIFECYCLE_P7_FROZEN_P3_CONTENT_SHA256,
      contract: {
        horizon: 'same-biennium',
        graphDirection: 'undirected',
        outcomeClosure: 'direct-edges-only',
        componentsAreAuditOnly: true,
        acceptedIndependentProof: [
          'source-lineaged dated official substitution reference',
          'source-lineaged dated official action explicitly naming a companion',
          'reciprocal final official companion metadata with source URL and content hash on both sides',
          'source-lineaged unambiguous exact canonical substantive text across opposite chambers',
        ],
        insufficientAlone: [
          'comparison-with action without independent corroboration',
          'one-sided final current companion metadata',
          'reciprocal current companion metadata missing frozen source lineage',
          'dated companion/substitution reference missing frozen source lineage',
          'same-chamber exact text',
          'exact-text groups spanning more than two bills',
          'multi-edge transitive connectivity without a direct accepted edge',
        ],
        excludedFromV1: [
          'fuzzy or near-identical text thresholds',
          'omnibus section containment',
          'title similarity',
          'cross-biennium reintroduction/successor inference',
          'passage or vote outcomes',
        ],
      },
      coverage: {
        bills: bills.length,
        processReferenceEvents: input.processReferences.length,
        billVersions: input.billVersions.length,
        canonicalizableVersions,
        sourceLineagedVersions,
        unlineagedCanonicalVersions,
        edges: edges.length,
        linkedComponents: components.length,
        multiBillComponents: components.filter((component) => component.bills.length > 2).length,
        maxComponentSize: components.reduce(
          (max, component) => Math.max(max, component.bills.length),
          0,
        ),
        matchedBills: matchedBillIds.size,
        unmatchedBills: bills.length - matchedBillIds.size,
        ambiguousExactTextGroups,
        sameChamberExactTextGroups,
        unresolvedRows: unresolved.length,
        evidenceTypeCounts,
      },
      hashes: {
        edgeContentSha256,
        componentContentSha256,
        unresolvedContentSha256,
        lineageContentSha256,
        artifactContentSha256,
      },
      policy: {
        outcomeColumnsRead: false,
        voteTablesRead: false,
        strictBillNumberTargetModified: false,
        historicalRelationshipMetadataMayBeUsedOnlyForFinalLineage: true,
        historicalRelationshipMetadataEventTimeFeatureEligible: false,
        fuzzyMatchingEnabled: false,
        ambiguityForcedIntoLineage: false,
        acceptedEvidenceRequiresStoredLineage: true,
        componentsTransitiveForOutcome: false,
        servingChanged: false,
        productionAction: 'none',
        automaticPromotionAllowed: false,
        prospective2027RequiredForGoverningConfirmation: true,
      },
    },
    edges,
    components,
    unresolved,
  };
}
