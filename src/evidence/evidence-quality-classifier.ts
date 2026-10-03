import { generateText, jsonSchema, Output } from 'ai';
import {
  EVIDENCE_QUALITY_CENTRALITY,
  EVIDENCE_QUALITY_CLAIM_TYPES,
  EVIDENCE_QUALITY_CORROBORATION,
  EVIDENCE_QUALITY_EXPLICITNESS,
  EVIDENCE_QUALITY_LINKAGES,
  EVIDENCE_QUALITY_NOVELTY,
  EVIDENCE_QUALITY_SPECIFICITY,
  EVIDENCE_QUALITY_STANCES,
  buildEvidenceQualityPrompt,
  validateEvidenceQualityAnnotation,
  type EvidenceQualityAnnotation,
  type EvidenceQualityCandidateContext,
} from './evidence-quality';

export const EVIDENCE_QUALITY_CLASSIFIER_PROVIDER = 'ai-gateway-evidence-quality' as const;
export const DEFAULT_EVIDENCE_QUALITY_MODEL = 'openai/gpt-5.5' as const;

export interface EvidenceQualityClassifierResult {
  provider: typeof EVIDENCE_QUALITY_CLASSIFIER_PROVIDER;
  model: string;
  annotation: EvidenceQualityAnnotation;
  usage: unknown;
}

function candidateStringArray(values: readonly string[]) {
  return values.length > 0
    ? {
        type: 'array' as const,
        maxItems: values.length,
        items: { type: 'string' as const, enum: [...values] },
      }
    : {
        type: 'array' as const,
        maxItems: 0,
        items: { type: 'string' as const },
      };
}

function annotationSchema(input: EvidenceQualityCandidateContext) {
  const members = [...new Set(input.candidateMemberNames.map((value) => value.trim()).filter(Boolean))].sort();
  const bills = [...new Set(input.candidateBillIdentifiers.map((value) => value.trim()).filter(Boolean))].sort();

  return jsonSchema<EvidenceQualityAnnotation>({
    type: 'object',
    additionalProperties: false,
    properties: {
      document: {
        type: 'object',
        additionalProperties: false,
        properties: {
          legislativeRelevance: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
          centrality: { type: 'string', enum: [...EVIDENCE_QUALITY_CENTRALITY] },
          contentType: {
            type: 'string',
            enum: ['news_report', 'member_statement', 'campaign_position', 'organization_advocacy', 'official_reporting', 'other'],
          },
          novelty: { type: 'string', enum: [...EVIDENCE_QUALITY_NOVELTY] },
          corroboration: { type: 'string', enum: [...EVIDENCE_QUALITY_CORROBORATION] },
          topics: {
            type: 'array',
            maxItems: 12,
            items: { type: 'string', minLength: 1, maxLength: 80 },
          },
          documentConfidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'legislativeRelevance',
          'centrality',
          'contentType',
          'novelty',
          'corroboration',
          'topics',
          'documentConfidence',
        ],
      },
      claims: {
        type: 'array',
        maxItems: 16,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            memberNames: candidateStringArray(members),
            billIdentifiers: candidateStringArray(bills),
            linkage: { type: 'string', enum: [...EVIDENCE_QUALITY_LINKAGES] },
            claimType: { type: 'string', enum: [...EVIDENCE_QUALITY_CLAIM_TYPES] },
            stance: { type: 'string', enum: [...EVIDENCE_QUALITY_STANCES] },
            specificity: { type: 'string', enum: [...EVIDENCE_QUALITY_SPECIFICITY] },
            explicitness: { type: 'string', enum: [...EVIDENCE_QUALITY_EXPLICITNESS] },
            normalizedClaim: { type: 'string', minLength: 1, maxLength: 500 },
            supportingExcerpt: { type: 'string', minLength: 1, maxLength: 500 },
            extractionConfidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: [
            'memberNames',
            'billIdentifiers',
            'linkage',
            'claimType',
            'stance',
            'specificity',
            'explicitness',
            'normalizedClaim',
            'supportingExcerpt',
            'extractionConfidence',
          ],
        },
      },
      notes: {
        type: 'array',
        maxItems: 12,
        items: { type: 'string', maxLength: 400 },
      },
    },
    required: ['document', 'claims', 'notes'],
  });
}

export class EvidenceQualityClassifier {
  readonly provider = EVIDENCE_QUALITY_CLASSIFIER_PROVIDER;
  readonly model: string;

  constructor(options: { model?: string } = {}) {
    this.model = options.model
      ?? process.env.VOTEPREDICT_EVIDENCE_QUALITY_MODEL
      ?? DEFAULT_EVIDENCE_QUALITY_MODEL;
  }

  async classify(input: EvidenceQualityCandidateContext): Promise<EvidenceQualityClassifierResult> {
    const result = await generateText({
      model: this.model,
      system: [
        'You are an evidence annotation system for legislative research.',
        'Your only task is to classify what the supplied source text says.',
        'Do not forecast, predict, rank, recommend, or infer a future vote.',
        'Do not use outside knowledge or later outcomes.',
        'Source fidelity and conservative attribution are more important than producing many claims.',
      ].join(' '),
      prompt: buildEvidenceQualityPrompt(input),
      output: Output.object({
        name: 'evidence_quality_v1',
        description: 'Outcome-blind semantic annotation of one durable legislative evidence source.',
        schema: annotationSchema(input),
      }),
    });

    validateEvidenceQualityAnnotation(result.output, input);
    return {
      provider: this.provider,
      model: this.model,
      annotation: result.output,
      usage: result.totalUsage,
    };
  }
}
