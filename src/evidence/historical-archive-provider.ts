import type {
  DeepResearchProvider,
  DeepResearchProviderResult,
  DeepResearchRequest,
} from './provider';
import type {
  EvidenceFreshness,
  EvidenceKind,
  EvidenceRelevance,
  EvidenceSourceQuality,
  EvidenceStance,
} from './types';

export const HISTORICAL_ARCHIVE_PACKET_SCHEMA = 'historical-official-archives-v1' as const;

export type HistoricalArchiveProvenanceKind =
  | 'official_historical_record'
  | 'archive_snapshot';

export interface HistoricalArchiveSource {
  id: string;
  url: string;
  title?: string;
  publishedAt: string;
  provenanceKind: HistoricalArchiveProvenanceKind;
  contentSha256: string;
  archiveUrl?: string;
  capturedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface HistoricalArchiveEvidence {
  sourceId: string;
  kind: EvidenceKind;
  stance: EvidenceStance;
  claim: string;
  excerpt?: string;
  sourceQuality: EvidenceSourceQuality;
  relevance: EvidenceRelevance;
  freshness: EvidenceFreshness;
  confidence?: number;
  targetMembershipId?: string;
  mechanicallyActionable: boolean;
  metadata?: Record<string, unknown>;
}

export interface HistoricalArchivePacket {
  schemaVersion: typeof HISTORICAL_ARCHIVE_PACKET_SCHEMA;
  forecastId: string;
  billId?: string;
  proposalId?: string;
  chamberId: string;
  asOf: string;
  sources: HistoricalArchiveSource[];
  evidence: HistoricalArchiveEvidence[];
  metadata?: Record<string, unknown>;
}

function timestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function exactOptionalMatch(left: string | undefined, right: string | undefined): boolean {
  return left === right;
}

export function historicalArchivePacketErrors(
  packet: HistoricalArchivePacket,
  request?: DeepResearchRequest,
): string[] {
  const errors: string[] = [];
  const asOf = timestamp(packet.asOf);
  if (packet.schemaVersion !== HISTORICAL_ARCHIVE_PACKET_SCHEMA) {
    errors.push(`unsupported schema version: ${String(packet.schemaVersion)}`);
  }
  if (!packet.forecastId.trim()) errors.push('forecastId is required');
  if (!packet.chamberId.trim()) errors.push('chamberId is required');
  if (!packet.billId && !packet.proposalId) errors.push('billId or proposalId is required');
  if (packet.billId && packet.proposalId) errors.push('packet cannot target both billId and proposalId');
  if (asOf === undefined) errors.push('packet asOf is invalid');

  const sourceIds = new Set<string>();
  for (const source of packet.sources) {
    if (!source.id.trim()) {
      errors.push('source id is required');
      continue;
    }
    if (sourceIds.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    if (!isHttpsUrl(source.url)) errors.push(`source ${source.id} must use a valid https URL`);
    if (!isSha256(source.contentSha256)) errors.push(`source ${source.id} has invalid contentSha256`);
    const publishedAt = timestamp(source.publishedAt);
    if (publishedAt === undefined) {
      errors.push(`source ${source.id} has invalid publishedAt`);
    } else if (asOf !== undefined && publishedAt > asOf) {
      errors.push(`source ${source.id} was published after the replay cutoff`);
    }

    if (source.provenanceKind === 'archive_snapshot') {
      if (!isHttpsUrl(source.archiveUrl)) {
        errors.push(`archive source ${source.id} requires a valid https archiveUrl`);
      }
      const capturedAt = timestamp(source.capturedAt);
      if (capturedAt === undefined) {
        errors.push(`archive source ${source.id} requires a valid capturedAt`);
      } else if (asOf !== undefined && capturedAt > asOf) {
        errors.push(`archive source ${source.id} was captured after the replay cutoff`);
      }
    } else if (source.provenanceKind !== 'official_historical_record') {
      errors.push(`source ${source.id} has unsupported provenanceKind`);
    }
  }

  for (const evidence of packet.evidence) {
    if (!sourceIds.has(evidence.sourceId)) {
      errors.push(`evidence references missing source: ${evidence.sourceId}`);
    }
    if (!evidence.claim.trim()) errors.push(`evidence from ${evidence.sourceId} has an empty claim`);
    if (evidence.confidence !== undefined && (evidence.confidence < 0 || evidence.confidence > 1)) {
      errors.push(`evidence from ${evidence.sourceId} has confidence outside [0,1]`);
    }
    if (!evidence.targetMembershipId) {
      errors.push(`evidence from ${evidence.sourceId} must target a membership`);
    }
  }

  if (request) {
    if (packet.forecastId !== request.forecastId) errors.push('packet forecastId does not match request');
    if (packet.chamberId !== request.chamberId) errors.push('packet chamberId does not match request');
    if (!exactOptionalMatch(packet.billId, request.billId)) errors.push('packet billId does not match request');
    if (!exactOptionalMatch(packet.proposalId, request.proposalId)) errors.push('packet proposalId does not match request');
    if (packet.asOf !== request.asOf) errors.push('packet asOf does not exactly match request cutoff');
    const targetMembershipIds = new Set(request.targets.map((target) => target.membershipId));
    for (const evidence of packet.evidence) {
      if (evidence.targetMembershipId && !targetMembershipIds.has(evidence.targetMembershipId)) {
        errors.push(`evidence targets unrequested membership: ${evidence.targetMembershipId}`);
      }
    }
  }

  return errors;
}

export class HistoricalArchiveDeepResearchProvider implements DeepResearchProvider {
  readonly name = 'historical-official-archives';
  readonly version = HISTORICAL_ARCHIVE_PACKET_SCHEMA;
  private readonly packetsByForecastId: Map<string, HistoricalArchivePacket>;

  constructor(packets: readonly HistoricalArchivePacket[]) {
    this.packetsByForecastId = new Map();
    for (const packet of packets) {
      if (this.packetsByForecastId.has(packet.forecastId)) {
        throw new Error(`Duplicate historical archive packet for forecast ${packet.forecastId}`);
      }
      const errors = historicalArchivePacketErrors(packet);
      if (errors.length > 0) {
        throw new Error(`Invalid historical archive packet ${packet.forecastId}: ${errors.join('; ')}`);
      }
      this.packetsByForecastId.set(packet.forecastId, packet);
    }
  }

  async research(request: DeepResearchRequest): Promise<DeepResearchProviderResult> {
    const packet = this.packetsByForecastId.get(request.forecastId);
    if (!packet) throw new Error(`No historical archive packet for forecast ${request.forecastId}`);
    const errors = historicalArchivePacketErrors(packet, request);
    if (errors.length > 0) {
      throw new Error(`Historical archive packet/request mismatch: ${errors.join('; ')}`);
    }

    const sourceById = new Map(packet.sources.map((source) => [source.id, source]));
    const evidence = packet.evidence.map((item) => {
      const source = sourceById.get(item.sourceId);
      if (!source) throw new Error(`Missing historical archive source ${item.sourceId}`);
      return {
        sourceUrl: source.archiveUrl ?? source.url,
        publishedAt: source.publishedAt,
        kind: item.kind,
        stance: item.stance,
        claim: item.claim,
        excerpt: item.excerpt,
        sourceQuality: item.sourceQuality,
        relevance: item.relevance,
        freshness: item.freshness,
        confidence: item.confidence,
        targetMembershipId: item.targetMembershipId,
        targetBillId: packet.billId,
        metadata: {
          ...item.metadata,
          historicalReplay: true,
          historicalArchiveSchema: packet.schemaVersion,
          sourceVerified: true,
          afterAsOf: false,
          mechanicallyActionable: item.mechanicallyActionable,
          provenanceKind: source.provenanceKind,
          canonicalSourceUrl: source.url,
          archiveUrl: source.archiveUrl,
          sourcePublishedAt: source.publishedAt,
          sourceCapturedAt: source.capturedAt,
          sourceContentSha256: source.contentSha256.toLowerCase(),
        },
      };
    });

    const referencedSourceIds = new Set(packet.evidence.map((item) => item.sourceId));
    const sourceReferences = packet.sources
      .filter((source) => referencedSourceIds.has(source.id))
      .map((source) => ({
        id: source.id,
        url: source.archiveUrl ?? source.url,
        title: source.title,
      }));

    return {
      provider: this.name,
      providerVersion: this.version,
      evidence,
      sourceReferences,
      diagnostics: {
        historicalReplay: true,
        packetSchemaVersion: packet.schemaVersion,
        packetSourceCount: packet.sources.length,
        returnedSourceCount: sourceReferences.length,
        evidenceCount: evidence.length,
        mechanicallyActionableEvidenceCount: packet.evidence.filter((item) => item.mechanicallyActionable).length,
        contextOnlyEvidenceCount: packet.evidence.filter((item) => !item.mechanicallyActionable).length,
        provenanceKinds: [...new Set(packet.sources.map((source) => source.provenanceKind))].sort(),
      },
    };
  }
}
