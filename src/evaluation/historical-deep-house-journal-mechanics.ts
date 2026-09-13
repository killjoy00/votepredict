import { historicalDeepExpansionHtmlText } from './historical-deep-expansion-source-bundle';
import type {
  HistoricalDeepHouseJournalCollectedSource,
  HistoricalDeepHouseJournalSourceBundle,
  HistoricalDeepHouseJournalSourceMatch,
} from './historical-deep-house-journal-source-bundle';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCHEMA = 'historical-deep-house-journal-mechanics-v1' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_PARSER = 'deterministic-house-journal-mechanics-v1' as const;

export type HistoricalDeepHouseJournalMechanic =
  | 'introduced_and_referred'
  | 'committee_advances_to_general_register'
  | 'committee_routes_for_additional_review'
  | 'second_reading'
  | 'calendar_designation'
  | 'companion_substitution'
  | 'conference_committee_appointment'
  | 'conference_report_received'
  | 'interchamber_amendment_message'
  | 'reported_to_house'
  | 'laid_on_table'
  | 'reaches_final_passage_stage'
  | 'author_added';

export type HistoricalDeepHouseJournalMechanicDirection =
  | 'advances_process'
  | 'continues_process'
  | 'defers_or_impedes'
  | 'administrative_only';

export type HistoricalDeepHouseJournalExtractionRule =
  | 'introduced-first-reading-referral'
  | 'standing-committee-general-register-report'
  | 'standing-committee-rereferral-report'
  | 'direct-second-reading'
  | 'rules-calendar-designation-list'
  | 'chief-clerk-companion-substitution'
  | 'conference-committee-appointment'
  | 'conference-report-heading'
  | 'interchamber-amendment-message'
  | 'direct-reported-to-house'
  | 'direct-laid-on-table-motion'
  | 'direct-third-reading-final-passage-stage'
  | 'direct-author-addition';

export interface HistoricalDeepHouseJournalMechanicsObservation {
  id: string;
  stableKey: string;
  caseKey: string;
  voteEventId: string;
  externalKey: string;
  identifier: string;
  occurredOn: string;
  tranche: HistoricalDeepHouseJournalSourceMatch['tranche'];
  sourceId: string;
  sourceUrl: string;
  sourceContentSha256: string;
  journalDate: string;
  legislativeDay: number;
  mechanic: HistoricalDeepHouseJournalMechanic;
  direction: HistoricalDeepHouseJournalMechanicDirection;
  extractionRule: HistoricalDeepHouseJournalExtractionRule;
  evidenceText: string;
  mechanicallyActionable: false;
  finalPassageInference: 'none';
}

export interface HistoricalDeepHouseJournalMechanicsArtifact {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    parser: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_PARSER;
    inputSourceSchema: 'historical-deep-house-journal-source-bundle-v1';
    inputSourcePolicy: 'house-journal-archive-enumeration-v1';
    sourceArtifactId: number;
    sourceArtifactDigest: string;
    sourceHeadSha: string;
    outcomeUse: 'none';
    holdoutUse: 'none';
    probabilityAction: 'none';
    designGuard: string;
  };
  input: {
    selectedCases: number;
    sourcePages: number;
    sourceCasePairs: number;
  };
  summary: {
    observations: number;
    casesWithMechanics: number;
    casesWithoutMechanics: number;
    sourcePagesWithMechanics: number;
    sourceCasePairsWithMechanics: number;
    unclassifiedSourceCasePairs: number;
    mechanics: Record<HistoricalDeepHouseJournalMechanic, number>;
    directions: Record<HistoricalDeepHouseJournalMechanicDirection, number>;
  };
  cases: Array<{
    stableKey: string;
    caseKey: string;
    voteEventId: string;
    externalKey: string;
    identifier: string;
    session: string;
    occurredOn: string;
    tranche: HistoricalDeepHouseJournalSourceMatch['tranche'];
    sourceIds: string[];
    mechanicObservationIds: string[];
    mechanics: HistoricalDeepHouseJournalMechanic[];
  }>;
  observations: HistoricalDeepHouseJournalMechanicsObservation[];
}

