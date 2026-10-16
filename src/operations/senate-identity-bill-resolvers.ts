/** Deterministic, session-scoped RAW links. Never assert an identity from a surname collision. */
export type MemberMatchMethod = 'exact' | 'alias' | 'surname_unique_in_session' | 'district' | 'unresolved';
export type BillMatchMethod = 'exact' | 'normalized' | 'unresolved';

export interface SenateMember {
  id: string;
  sessionSlug: string;
  name: string;
  district: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  aliases?: readonly string[];
}
export interface SessionBill {
  id: string;
  sessionSlug: string;
  identifier: string;
}
export interface SenatorResolution {
  membershipId: string | null;
  matchMethod: MemberMatchMethod;
}
export interface BillResolution {
  billId: string | null;
  matchMethod: BillMatchMethod;
  canonicalIdentifier: string | null;
}
export interface InclusionMention {
  sourceBillIdentifier: string | null;
  targetBillIdentifier: string | null;
  mentionType: 'laid over for possible inclusion' | 'incorporated into' | 'see article X of';
  mentionText: string;
}

export function normalizePrintedSenatorName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^(?:(?:state|mn)\s+)?(?:senators?|sens?\.?)\s+/i, '')
    .replace(/\b(?:jr|sr)\.?\s*$/i, '')
    .replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
}

function withoutMiddleInitial(name: string): string {
  const tokens = name.split(' ');
  return tokens.length > 2 ? tokens.filter((token, i) => i === 0 || i === tokens.length - 1 || token.length > 1).join(' ') : name;
}
function surnameAligned(printed: string, official: string): boolean {
  return official === printed || official.endsWith(' ' + printed)
    || (printed.split(' ').length >= 2 && printed.split(' ').at(-1) === official.split(' ').at(-1));
}
function unique(rows: readonly SenateMember[]): SenateMember | null {
  const byId = new Map(rows.map(row => [row.id, row]));
  return byId.size === 1 ? [...byId.values()][0] : null;
}
const GIVEN_NAMES: Record<string, string> = {
  bill:'william', bob:'robert', rob:'robert', liz:'elizabeth', beth:'elizabeth',
  peggy:'margaret', meg:'margaret', mike:'michael', tom:'thomas',
  jim:'james', joe:'joseph', jeff:'jeffrey', tony:'anthony',
  nick:'nicholas', andy:'andrew', dan:'daniel', kate:'katherine',
  kathy:'katherine', jack:'john',
};
function nickname(value: string): string { return GIVEN_NAMES[value] ?? value; }
function oneTypo(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a.length < 4 || b.length < 4) return false;
  let i=0,j=0,edits=0;
  while (i<a.length && j<b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length-i) + (b.length-j) <= 1;
}
function inDate(member: SenateMember, date: string | null | undefined): boolean {
  return !date || ((!member.startsOn || member.startsOn <= date) &&
    (!member.endsOn || member.endsOn >= date));
}

export function resolveSenator(
  input: { printedName: string; sessionSlug: string; district?: string | null; date?: string | null },
  roster: readonly SenateMember[],
): SenatorResolution {
  const printed = normalizePrintedSenatorName(input.printedName ?? '');
  const unresolved: SenatorResolution = {membershipId:null,matchMethod:'unresolved'};
  if (!printed || !/^[a-z]/.test(printed)) return unresolved;
  const members = roster.filter(m => m.sessionSlug === input.sessionSlug && inDate(m,input.date));
  const district = input.district?.replace(/^0+/,'').trim() || null;
  const exact = members.filter(m => withoutMiddleInitial(normalizePrintedSenatorName(m.name)) === withoutMiddleInitial(printed));
  const direct = unique(exact);
  if (direct) return {membershipId:direct.id,matchMethod:'exact'};
  const aliases = members.filter(m => (m.aliases ?? []).some(a => normalizePrintedSenatorName(a) === printed));
  const aliased = unique(aliases);
  if (aliased) return {membershipId:aliased.id,matchMethod:'alias'};

  // Full-name nicknames, initials, and at most one typo are allowed only when
  // the given-name clue and surname remain strongly compatible and UNIQUE.
  const pieces = printed.split(' ');
  const candidates = members.filter(m => {
    const official = normalizePrintedSenatorName(m.name).split(' ');
    if (pieces.length < 2 || official.length < 2) return false;
    const given = pieces[0], actualGiven = official[0];
    const firstOk = nickname(given) === nickname(actualGiven) ||
      (given.length === 1 && given[0] === actualGiven[0]);
    const suffix = pieces.slice(1).join(' ');
    const actualSuffix = official.slice(1).join(' ');
    const familyOk = actualSuffix === suffix || actualSuffix.endsWith(' '+suffix) ||
      (pieces.length === 2 && oneTypo(suffix,official.at(-1) ?? ''));
    return firstOk && familyOk;
  });
  const near = unique(candidates);
  if (near) return {membershipId:near.id,matchMethod:'alias'};

  // 'Maye Quade' and 'Oumou Verbeten' are compound surnames, not separate people.
  // Do not automatically treat a full, conflicting first+last name as surname-only.
  const suffixes = members.filter(m => {
    const official = normalizePrintedSenatorName(m.name);
    return official !== printed && official.endsWith(' '+printed);
  });
  const uniqueSurname = unique(suffixes);
  if (uniqueSurname) return {membershipId:uniqueSurname.id,matchMethod:'surname_unique_in_session'};
  // A district disambiguates compatible, but not contradictory, surnames.
  if (district) {
    const surnameMatches = members.filter(m => {
      const official = normalizePrintedSenatorName(m.name);
      const lastPrinted = pieces.at(-1);
      const lastOfficial = official.split(' ').at(-1);
      return String(Number(m.district)) === String(Number(district)) &&
        (official.endsWith(' '+printed) || lastPrinted === lastOfficial) &&
        (pieces.length === 1 || official.startsWith(pieces[0]+' ') ||
         official.startsWith(pieces[0][0]) || pieces.length > 2);
    });
    const byDistrict = unique(surnameMatches);
    if (byDistrict) return {membershipId:byDistrict.id,matchMethod:'district'};
  }
  return unresolved;
}

