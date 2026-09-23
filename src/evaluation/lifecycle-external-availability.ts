import { createHash } from 'node:crypto';

export const LIFECYCLE_EXTERNAL_AVAILABILITY_SCHEMA_VERSION =
  'lifecycle-external-availability-v1' as const;

export const LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES = [
  'official_bill_summary',
  'official_fiscal_note',
  'official_floor_amendment',
  'official_conferee',
  'official_legislative_speech',
  'official_committee_rollcall',
  'member_primary_bill_statement',
  'verified_news_bill_statement',
  'author_district_context',
  'author_member_primary_publication',
  'author_verified_news',
] as const;

export type LifecycleExternalAvailabilityFamily =
  typeof LIFECYCLE_EXTERNAL_AVAILABILITY_FAMILIES[number];

export interface LifecycleExternalAvailabilityInput {
  evidenceId: string;
  sourceDocumentId: string;
  billId: string | null;
  membershipId: string | null;
  session: string | null;
  sourceKind: string;
  evidenceKind: string;
  stance: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  metadata: Record<string, unknown> | null;
  newsPublicationDateSource?: string | null;
}

export interface LifecycleExternalAvailabilityAccepted {
  evidenceId: string;
  sourceDocumentId: string;
  billId: string | null;
  membershipId: string | null;
  session: string | null;
  family: LifecycleExternalAvailabilityFamily;
  availableOn: string;
  sourceKind: string;
  evidenceKind: string;
  stance: string | null;
  rule: string;
}

export type LifecycleExternalAvailabilityDecision =
  | { accepted: true; row: LifecycleExternalAvailabilityAccepted }
  | { accepted: false; reason: string };

function datePart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function bool(value: unknown): boolean {
  return value === true || value === 'true';
}

function meta(input: LifecycleExternalAvailabilityInput, key: string): unknown {
  return input.metadata?.[key];
}

function accepted(
  input: LifecycleExternalAvailabilityInput,
  family: LifecycleExternalAvailabilityFamily,
  availableOn: string,
  rule: string,
): LifecycleExternalAvailabilityDecision {
  return {
    accepted: true,
    row: {
      evidenceId: input.evidenceId,
      sourceDocumentId: input.sourceDocumentId,
      billId: input.billId,
      membershipId: input.membershipId,
      session: input.session,
      family,
      availableOn,
      sourceKind: input.sourceKind,
      evidenceKind: input.evidenceKind,
      stance: input.stance,
      rule,
    },
  };
}

