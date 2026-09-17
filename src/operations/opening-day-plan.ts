import { getMinnesotaHouseSession } from '@/sources/minnesota/sessions';

export const OPENING_DAY_SESSION = '2027-2028' as const;
export const OPENING_DAY_MIN_LRL_LEGISLATORS = 190;

export type OpeningDaySourceAssessment = {
  session: typeof OPENING_DAY_SESSION;
  legislature: number;
  startsOn: string;
  checkedAt: string;
  sessionStarted: boolean;
  lrl: {
    legislatorRefs: number;
    rosterExposed: boolean;
  };
  revisor: {
    houseBillsInFirst500: number;
    senateBillsInFirst500: number;
    billsExposed: boolean;
  };
  sourceErrors: string[];
  readyForLiveBootstrap: boolean;
  failClosed: boolean;
  blockers: string[];
};

export function assessOpeningDaySources(input: {
  checkedAt: Date;
  lrlLegislatorRefs: number;
  revisorHouseBillsInFirst500: number;
  revisorSenateBillsInFirst500: number;
  sourceErrors?: readonly string[];
}): OpeningDaySourceAssessment {
  const session = getMinnesotaHouseSession(OPENING_DAY_SESSION);
  const checkedDate = input.checkedAt.toISOString().slice(0, 10);
  const sessionStarted = checkedDate >= session.startsOn;
  const rosterExposed = input.lrlLegislatorRefs >= OPENING_DAY_MIN_LRL_LEGISLATORS;
  const billsExposed = input.revisorHouseBillsInFirst500 > 0 || input.revisorSenateBillsInFirst500 > 0;
  const sourceErrors = [...(input.sourceErrors ?? [])];
  const blockers: string[] = [];

  if (!rosterExposed) blockers.push(`Minnesota LRL has not exposed a plausible ${session.slug} roster`);
  if (!billsExposed) blockers.push(`Minnesota Revisor has not exposed ${session.slug} regular bills`);
  blockers.push(...sourceErrors);

  const readyForLiveBootstrap = rosterExposed && billsExposed && sourceErrors.length === 0;
  return {
    session: OPENING_DAY_SESSION,
    legislature: session.legislature,
    startsOn: session.startsOn,
    checkedAt: input.checkedAt.toISOString(),
    sessionStarted,
    lrl: {
      legislatorRefs: input.lrlLegislatorRefs,
      rosterExposed,
    },
    revisor: {
      houseBillsInFirst500: input.revisorHouseBillsInFirst500,
      senateBillsInFirst500: input.revisorSenateBillsInFirst500,
      billsExposed,
    },
    sourceErrors,
    readyForLiveBootstrap,
    failClosed: sessionStarted && !readyForLiveBootstrap,
    blockers,
  };
}
