export const ORGANIZATION_PUBLICATION_HISTORY_VERSION =
  'organization-publication-history-v1' as const;

export type OrganizationPublicationKind =
  | 'legislative_voting_record'
  | 'legislative_scorecard_index'
  | 'legislative_recap'
  | 'legislative_advocacy';

export interface OrganizationPublicationSeed {
  id: string;
  organization: string;
  publicationKind: OrganizationPublicationKind;
  url: string;
  from: string;
  to: string;
}

export const ORGANIZATION_PUBLICATION_SEEDS: readonly OrganizationPublicationSeed[] = [
  {
    id: 'mn-afl-cio-2024-legislative-report',
    organization: 'Minnesota AFL-CIO',
    publicationKind: 'legislative_voting_record',
    url: 'https://mnaflcio.org/news/2024-legislative-report',
    from: '20240101',
    to: '20261231',
  },
  {
    id: 'mn-farm-bureau-2024-legislative-recap',
    organization: 'Minnesota Farm Bureau',
    publicationKind: 'legislative_recap',
    url: 'https://fbmn.org/Article/2024-Legislative-Session-Recap',
    from: '20240101',
    to: '20261231',
  },
  {
    id: 'education-minnesota-2024-legislative-recap',
    organization: 'Education Minnesota',
    publicationKind: 'legislative_recap',
    url: 'https://educationminnesota.org/news/minnesota-educator/2024-legislative-session-ends-with-improvements-to-pay-pensions-health-care/',
    from: '20240101',
    to: '20261231',
  },
  {
    id: 'mn-nurses-2024-legislative-advocacy',
    organization: 'Minnesota Nurses Association',
    publicationKind: 'legislative_advocacy',
    url: 'https://mnnurses.org/issues-advocacy/advocacy/at-the-legislature/letters-of-support/mna-legislative-advocacy/',
    from: '20240101',
    to: '20261231',
  },
  {
    id: 'mn-realtors-legislative-advocacy',
    organization: 'Minnesota Realtors',
    publicationKind: 'legislative_advocacy',
    url: 'https://www.mnrealtor.com/member-services/advocacy',
    from: '20210101',
    to: '20261231',
  },
  {
    id: 'mcea-2026-legislative-recap',
    organization: 'Minnesota Center for Environmental Advocacy',
    publicationKind: 'legislative_recap',
    url: 'https://www.mncenter.org/mceas-2026-legislative-recap',
    from: '20250101',
    to: '20261231',
  },
  {
    id: 'mn-chamber-2021-22-legislative-scorecard',
    organization: 'Minnesota Chamber of Commerce',
    publicationKind: 'legislative_voting_record',
    url: 'https://www.mnchamber.com/blog/2021-22-legislative-scorecard',
    from: '20210101',
    to: '20261231',
  },
  {
    id: 'mn-chamber-2025-26-voting-record',
    organization: 'Minnesota Chamber of Commerce',
    publicationKind: 'legislative_voting_record',
    url: 'https://www.mnchamber.com/2025-2026-legislative-voting-record',
    from: '20250101',
    to: '20261231',
  },
  {
    id: 'mn-chamber-2023-voting-record',
    organization: 'Minnesota Chamber of Commerce',
    publicationKind: 'legislative_voting_record',
    url: 'https://www.mnchamber.com/blog/2023-legislative-voting-record',
    from: '20230101',
    to: '20261231',
  },
  {
    id: 'mn-chamber-2023-24-voting-record',
    organization: 'Minnesota Chamber of Commerce',
    publicationKind: 'legislative_voting_record',
    url: 'https://www.mnchamber.com/2023-24-legislative-voting-record',
    from: '20230101',
    to: '20261231',
  },
  {
    id: 'afscme-mn-legislative-scorecards',
    organization: 'AFSCME Minnesota Council 5',
    publicationKind: 'legislative_scorecard_index',
    url: 'https://www.afscmemn.org/afscme-legislative-scorecard',
    from: '20210101',
    to: '20261231',
  },
  {
    id: 'abc-mnnd-legislative-scorecard',
    organization: 'Associated Builders and Contractors Minnesota/North Dakota',
    publicationKind: 'legislative_scorecard_index',
    url: 'https://www.mnabc.com/Government-Advocacy/Legislative-Scorecard',
    from: '20210101',
    to: '20261231',
  },
] as const;

export function validateOrganizationPublicationSeeds(
  seeds: readonly OrganizationPublicationSeed[] = ORGANIZATION_PUBLICATION_SEEDS,
): void {
  const ids = new Set<string>();
  for (const seed of seeds) {
    if (!seed.id.trim() || ids.has(seed.id)) throw new Error(`Duplicate or empty organization publication seed id: ${seed.id}`);
    ids.add(seed.id);
    const url = new URL(seed.url);
    if (url.protocol !== 'https:') throw new Error(`Organization publication seed must use HTTPS: ${seed.id}`);
    if (!/^\d{8}$/.test(seed.from) || !/^\d{8}$/.test(seed.to) || seed.from > seed.to) {
      throw new Error(`Invalid archive window for organization publication seed: ${seed.id}`);
    }
  }
}
