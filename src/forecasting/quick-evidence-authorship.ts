export interface StoredAuthorshipResolution {
  rawName: string;
  status: 'resolved' | 'unresolved' | 'ambiguous';
  membershipId?: string;
  legislatorId?: string;
  memberName?: string;
  method?: string;
  candidates?: string[];
}

export interface StoredAuthorshipAction {
  occurredOn: string;
  operation: 'add' | 'strike';
  chiefAuthor?: boolean;
  description?: string;
  authors: StoredAuthorshipResolution[];
}

export interface StoredRevisorAuthorship {
  parserVersion?: string;
  fetchedAt?: string;
  chamber?: 'house' | 'senate';
  completeForAsOfReconstruction?: boolean;
  currentAuthors?: StoredAuthorshipResolution[];
  actions?: StoredAuthorshipAction[];
}

function resolvedMembershipIds(rows: readonly StoredAuthorshipResolution[]): string[] | undefined {
  if (rows.some((row) => row.status !== 'resolved' || !row.membershipId)) return undefined;
  return rows.map((row) => row.membershipId as string);
}

export function authorshipMembershipIdsAsOf(
  metadata: StoredRevisorAuthorship | null | undefined,
  asOfDateExclusive: string,
): Set<string> | undefined {
  if (!metadata || metadata.completeForAsOfReconstruction !== true) return undefined;
  const current = resolvedMembershipIds(metadata.currentAuthors ?? []);
  if (!current || current.length === 0) return undefined;

  const authors = new Set(current);
  const actions = [...(metadata.actions ?? [])]
    .filter((action) => action.occurredOn >= asOfDateExclusive)
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn));

  for (const action of actions) {
    const ids = resolvedMembershipIds(action.authors ?? []);
    if (!ids) return undefined;
    for (const membershipId of ids) {
      if (action.operation === 'add') authors.delete(membershipId);
      else authors.add(membershipId);
    }
  }
  return authors;
}

export function authorshipAvailableAt(
  metadata: StoredRevisorAuthorship | null | undefined,
  capturedAt: string,
): boolean {
  if (!metadata?.fetchedAt) return false;
  const fetched = Date.parse(metadata.fetchedAt);
  const captured = Date.parse(capturedAt);
  return Number.isFinite(fetched) && Number.isFinite(captured) && fetched <= captured;
}
