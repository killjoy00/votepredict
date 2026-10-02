export const SENATE_FORMER_MEMBER_ARCHIVE_VERSION =
  'senate-former-member-archive-v1' as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugTokens(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 1);
}

export function generatedSenateFormerMemberCandidateUrls(
  member: { name: string; party: string },
  dflProfileUrl?: string,
): string[] {
  const party = member.party.trim().toUpperCase();
  const tokens = slugTokens(member.name);
  const first = tokens[0];
  const last = tokens.at(-1);
  if (!first || !last) return dflProfileUrl ? [dflProfileUrl] : [];

  const slugs = [...new Set([tokens.join('-'), first + '-' + last])];
  if (party === 'DFL') {
    const urls = dflProfileUrl ? [dflProfileUrl] : [];
    for (const slug of slugs) {
      urls.push(`https://senatedfl.mn/author/${slug}/`);
      urls.push(`https://senatedfl.mn/author/senator-${slug}/`);
    }
    return [...new Set(urls)];
  }
  if (party === 'R' || party === 'GOP' || party === 'REPUBLICAN') {
    const urls: string[] = [];
    for (const slug of slugs) {
      urls.push(`https://www.mnsenaterepublicans.com/${slug}`);
      urls.push(`https://www.mnsenaterepublicans.com/senator-${slug}`);
    }
    return [...new Set(urls)];
  }
  return [];
}

export function parseBoundedSenateArchiveMembershipIds(
  raw: string,
  maxIds = 8,
): string[] {
  const ids = raw.split(',').map(value => value.trim()).filter(Boolean);
  if (ids.length < 1) throw new Error('At least one Senate archive membership id is required');
  if (!Number.isInteger(maxIds) || maxIds < 1) throw new Error('Invalid Senate archive membership id limit');
  if (ids.length > maxIds) {
    throw new Error(`Senate archive backfill accepts at most ${maxIds} membership ids`);
  }
  if (new Set(ids.map(id => id.toLowerCase())).size !== ids.length) {
    throw new Error('Senate archive membership ids must be unique');
  }
  for (const id of ids) {
    if (!UUID_PATTERN.test(id)) throw new Error(`Invalid Senate archive membership id: ${id}`);
  }
  return ids;
}