export function canonicalBillIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(?:([HS])\s*\.?\s*F\.?|([HS])F)\s*(?:No\.?\s*)?0*(\d{1,6})\s*\.?$/i);
  if (!match || Number(match[3]) <= 0) return null;
  return (match[1] ?? match[2]).toUpperCase() + 'F' + String(Number(match[3]));
}
export function resolveBill(
  input: { printedIdentifier: string | null | undefined; sessionSlug: string },
  bills: readonly SessionBill[],
): BillResolution {
  const canonical = canonicalBillIdentifier(input.printedIdentifier);
  const unresolved: BillResolution = {billId:null,matchMethod:'unresolved',canonicalIdentifier:canonical};
  if (!canonical) return unresolved;
  const found = bills.filter(b => b.sessionSlug === input.sessionSlug &&
    canonicalBillIdentifier(b.identifier) === canonical);
  const uniqueId = new Set(found.map(b => b.id));
  if (uniqueId.size !== 1) return unresolved;
  return {
    billId:[...uniqueId][0],
    matchMethod:(input.printedIdentifier ?? '').trim().toUpperCase() === canonical ? 'exact' : 'normalized',
    canonicalIdentifier:canonical,
  };
}
export function senateSessionForDate(date: string | null | undefined): string | null {
  const year = Number(date?.slice(0,4));
  return year >= 2021 && year <= 2026
    ? String(year % 2 === 0 ? year-1 : year) + '-' + String(year % 2 === 0 ? year : year+1)
    : null;
}
export function senateServiceSessionForElection(date: string, type: string): string | null {
  const year = Number(date.slice(0,4));
  if (!Number.isInteger(year) || year < 2020 || year > 2026) return null;
  if (type === 'general' && year % 2 === 0 && Number(date.slice(5,7)) >= 11)
    return String(year+1) + '-' + String(year+2);
  return senateSessionForDate(date) ?? (year === 2020 ? '2021-2022' : null);
}

const BILL_IN_TEXT = /\b[HS]\s*\.?\s*F\.?\s*(?:No\.?\s*)?\d{1,6}\b/gi;
function identifiersIn(value: string): string[] {
  const found: string[] = [];
  for (const hit of value.matchAll(BILL_IN_TEXT)) {
    const parsed = canonicalBillIdentifier(hit[0]);
    if (parsed) found.push(parsed);
  }
  return found;
}
/** Retain literal snippets only. Never infer inclusion from a reference or topic. */
export function extractBillInclusionMentions(raw: string): InclusionMention[] {
  const output: InclusionMention[] = [];
  const text = raw.replace(/\r/g,' ').slice(0,4_000_000);
  const keywords = /\b(laid over for possible inclusion|incorporated into|see\s+article\s+[0-9ivx]+\s+of)\b/gi;
  for (const match of text.matchAll(keywords)) {
    const at = match.index ?? 0;
    // Sentence-sized context preserves the printed bill numbers and exact phrase.
    const before = text.slice(Math.max(0,at-300),at);
    const after = text.slice(at+match[0].length,Math.min(text.length,at+match[0].length+220));
    const start = Math.max(before.lastIndexOf('\n'),before.lastIndexOf('. '),before.lastIndexOf('; '));
    const stopCandidates = [after.indexOf('\n'),after.indexOf('. '),after.indexOf('; ')].filter(x=>x>=0);
    const end = stopCandidates.length ? Math.min(...stopCandidates) : Math.min(after.length,180);
    const lead = before.slice(start+1).trim();
    const tail = after.slice(0,end).trim();
    const source = identifiersIn(lead).at(-1) ?? null;
    const target = identifiersIn(tail)[0] ?? null;
    if (!source && !target) continue;
    const kind = /^laid/i.test(match[0]) ? 'laid over for possible inclusion' :
      /^incorporated/i.test(match[0]) ? 'incorporated into' : 'see article X of';
    output.push({
      sourceBillIdentifier:source,
      targetBillIdentifier:target,
      mentionType:kind,
      mentionText:(lead+' '+match[0]+' '+tail).replace(/\s+/g,' ').trim().slice(0,500),
    });
    if (output.length >= 1000) break;
  }
  return output;
}

/** Revisor bill-status page explicitly prints 'Companion: HF123'. */
export function parseRevisorCompanion(html: string): string | null {
  const plain = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
    .replace(/\s+/g,' ');
  const match = plain.match(/\bCompanion\s*:\s*(HF\s*0*\d{1,6}|None)\b/i);
  return match && !/^none$/i.test(match[1]) ? canonicalBillIdentifier(match[1]) : null;
}
