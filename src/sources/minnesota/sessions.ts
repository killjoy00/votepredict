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
 * current-session state from the canonical biennium dates so rerunning a 2025
 * historical ingester after 2027 starts cannot reactivate the old session.
 */
export function isMinnesotaHouseSessionCurrent(session: MinnesotaHouseSession, asOf = new Date()): boolean {
  const date = asOf.toISOString().slice(0, 10);
  return date >= session.startsOn && date <= session.endsOn;
}