export function classifyLifecycleExternalAvailability(
  input: LifecycleExternalAvailabilityInput,
): LifecycleExternalAvailabilityDecision {
  if (meta(input, 'asOfEligible') === false || meta(input, 'asOfEligible') === 'false') {
    return { accepted: false, reason: 'explicit_as_of_ineligible' };
  }

  const subtype = typeof meta(input, 'subtype') === 'string' ? String(meta(input, 'subtype')) : '';
  const publishedOn = datePart(input.publishedAt);
  const contextType = typeof meta(input, 'contextType') === 'string' ? String(meta(input, 'contextType')) : '';
  const sourceVerified = bool(meta(input, 'sourceVerified'));

  const structured: Record<string, LifecycleExternalAvailabilityFamily> = {
    bill_summary_version: 'official_bill_summary',
    fiscal_note: 'official_fiscal_note',
    floor_amendment_offer: 'official_floor_amendment',
    conference_conferee: 'official_conferee',
    legislative_speech: 'official_legislative_speech',
    committee_rollcall: 'official_committee_rollcall',
  };
  const structuredFamily = structured[subtype];
  if (structuredFamily) {
    if (!input.billId) return { accepted: false, reason: 'structured_missing_bill' };
    if (!publishedOn) return { accepted: false, reason: 'structured_missing_publication_date' };
    if (contextType && contextType !== 'structured_public') {
      return { accepted: false, reason: 'structured_context_mismatch' };
    }
    return accepted(input, structuredFamily, publishedOn, 'official_dated_structured_publication');
  }

  if (subtype === 'explicit_bill_statement') {
    if (!input.billId || !input.membershipId) {
      return { accepted: false, reason: 'statement_missing_bill_or_member' };
    }
    if (!sourceVerified) return { accepted: false, reason: 'statement_source_not_verified' };
    if (meta(input, 'publishedAtInvalid') === true || meta(input, 'publishedAtInvalid') === 'true') {
      return { accepted: false, reason: 'statement_publication_date_invalid' };
    }
    if (!publishedOn) return { accepted: false, reason: 'statement_missing_publication_date' };

    if (input.sourceKind === 'member_primary_article') {
      return accepted(
        input,
        'member_primary_bill_statement',
        publishedOn,
        'verified_member_primary_publication_date',
      );
    }
    if (input.sourceKind === 'public_news_article') {
      if (input.newsPublicationDateSource !== 'page_metadata') {
        return { accepted: false, reason: 'news_date_not_page_metadata' };
      }
      return accepted(
        input,
        'verified_news_bill_statement',
        publishedOn,
        'verified_news_page_metadata_publication_date',
      );
    }
    if (input.sourceKind === 'campaign_site') {
      return { accepted: false, reason: 'mutable_campaign_page_without_archive_date' };
    }
    return { accepted: false, reason: 'statement_source_kind_not_frozen' };
  }

  if (subtype === 'district_election_context') {
    if (!input.membershipId) return { accepted: false, reason: 'district_context_missing_member' };
    const electionOn = datePart(meta(input, 'electionDate'));
    if (!electionOn) return { accepted: false, reason: 'district_context_missing_election_date' };
    return accepted(input, 'author_district_context', electionOn, 'official_election_date');
  }

  if (subtype === 'member_primary_article' || input.sourceKind === 'member_primary_article') {
    if (!input.membershipId) return { accepted: false, reason: 'member_primary_missing_member' };
    if (!sourceVerified) return { accepted: false, reason: 'member_primary_source_not_verified' };
    if (!publishedOn) return { accepted: false, reason: 'member_primary_missing_publication_date' };
    return accepted(
      input,
      'author_member_primary_publication',
      publishedOn,
      'verified_member_primary_publication_date',
    );
  }

  if (subtype === 'news_article' || input.sourceKind === 'public_news_article') {
    if (!input.membershipId) return { accepted: false, reason: 'news_missing_member' };
    if (!sourceVerified) return { accepted: false, reason: 'news_source_not_verified' };
    if (!publishedOn) return { accepted: false, reason: 'news_missing_publication_date' };
    if (input.newsPublicationDateSource !== 'page_metadata') {
      return { accepted: false, reason: 'news_date_not_page_metadata' };
    }
    return accepted(
      input,
      'author_verified_news',
      publishedOn,
      'verified_news_page_metadata_publication_date',
    );
  }

  if (input.sourceKind === 'campaign_finance_bulk' || meta(input, 'contextType') === 'campaign_finance') {
    return { accepted: false, reason: 'campaign_finance_transaction_date_not_disclosure_date' };
  }
  if (input.sourceKind === 'campaign_site' || input.sourceKind === 'campaign_site_registry') {
    return { accepted: false, reason: 'mutable_campaign_page_without_archive_date' };
  }
  if (input.sourceKind === 'member_primary_registry') {
    return { accepted: false, reason: 'registry_capture_date_not_historical_publication_date' };
  }

  return { accepted: false, reason: 'source_not_in_frozen_historical_availability_contract' };
}

export function lifecycleExternalAvailabilityContentSha256(
  rows: readonly LifecycleExternalAvailabilityAccepted[],
): string {
  const digest = createHash('sha256');
  for (const row of [...rows].sort((a, b) =>
    (a.session ?? '').localeCompare(b.session ?? '')
    || (a.billId ?? '').localeCompare(b.billId ?? '')
    || (a.membershipId ?? '').localeCompare(b.membershipId ?? '')
    || a.availableOn.localeCompare(b.availableOn)
    || a.family.localeCompare(b.family)
    || a.evidenceId.localeCompare(b.evidenceId))) {
    digest.update(JSON.stringify(row) + '\n');
  }
  return digest.digest('hex');
}