const MECHANIC_ORDER: HistoricalDeepHouseJournalMechanic[] = [
  'introduced_and_referred',
  'committee_advances_to_general_register',
  'committee_routes_for_additional_review',
  'second_reading',
  'calendar_designation',
  'companion_substitution',
  'conference_committee_appointment',
  'conference_report_received',
  'interchamber_amendment_message',
  'reported_to_house',
  'laid_on_table',
  'reaches_final_passage_stage',
  'author_added',
];

const DIRECTION_ORDER: HistoricalDeepHouseJournalMechanicDirection[] = [
  'advances_process',
  'continues_process',
  'defers_or_impedes',
  'administrative_only',
];

const MECHANIC_DIRECTION: Record<HistoricalDeepHouseJournalMechanic, HistoricalDeepHouseJournalMechanicDirection> = {
  introduced_and_referred: 'continues_process',
  committee_advances_to_general_register: 'advances_process',
  committee_routes_for_additional_review: 'continues_process',
  second_reading: 'advances_process',
  calendar_designation: 'advances_process',
  companion_substitution: 'advances_process',
  conference_committee_appointment: 'continues_process',
  conference_report_received: 'advances_process',
  interchamber_amendment_message: 'continues_process',
  reported_to_house: 'advances_process',
  laid_on_table: 'defers_or_impedes',
  reaches_final_passage_stage: 'advances_process',
  author_added: 'administrative_only',
};

interface ExtractedMechanic {
  mechanic: HistoricalDeepHouseJournalMechanic;
  extractionRule: HistoricalDeepHouseJournalExtractionRule;
  evidenceText: string;
}

function identifierPattern(identifier: string): string {
  const compact = identifier.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^(HF|SF)(\d+)$/);
  if (!match) throw new Error(`Unsupported House Journal bill identifier ${identifier}`);
  const prefix = match[1];
  return `\\b${prefix[0]}\\.?\\s*${prefix[1]}\\.?\\s*(?:No\\.?\\s*)?${match[2]}\\b`;
}

function compactEvidence(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 1_400) return normalized;
  return `${normalized.slice(0, 680)} … ${normalized.slice(-680)}`;
}

function firstMatch(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match ? compactEvidence(match[0]) : undefined;
}

function committeeRecommendationEvidence(
  text: string,
  billPattern: string,
  recommendation: RegExp,
): string | undefined {
  const startPattern = /\bfrom the Committee on [^:]{1,240} to which was referred:/gi;
  const starts = [...text.matchAll(startPattern)];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index ?? 0;
    const end = starts[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    if (!new RegExp(`to which was referred:\\s*${billPattern},\\s*A bill\\b`, 'i').test(block)) continue;
    const match = block.match(recommendation);
    if (!match) continue;
    const matchEnd = (match.index ?? 0) + match[0].length;
    return compactEvidence(block.slice(0, matchEnd));
  }
  return undefined;
}

