export interface AuthorshipRosterMember {
  membershipId: string;
  legislatorId: string;
  name: string;
  chamber: 'house' | 'senate';
  aliases?: readonly string[];
}

export interface RevisorAuthorResolution {
  rawName: string;
  status: 'resolved' | 'unresolved' | 'ambiguous';
  membershipId?: string;
  legislatorId?: string;
  memberName?: string;
  method?: 'exact' | 'source_alias' | 'surname_initials' | 'unique_surname' | 'token_subset';
  candidates?: string[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function memberTokens(name: string): string[] {
  return normalize(name).split(' ').filter(Boolean);
}

function rawAuthorParts(value: string): { surname?: string; initials: string[]; tokens: string[] } {
  const trimmed = value.trim();
  const comma = trimmed.indexOf(',');
  if (comma > 0) {
    const surnameTokens = normalize(trimmed.slice(0, comma)).split(' ').filter(Boolean);
    const rightTokens = normalize(trimmed.slice(comma + 1)).split(' ').filter(Boolean);
    return {
      surname: surnameTokens.join(' '),
      initials: rightTokens.map((token) => token[0]).filter(Boolean),
      tokens: [...surnameTokens, ...rightTokens],
    };
  }
  const tokens = normalize(trimmed).split(' ').filter(Boolean);
  return {
    surname: tokens.at(-1),
    initials: [],
    tokens,
  };
}

function memberInitials(tokens: readonly string[]): string[] {
  return tokens.slice(0, -1).map((token) => token[0]).filter(Boolean);
}

function comparableName(value: string): string {
  return normalize(value.includes(',')
    ? value.split(',').reverse().join(' ')
    : value);
}

function exactMatches(rawName: string, roster: readonly AuthorshipRosterMember[]): Array<{
  member: AuthorshipRosterMember;
  method: 'exact' | 'source_alias';
}> {
  const target = comparableName(rawName);
  return roster.flatMap((member) => {
    const canonicalMatch = comparableName(member.name) === target;
    const aliasMatch = member.aliases?.some((alias) => comparableName(alias) === target) ?? false;
    if (!canonicalMatch && !aliasMatch) return [];
    return [{ member, method: canonicalMatch ? 'exact' as const : 'source_alias' as const }];
  });
}

function candidateNames(rows: readonly AuthorshipRosterMember[]): string[] {
  return rows.map((row) => row.name).sort();
}

export function resolveRevisorAuthor(
  rawName: string,
  chamber: 'house' | 'senate',
  roster: readonly AuthorshipRosterMember[],
): RevisorAuthorResolution {
  const scoped = roster.filter((member) => member.chamber === chamber);
  const exact = exactMatches(rawName, scoped);
  if (exact.length === 1) {
    return {
      rawName,
      status: 'resolved',
      membershipId: exact[0].member.membershipId,
      legislatorId: exact[0].member.legislatorId,
      memberName: exact[0].member.name,
      method: exact[0].method,
    };
  }
  if (exact.length > 1) {
    return { rawName, status: 'ambiguous', candidates: candidateNames(exact.map((row) => row.member)) };
  }

  const parts = rawAuthorParts(rawName);
  const surname = parts.surname;
  if (!surname) return { rawName, status: 'unresolved' };
  const surnameTokens = surname.split(' ');
  const surnameMatches = scoped.filter((member) => {
    const tokens = memberTokens(member.name);
    const tail = tokens.slice(-surnameTokens.length).join(' ');
    return tail === surname;
  });

  if (parts.initials.length > 0) {
    const initialMatches = surnameMatches.filter((member) => {
      const initials = memberInitials(memberTokens(member.name));
      return parts.initials.every((initial, index) => initials[index] === initial);
    });
    if (initialMatches.length === 1) {
      return {
        rawName,
        status: 'resolved',
        membershipId: initialMatches[0].membershipId,
        legislatorId: initialMatches[0].legislatorId,
        memberName: initialMatches[0].name,
        method: 'surname_initials',
      };
    }
    if (initialMatches.length > 1) {
      return { rawName, status: 'ambiguous', candidates: candidateNames(initialMatches) };
    }
  }

  if (parts.tokens.length === 1 && surnameMatches.length === 1) {
    return {
      rawName,
      status: 'resolved',
      membershipId: surnameMatches[0].membershipId,
      legislatorId: surnameMatches[0].legislatorId,
      memberName: surnameMatches[0].name,
      method: 'unique_surname',
    };
  }
  if (parts.tokens.length === 1 && surnameMatches.length > 1) {
    return { rawName, status: 'ambiguous', candidates: candidateNames(surnameMatches) };
  }

  const subsetMatches = surnameMatches.filter((member) => {
    const tokens = new Set(memberTokens(member.name));
    return parts.tokens.every((token) => tokens.has(token));
  });
  if (subsetMatches.length === 1) {
    return {
      rawName,
      status: 'resolved',
      membershipId: subsetMatches[0].membershipId,
      legislatorId: subsetMatches[0].legislatorId,
      memberName: subsetMatches[0].name,
      method: 'token_subset',
    };
  }
  if (subsetMatches.length > 1) return { rawName, status: 'ambiguous', candidates: candidateNames(subsetMatches) };

  return { rawName, status: 'unresolved' };
}

export function resolveRevisorAuthors(
  rawNames: readonly string[],
  chamber: 'house' | 'senate',
  roster: readonly AuthorshipRosterMember[],
): RevisorAuthorResolution[] {
  return rawNames.map((rawName) => resolveRevisorAuthor(rawName, chamber, roster));
}
