export const ORGANIZATION_PUBLICATION_HISTORY_VERSION =
  'organization-publication-history-v1' as const;

export type OrganizationPublicationKind = 'legislative_voting_record' | 'legislative_scorecard_index';

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
