import type { RevisorBillSearchBody, RevisorBillSearchResult } from '../sources/minnesota/revisor-bill-search';

export interface ForecastTargetCorpusBill {
  identifier: string;
  hasPassageVote: boolean;
  hasKnownPassageOutcome: boolean;
  passed?: boolean;
}

export interface ForecastTargetSelectionAudit {
  session: string;
  body: RevisorBillSearchBody;
  officialBills: number;
  corpusBills: number;
  corpusCoverage: number;
  missingFromCorpus: number;
  billsWithPassageVote: number;
  billsWithoutPassageVote: number;
  knownPassageOutcomes: number;
  knownPasses: number;
  knownFailures: number;
  knownPassRate?: number;
  officialBillsWithObservedPassage: number;
  officialBillsWithoutObservedPassage: number;
  observedPassageRateAcrossOfficialUniverse: number;
}

function fileTypeForBody(body: RevisorBillSearchBody): 'HF' | 'SF' {
  return body === 'House' ? 'HF' : 'SF';
}

export function summarizeForecastTargetSelection(input: {
  session: string;
  body: RevisorBillSearchBody;
  official: readonly RevisorBillSearchResult[];
  corpus: readonly ForecastTargetCorpusBill[];
}): ForecastTargetSelectionAudit {
  const fileType = fileTypeForBody(input.body);
  const officialIds = new Set(input.official.filter((bill) => bill.fileType === fileType).map((bill) => bill.identifier));
  const corpus = input.corpus.filter((bill) => bill.identifier.startsWith(fileType));
  const corpusById = new Map(corpus.map((bill) => [bill.identifier, bill]));
  const observedOfficial = [...officialIds].flatMap((identifier) => {
    const row = corpusById.get(identifier);
    return row ? [row] : [];
  });
  const withPassage = observedOfficial.filter((bill) => bill.hasPassageVote);
  const known = observedOfficial.filter((bill) => bill.hasKnownPassageOutcome);
  const passes = known.filter((bill) => bill.passed === true).length;
  const failures = known.filter((bill) => bill.passed === false).length;
  const officialBills = officialIds.size;
  const corpusBills = observedOfficial.length;
  const observedPassage = withPassage.length;

  return {
    session: input.session,
    body: input.body,
    officialBills,
    corpusBills,
    corpusCoverage: officialBills === 0 ? 0 : corpusBills / officialBills,
    missingFromCorpus: Math.max(0, officialBills - corpusBills),
    billsWithPassageVote: observedPassage,
    billsWithoutPassageVote: corpusBills - observedPassage,
    knownPassageOutcomes: known.length,
    knownPasses: passes,
    knownFailures: failures,
    knownPassRate: known.length ? passes / known.length : undefined,
    officialBillsWithObservedPassage: observedPassage,
    officialBillsWithoutObservedPassage: Math.max(0, officialBills - observedPassage),
    observedPassageRateAcrossOfficialUniverse: officialBills === 0 ? 0 : observedPassage / officialBills,
  };
}
