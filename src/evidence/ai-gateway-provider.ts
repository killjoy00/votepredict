import { gateway, generateText, jsonSchema, Output, stepCountIs } from 'ai';
import type { DeepResearchProvider, DeepResearchProviderResult, DeepResearchRequest, DeepResearchSourceReference } from './provider';
import type { EvidenceDraft, EvidenceFreshness, EvidenceKind, EvidenceRelevance, EvidenceSourceQuality, EvidenceStance } from './types';

export const AI_GATEWAY_RESEARCH_PROVIDER_VERSION = 'ai-gateway-web-v1';
export const DEFAULT_DEEP_RESEARCH_MODEL = 'openai/gpt-5.5';

interface GatewayEvidenceItem {
  sourceUrl: string;
  publishedAt: string | null;
  kind: EvidenceKind;
  stance: EvidenceStance;
  claim: string;
  excerpt: string | null;
  sourceQuality: EvidenceSourceQuality;
  relevance: EvidenceRelevance;
  freshness: EvidenceFreshness;
  confidence: number;
  targetMembershipId: string | null;
  targetBillId: string | null;
}

interface GatewayResearchOutput {
  evidence: GatewayEvidenceItem[];
  notes: string[];
}

export interface AiGatewayDeepResearchProviderOptions {
  model?: string;
  maxSteps?: number;
}

function outputSchema(targetMembershipIds: readonly string[]) {
  return jsonSchema<GatewayResearchOutput>({
    type: 'object',
    additionalProperties: false,
    properties: {
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sourceUrl: { type: 'string' },
            publishedAt: { type: ['string', 'null'] },
            kind: { type: 'string', enum: ['direct_statement', 'related_statement', 'fact', 'context', 'inference'] },
            stance: { type: 'string', enum: ['supports', 'opposes', 'mixed', 'neutral', 'unclear'] },
            claim: { type: 'string', minLength: 1, maxLength: 600 },
            excerpt: { type: ['string', 'null'], maxLength: 280 },
            sourceQuality: { type: 'string', enum: ['official', 'member_primary', 'reputable_secondary', 'other', 'unknown'] },
            relevance: { type: 'string', enum: ['direct', 'high', 'medium', 'low'] },
            freshness: { type: 'string', enum: ['current', 'recent', 'stale', 'unknown'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            targetMembershipId: targetMembershipIds.length > 0
              ? { type: ['string', 'null'], enum: [...targetMembershipIds, null] }
              : { type: 'null' },
            targetBillId: { type: ['string', 'null'] },
          },
          required: ['sourceUrl', 'publishedAt', 'kind', 'stance', 'claim', 'excerpt', 'sourceQuality', 'relevance', 'freshness', 'confidence', 'targetMembershipId', 'targetBillId'],
        },
      },
      notes: { type: 'array', items: { type: 'string', maxLength: 400 } },
    },
    required: ['evidence', 'notes'],
  });
}

function buildPrompt(request: DeepResearchRequest): string {
  if (!request.subject?.title) throw new Error('Gateway Deep research requires a searchable bill/proposal subject title');
  const unnamed = request.targets.filter((target) => !target.memberName);
  if (unnamed.length > 0) throw new Error(`Gateway Deep research requires member names for all targets; missing ${unnamed.length}`);

  const targets = request.targets.map((target) => ({
    membershipId: target.membershipId,
    memberName: target.memberName,
    party: target.party,
    district: target.district,
    researchRationale: target.rationale,
  }));

  return [
    'Research current public evidence relevant to a legislative vote forecast.',
    `Hard as-of cutoff: ${request.asOf}. Do not use material published after this timestamp.`,
    '',
    'Target measure:',
    JSON.stringify(request.subject, null, 2),
    '',
    'Target legislators:',
    JSON.stringify(targets, null, 2),
    '',
    'Research rules:',
    '- Search the public web. Prefer official legislative records, a legislator’s own official statements, direct interviews/transcripts, then reputable reporting.',
    '- Research the named target legislators rather than the entire chamber. Bill-level factual context may also be returned when it materially helps interpret member evidence.',
    '- Do not infer a member position from party alone, ideology alone, endorsements alone, or the pre-research forecast.',
    '- Use direct_statement only for an attributable statement or commitment by the target member. Use related_statement when the statement concerns the substantive policy but not an explicit commitment on this exact vote.',
    '- A source URL must be a real URL found during research. Never invent a URL or citation.',
    '- Keep claims atomic and factual. Separate facts/context from model inference.',
    '- stance must be neutral or unclear when the source does not actually establish support/opposition.',
    '- confidence describes extraction/attribution confidence, not the probability the member will vote Yes.',
    '- Keep excerpts short (maximum 280 characters) and only as much as needed for provenance.',
    '- If sources conflict, return both items; do not silently pick a winner.',
    '- Prefer newer evidence, but retain older still-relevant direct statements when needed to expose a change or contradiction.',
    '- Return no evidence item when you cannot tie the claim to a real source.',
  ].join('\n');
}

