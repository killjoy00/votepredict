import organizationPublicationCatalog from '../../data/sources/organization-publication-v1.json';
import { loadPublicSourceCatalog } from './source-catalog';

export const ORGANIZATION_PUBLICATION_HISTORY_VERSION =
  'organization-publication-history-v2' as const;

export type OrganizationPublicationKind =
  | 'legislative_voting_record'
  | 'legislative_scorecard_index'
  | 'legislative_recap'
  | 'legislative_advocacy'
  | 'candidate_endorsements';

export type OrganizationPublicationSector =
  | 'labor'
  | 'business'
  | 'environmental'
  | 'education'
  | 'healthcare'
  | 'local_government'
  | 'professional'
  | 'advocacy';

export interface OrganizationPublicationSeed {
  id: string;
  organization: string;
  sector: OrganizationPublicationSector;
  publicationKind: OrganizationPublicationKind;
  url: string;
  from: string;
  to: string;
}

export const ORGANIZATION_PUBLICATION_SEEDS: readonly OrganizationPublicationSeed[] =
  loadPublicSourceCatalog<OrganizationPublicationSeed>(organizationPublicationCatalog, 'organization_publication');


export interface OrganizationPublicationBatchSelection {
  batch: OrganizationPublicationSeed[];
  offset: number;
  nextOffset: number;
  targetedRetry: boolean;
  requestedSeedIds: string[];
}

export function selectOrganizationPublicationBatch({
  priorNextOffset,
  batchSize,
  requestedSeedIds = [],
  seeds = ORGANIZATION_PUBLICATION_SEEDS,
}: {
  priorNextOffset: number;
  batchSize: number;
  requestedSeedIds?: readonly string[];
  seeds?: readonly OrganizationPublicationSeed[];
}): OrganizationPublicationBatchSelection {
  validateOrganizationPublicationSeeds(seeds);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 4) {
    throw new Error(`Organization publication batch size must be an integer from 1 through 4: ${batchSize}`);
  }
  const offset = seeds.length
    ? (((priorNextOffset % seeds.length) + seeds.length) % seeds.length)
    : 0;
  const requested = requestedSeedIds.map(id => id.trim()).filter(Boolean);
  if (requested.length > 2) {
    throw new Error('Targeted organization publication retry may include at most 2 seed ids');
  }
  if (new Set(requested).size !== requested.length) {
    throw new Error('Targeted organization publication retry seed ids must be unique');
  }
  if (requested.length) {
    const byId = new Map(seeds.map(seed => [seed.id, seed]));
    const batch = requested.map(id => {
      const seed = byId.get(id);
      if (!seed) throw new Error(`Unknown organization publication retry seed id: ${id}`);
      return seed;
    });
    return {
      batch,
      offset,
      nextOffset: offset,
      targetedRetry: true,
      requestedSeedIds: requested,
    };
  }
  const batch = seeds.length <= batchSize
    ? [...seeds]
    : [...seeds.slice(offset, offset + batchSize), ...seeds.slice(0, Math.max(0, offset + batchSize - seeds.length))];
  return {
    batch,
    offset,
    nextOffset: seeds.length ? (offset + batch.length) % seeds.length : 0,
    targetedRetry: false,
    requestedSeedIds: [],
  };
}

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
