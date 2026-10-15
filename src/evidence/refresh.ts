/**
 * The external entrypoint for the four distinct evidence refresh jobs.
 *
 * The jobs have different source families, run ledgers, and side effects; do not
 * combine their implementations simply because they all refresh evidence.
 * Lazy loading preserves the original per-route module initialization.
 */
import type { PublicEvidenceRefreshOptions } from './public-evidence-refresh';
import type { StructuredPublicRefreshOptions } from './structured-public-refresh';

export interface EvidenceRefreshDrivers<Production, Public, Structured, Finance> {
  production: () => Promise<Production>;
  public: (options: PublicEvidenceRefreshOptions) => Promise<Public>;
  structured: (options: StructuredPublicRefreshOptions) => Promise<Structured>;
  campaignFinance: () => Promise<Finance>;
}

/** Dependency injection permits fixture-in/record-out tests without any DB calls. */
export function createEvidenceRefreshRunners<Production, Public, Structured, Finance>(
  drivers: EvidenceRefreshDrivers<Production, Public, Structured, Finance>,
) {
  return {
    production: () => drivers.production(),
    public: (options: PublicEvidenceRefreshOptions = {}) => drivers.public(options),
    structured: (options: StructuredPublicRefreshOptions = {}) => drivers.structured(options),
    campaignFinance: () => drivers.campaignFinance(),
  };
}

/**
 * Route-level typed interface. Public refresh continues to invoke structured
 * and CFB work using its existing sequencing, cutoff, and error-handling rules.
 */
export const evidenceRefresh = createEvidenceRefreshRunners({
  production: async () =>
    (await import('./production-refresh')).runProductionEvidenceRefresh(),
  public: async (options) =>
    (await import('./public-evidence-refresh')).runPublicEvidenceRefresh(options),
  structured: async (options) =>
    (await import('./structured-public-refresh')).runStructuredPublicRefresh(options),
  campaignFinance: async () =>
    (await import('./live-campaign-finance-refresh')).runLiveCampaignFinanceRefresh(),
});