function asOfTimestamp(request: DeepResearchRequest): number {
  const timestamp = Date.parse(request.asOf);
  if (!Number.isFinite(timestamp)) throw new Error('Deep research asOf must be a valid date/time');
  return timestamp;
}

export class AiGatewayDeepResearchProvider implements DeepResearchProvider {
  readonly name = 'ai-gateway-web';
  readonly version = AI_GATEWAY_RESEARCH_PROVIDER_VERSION;
  private readonly model: string;
  private readonly maxSteps: number;

  constructor(options: AiGatewayDeepResearchProviderOptions = {}) {
    this.model = options.model ?? process.env.VOTEPREDICT_DEEP_MODEL ?? DEFAULT_DEEP_RESEARCH_MODEL;
    this.maxSteps = options.maxSteps ?? 8;
    if (!Number.isInteger(this.maxSteps) || this.maxSteps < 2) throw new Error('maxSteps must be an integer >= 2');
  }

  async research(request: DeepResearchRequest): Promise<DeepResearchProviderResult> {
    const cutoff = asOfTimestamp(request);
    const result = await generateText({
      model: this.model,
      system: 'You are a legislative evidence researcher. Source fidelity is more important than producing a large number of findings.',
      prompt: buildPrompt(request),
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          country: 'US',
          maxResults: 8,
          searchLanguageFilter: ['en'],
        }),
      },
      stopWhen: stepCountIs(this.maxSteps),
      output: Output.object({
        name: 'legislative_evidence',
        description: 'Source-backed evidence for targeted legislative vote research.',
        schema: outputSchema(request.targets.map((target) => target.membershipId)),
      }),
    });

    const sourceReferences: DeepResearchSourceReference[] = result.sources.flatMap((source) => source.sourceType === 'url'
      ? [{ id: source.id, url: source.url, title: source.title }]
      : []);
    const sourceByUrl = new Map(sourceReferences.map((source) => [source.url, source]));

    const evidence: EvidenceDraft[] = result.output.evidence.map((item) => {
      const source = sourceByUrl.get(item.sourceUrl);
      const publishedTimestamp = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN;
      const publishedAtInvalid = Boolean(item.publishedAt) && !Number.isFinite(publishedTimestamp);
      const afterAsOf = Number.isFinite(publishedTimestamp) && publishedTimestamp > cutoff;
      return {
        sourceUrl: item.sourceUrl,
        publishedAt: publishedAtInvalid ? undefined : item.publishedAt ?? undefined,
        kind: item.kind,
        stance: item.stance,
        claim: item.claim,
        excerpt: item.excerpt ?? undefined,
        sourceQuality: item.sourceQuality,
        relevance: item.relevance,
        freshness: item.freshness,
        confidence: item.confidence,
        targetMembershipId: item.targetMembershipId ?? undefined,
        targetBillId: request.billId ?? item.targetBillId ?? undefined,
        metadata: {
          researchProvider: this.name,
          researchProviderVersion: this.version,
          model: this.model,
          sourceVerified: Boolean(source),
          sourceId: source?.id,
          sourceTitle: source?.title,
          afterAsOf,
          publishedAtInvalid,
        },
      };
    });

    return {
      provider: this.name,
      providerVersion: this.version,
      evidence,
      sourceReferences,
      diagnostics: {
        model: this.model,
        steps: result.steps.length,
        sourceCount: sourceReferences.length,
        verifiedEvidence: evidence.filter((item) => item.metadata?.sourceVerified === true).length,
        afterAsOfEvidence: evidence.filter((item) => item.metadata?.afterAsOf === true).length,
        notes: result.output.notes,
        totalUsage: result.totalUsage,
      },
    };
  }
}