function billBlockActionEvidence(
  text: string,
  billPattern: string,
  action: RegExp,
): string | undefined {
  const startPattern = /\b(?:H|S)\.?\s*F\.?\s*(?:No\.?\s*)?\d+\b,\s*A bill\b/gi;
  const starts = [...text.matchAll(startPattern)];
  for (let index = 0; index < starts.length; index += 1) {
    const startMatch = starts[index];
    if (!new RegExp(`^${billPattern},\\s*A bill\\b`, 'i').test(startMatch[0])) continue;
    const start = startMatch.index ?? 0;
    const end = starts[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    const match = block.match(action);
    if (!match) continue;
    const matchEnd = (match.index ?? 0) + match[0].length;
    return compactEvidence(block.slice(0, matchEnd));
  }
  return undefined;
}

function calendarDesignationEvidence(text: string, billPattern: string): string | undefined {
  const lead = /designated the following bills? to be placed on the Calendar for the Day for [A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4} and established a prefiling requirement for amendments offered to the following bills?:/gi;
  const stop = /\b(?:ANNOUNCEMENTS? BY THE SPEAKER|ANNOUNCEMENT BY THE SPEAKER|CALENDAR FOR THE DAY|MESSAGES FROM THE SENATE|MOTIONS AND RESOLUTIONS|REPORTS OF CHIEF CLERK|REPORTS OF STANDING COMMITTEES|SECOND READING OF|THIRD READING OF|RECESS RECONVENED)\b/i;
  for (const match of text.matchAll(lead)) {
    const start = match.index ?? 0;
    const bodyStart = start + match[0].length;
    const tail = text.slice(bodyStart, Math.min(text.length, bodyStart + 1_600));
    const stopMatch = tail.match(stop);
    const listText = stopMatch?.index === undefined ? tail.slice(0, 1_000) : tail.slice(0, stopMatch.index);
    const billMatch = listText.match(new RegExp(billPattern, 'i'));
    if (!billMatch) continue;
    const billEnd = (billMatch.index ?? 0) + billMatch[0].length;
    return compactEvidence(`${match[0]} ${listText.slice(0, Math.min(listText.length, billEnd + 100))}`);
  }
  return undefined;
}

function extractCaseMechanics(
  text: string,
  identifier: string,
): ExtractedMechanic[] {
  const bill = identifierPattern(identifier);
  const genericBill = '(?:H|S)\\.?\\s*(?:F)\\.?\\s*(?:No\\.?\\s*)?\\d+';
  const extracted: ExtractedMechanic[] = [];

  const add = (
    mechanic: HistoricalDeepHouseJournalMechanic,
    extractionRule: HistoricalDeepHouseJournalExtractionRule,
    evidenceText: string | undefined,
  ): void => {
    if (!evidenceText) return;
    if (extracted.some((item) => item.mechanic === mechanic)) return;
    extracted.push({ mechanic, extractionRule, evidenceText });
  };

  add(
    'introduced_and_referred',
    'introduced-first-reading-referral',
    billBlockActionEvidence(
      text,
      bill,
      /The bill was read for the first time and referred to the Committee on [^.]+\./i,
    ),
  );
  add(
    'committee_advances_to_general_register',
    'standing-committee-general-register-report',
    committeeRecommendationEvidence(
      text,
      bill,
      /with the recommendation that(?: when so amended)? the bill be placed on the General Register\./i,
    ),
  );
  add(
    'committee_routes_for_additional_review',
    'standing-committee-rereferral-report',
    committeeRecommendationEvidence(
      text,
      bill,
      /with the recommendation that(?: when so amended)? the bill be re-referred to the Committee on [^.]+\./i,
    ),
  );
  add(
    'second_reading',
    'direct-second-reading',
    firstMatch(text, new RegExp(`${bill}\\s+was read for the second time\\.`, 'i')),
  );
  add(
    'calendar_designation',
    'rules-calendar-designation-list',
    calendarDesignationEvidence(text, bill),
  );
  add(
    'companion_substitution',
    'chief-clerk-companion-substitution',
    firstMatch(text, new RegExp(`${bill}\\s+and\\s+${genericBill},\\s+which had been referred to the Chief Clerk for comparison,[\\s\\S]{0,500}?moved that\\s+${bill}\\s+be substituted for\\s+${genericBill}[\\s\\S]{0,260}?The motion prevailed\\.`, 'i')),
  );
  add(
    'conference_committee_appointment',
    'conference-committee-appointment',
    firstMatch(text, new RegExp(`The Speaker announced the appointment of the following members of the House to a Conference Committee on\\s+${bill}`, 'i')),
  );
  add(
    'conference_report_received',
    'conference-report-heading',
    firstMatch(text, new RegExp(`CONFERENCE COMMITTEE REPORT ON\\s+${bill}`, 'i')),
  );
  add(
    'interchamber_amendment_message',
    'interchamber-amendment-message',
    firstMatch(text, new RegExp(`(?:requesting concurrence by the House to amendments adopted by the Senate to the following House File:|Senate (?:has )?refused to concur[\\s\\S]{0,220}?|Senate amendments[\\s\\S]{0,220}?)\\s*${bill}`, 'i')),
  );
  add(
    'reported_to_house',
    'direct-reported-to-house',
    firstMatch(text, new RegExp(`${bill}\\s+was reported to the House\\.`, 'i')),
  );
  add(
    'laid_on_table',
    'direct-laid-on-table-motion',
    firstMatch(text, new RegExp(`moved that\\s+${bill}\\s+be laid on the table\\.`, 'i')),
  );
  add(
    'reaches_final_passage_stage',
    'direct-third-reading-final-passage-stage',
    billBlockActionEvidence(
      text,
      bill,
      /The bill was read for the third time(?:, as amended)?,?\s+and placed upon its final passage/i,
    ),
  );
  add(
    'author_added',
    'direct-author-addition',
    firstMatch(text, new RegExp(`[^.!?]{0,260}\\b(?:name|names)\\b[^.!?]{0,260}\\badded as (?:an )?author\\b[^.!?]{0,180}${bill}`, 'i')),
  );

  return MECHANIC_ORDER.flatMap((mechanic) => extracted.filter((item) => item.mechanic === mechanic));
}

function verifySourceIntegrity(source: HistoricalDeepHouseJournalCollectedSource): void {
  if (source.sourceClass !== 'house_journal_record') {
    throw new Error(`Unsupported House Journal source class ${String(source.sourceClass)}`);
  }
  if (!/^[a-f0-9]{64}$/.test(source.contentSha256)) {
    throw new Error(`House Journal source ${source.id} has invalid raw-byte SHA-256 ${source.contentSha256}`);
  }
  if (!source.content.trim()) {
    throw new Error(`House Journal source ${source.id} has empty frozen content`);
  }
  for (const match of source.matchedCases) {
    if (source.journalDate >= match.occurredOn) {
      throw new Error(`House Journal source ${source.id} is not strictly pre-vote for ${match.stableKey}`);
    }
  }
}

function countMechanics(
  observations: readonly HistoricalDeepHouseJournalMechanicsObservation[],
): Record<HistoricalDeepHouseJournalMechanic, number> {
  return Object.fromEntries(MECHANIC_ORDER.map((mechanic) => [
    mechanic,
    observations.filter((item) => item.mechanic === mechanic).length,
  ])) as Record<HistoricalDeepHouseJournalMechanic, number>;
}

function countDirections(
  observations: readonly HistoricalDeepHouseJournalMechanicsObservation[],
): Record<HistoricalDeepHouseJournalMechanicDirection, number> {
  return Object.fromEntries(DIRECTION_ORDER.map((direction) => [
    direction,
    observations.filter((item) => item.direction === direction).length,
  ])) as Record<HistoricalDeepHouseJournalMechanicDirection, number>;
}

export function buildHistoricalDeepHouseJournalMechanicsArtifact(input: {
  sourceBundle: HistoricalDeepHouseJournalSourceBundle;
  sourceArtifactId: number;
  sourceArtifactDigest: string;
  sourceHeadSha: string;
  generatedAt?: string;
}): HistoricalDeepHouseJournalMechanicsArtifact {
  const { sourceBundle } = input;
  if (sourceBundle.schemaVersion !== 'historical-deep-house-journal-source-bundle-v1') {
    throw new Error(`Unsupported House Journal source schema ${String(sourceBundle.schemaVersion)}`);
  }
  if (sourceBundle.metadata.sourcePolicy !== 'house-journal-archive-enumeration-v1') {
    throw new Error(`Unsupported House Journal source policy ${String(sourceBundle.metadata.sourcePolicy)}`);
  }
  if (sourceBundle.metadata.codeSha !== input.sourceHeadSha) {
    throw new Error(`House Journal source head mismatch: expected ${input.sourceHeadSha}, got ${sourceBundle.metadata.codeSha ?? 'null'}`);
  }
  if (sourceBundle.summary.casesWithSources !== sourceBundle.cases.length) {
    throw new Error(`House Journal source coverage is incomplete: ${sourceBundle.summary.casesWithSources}/${sourceBundle.cases.length}`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(input.sourceArtifactDigest)) {
    throw new Error(`Invalid source artifact digest ${input.sourceArtifactDigest}`);
  }

  const observations: HistoricalDeepHouseJournalMechanicsObservation[] = [];
  const classifiedPairs = new Set<string>();

  for (const source of sourceBundle.sources) {
    verifySourceIntegrity(source);
    const text = historicalDeepExpansionHtmlText(source.content);
    for (const match of source.matchedCases) {
      const pairKey = `${source.id}|${match.stableKey}`;
      const extracted = extractCaseMechanics(text, match.identifier);
      if (extracted.length > 0) classifiedPairs.add(pairKey);
      for (const item of extracted) {
        const id = `${match.stableKey}|${source.id}|${item.mechanic}`;
        observations.push({
          id,
          stableKey: match.stableKey,
          caseKey: match.caseKey,
          voteEventId: match.voteEventId,
          externalKey: match.externalKey,
          identifier: match.identifier,
          occurredOn: match.occurredOn,
          tranche: match.tranche,
          sourceId: source.id,
          sourceUrl: source.finalUrl,
          sourceContentSha256: source.contentSha256,
          journalDate: source.journalDate,
          legislativeDay: source.legislativeDay,
          mechanic: item.mechanic,
          direction: MECHANIC_DIRECTION[item.mechanic],
          extractionRule: item.extractionRule,
          evidenceText: item.evidenceText,
          mechanicallyActionable: false,
          finalPassageInference: 'none',
        });
      }
    }
  }

  observations.sort((left, right) => left.stableKey.localeCompare(right.stableKey)
    || left.journalDate.localeCompare(right.journalDate)
    || MECHANIC_ORDER.indexOf(left.mechanic) - MECHANIC_ORDER.indexOf(right.mechanic)
    || left.sourceId.localeCompare(right.sourceId));

  const observationIds = new Set(observations.map((item) => item.id));
  if (observationIds.size !== observations.length) {
    throw new Error('House Journal mechanic observation ids are not unique');
  }

  const caseObservations = new Map<string, HistoricalDeepHouseJournalMechanicsObservation[]>();
  for (const observation of observations) {
    const values = caseObservations.get(observation.stableKey) ?? [];
    values.push(observation);
    caseObservations.set(observation.stableKey, values);
  }

  const cases = sourceBundle.cases.map((item) => {
    const values = caseObservations.get(item.stableKey) ?? [];
    return {
      stableKey: item.stableKey,
      caseKey: item.caseKey,
      voteEventId: item.voteEventId,
      externalKey: item.externalKey,
      identifier: item.identifier,
      session: item.session,
      occurredOn: item.occurredOn,
      tranche: item.tranche,
      sourceIds: item.sourceIds,
      mechanicObservationIds: values.map((value) => value.id),
      mechanics: MECHANIC_ORDER.filter((mechanic) => values.some((value) => value.mechanic === mechanic)),
    };
  });

  const sourcePagesWithMechanics = new Set(observations.map((item) => item.sourceId)).size;
  const sourceCasePairs = sourceBundle.sources.reduce((sum, source) => sum + source.matchedCases.length, 0);
  const casesWithMechanics = cases.filter((item) => item.mechanics.length > 0).length;

  return {
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    purpose: 'development-only, outcome-blind extraction of deterministic procedural mechanics from the already-frozen official Minnesota House Journal source bundle; inventories process state without reading target outcomes, assigning evidence weights, or changing any forecast',
    metadata: {
      parser: HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_PARSER,
      inputSourceSchema: 'historical-deep-house-journal-source-bundle-v1',
      inputSourcePolicy: 'house-journal-archive-enumeration-v1',
      sourceArtifactId: input.sourceArtifactId,
      sourceArtifactDigest: input.sourceArtifactDigest,
      sourceHeadSha: input.sourceHeadSha,
      outcomeUse: 'none',
      holdoutUse: 'none',
      probabilityAction: 'none',
      designGuard: 'The workflow SHA-256 verifies the immutable source artifact before classification, while each source retains its original raw-byte SHA-256 provenance from collection. Only deterministic phrases in those frozen pre-vote Journal pages are classified. Committee and first/third-reading mechanics are bounded to structural report or bill blocks; Calendar lists are section-bounded; final-passage-stage extraction records only that the target bill reached the procedural stage and never reads the ensuing roll-call result. Every extracted mechanic remains mechanicallyActionable=false and finalPassageInference=none.',
    },
    input: {
      selectedCases: sourceBundle.cases.length,
      sourcePages: sourceBundle.sources.length,
      sourceCasePairs,
    },
    summary: {
      observations: observations.length,
      casesWithMechanics,
      casesWithoutMechanics: cases.length - casesWithMechanics,
      sourcePagesWithMechanics,
      sourceCasePairsWithMechanics: classifiedPairs.size,
      unclassifiedSourceCasePairs: sourceCasePairs - classifiedPairs.size,
      mechanics: countMechanics(observations),
      directions: countDirections(observations),
    },
    cases,
    observations,
  };
}
