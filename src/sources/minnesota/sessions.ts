// Official term dates and regular-session convening are distinct from the
// nominal biennium used to partition historical data.
// https://www.leg.mn.gov/leg/faq/faq?id=175
// https://www.house.mn.gov/hinfo/news.asp
export const MINNESOTA_2027_TERM_START = '2027-01-04';
export const MINNESOTA_2027_CONVENES_ON = '2027-01-12';

export function minnesotaLocalDate(asOf: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(asOf);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export interface MinnesotaHouseSession {
  sessionKey: string;
  slug: string;
  name: string;
  legislature: number;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

/**
 * Closed historical sessions used by retrospective ingestion/evaluation.
 * Keep future sessions out of this list so historical labelers cannot
 * accidentally treat unresolved bills as negative outcomes.
 */
export const MINNESOTA_HOUSE_HISTORICAL_SESSIONS: readonly MinnesotaHouseSession[] = [
  {
    sessionKey: '302',
    slug: '2025-2026',
    name: '94th Legislature (2025-2026)',
    legislature: 94,
    startsOn: '2025-01-01',
    endsOn: '2026-12-31',
    isCurrent: true,
  },
  {
    sessionKey: '300',
    slug: '2023-2024',
    name: '93rd Legislature (2023-2024)',
    legislature: 93,
    startsOn: '2023-01-01',
    endsOn: '2024-12-31',
    isCurrent: false,
  },
  {
    sessionKey: '257',
    slug: '2021-2022',
    name: '92nd Legislature (2021-2022)',
    legislature: 92,
    startsOn: '2021-01-01',
    endsOn: '2022-12-31',
    isCurrent: false,
  },
] as const;

/**
 * Future-session metadata is deliberately separate from the closed historical
 * corpus. The House vote-system SessionKey for the 95th Legislature is not yet
 * needed by live introduction-time forecasting, so the stable biennium slug is
 * used as the lookup alias until that source exposes its native key.
 */
export const MINNESOTA_HOUSE_UPCOMING_SESSIONS: readonly MinnesotaHouseSession[] = [
  {
    sessionKey: '2027-2028',
    slug: '2027-2028',
    name: '95th Legislature (2027-2028)',
    legislature: 95,
    startsOn: '2027-01-01',
    endsOn: '2028-12-31',
    isCurrent: false,
  },
] as const;

export const MINNESOTA_HOUSE_SUPPORTED_SESSIONS: readonly MinnesotaHouseSession[] = [
  ...MINNESOTA_HOUSE_UPCOMING_SESSIONS,
  ...MINNESOTA_HOUSE_HISTORICAL_SESSIONS,
];

export function getMinnesotaHouseSession(sessionKeyOrSlug: string): MinnesotaHouseSession {
  const session = MINNESOTA_HOUSE_SUPPORTED_SESSIONS.find(
    (candidate) => candidate.sessionKey === sessionKeyOrSlug || candidate.slug === sessionKeyOrSlug,
  );
  if (!session) throw new Error(`Unsupported Minnesota House session: ${sessionKeyOrSlug}`);
  return session;
}

/**
 * `isCurrent` on the static records documents the repository's current-era
 * baseline, but ingestion must not persist that flag forever. Derive live
 * activation eligibility from Minnesota local dates. The 2027 transition
 * follows the official term start, not the nominal January 1 partition.
 * A positive result is eligibility, not proof that roster rollover succeeded.
 */
export function isMinnesotaHouseSessionCurrent(session: MinnesotaHouseSession, asOf = new Date()): boolean {
  const date = minnesotaLocalDate(asOf);
  if (session.slug === '2025-2026') return date >= session.startsOn && date < MINNESOTA_2027_TERM_START;
  if (session.slug === '2027-2028') return date >= MINNESOTA_2027_TERM_START && date <= session.endsOn;
  return date >= session.startsOn && date <= session.endsOn;
}
