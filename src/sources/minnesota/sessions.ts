export interface MinnesotaHouseSession {
  sessionKey: string;
  slug: string;
  name: string;
  legislature: number;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

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

export function getMinnesotaHouseSession(sessionKey: string): MinnesotaHouseSession {
  const session = MINNESOTA_HOUSE_HISTORICAL_SESSIONS.find((candidate) => candidate.sessionKey === sessionKey);
  if (!session) throw new Error(`Unsupported Minnesota House historical session key: ${sessionKey}`);
  return session;
}
