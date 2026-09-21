import { historicalHtmlLines } from '../evaluation/historical-deep-discovery-extractor';
import {
  buildPageAliases,
  findExpandedRollCalls,
  HISTORICAL_DEEP_EXPANSION_PARSER_V2,
  resolveVoteName,
  type ExtractionRule,
} from '../evaluation/historical-deep-expansion-extractor-v2';
import {
  classifyMotion,
  HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY,
  type HistoricalDeepProceduralMechanic,
} from '../evaluation/historical-deep-procedural-mechanics';

export const MN_HOUSE_COMMITTEE_ROLLCALL_PROSPECTIVE_VERSION =
  'mn-house-committee-rollcall-prospective-v1' as const;
export const MN_HOUSE_COMMITTEE_ROLLCALL_PARSER = HISTORICAL_DEEP_EXPANSION_PARSER_V2;
export const MN_HOUSE_COMMITTEE_ROLLCALL_MECHANICS = HISTORICAL_DEEP_PROCEDURAL_MECHANICS_POLICY;

export interface ProspectiveCommitteeBill {
  billId: string;
  identifier: string;
}

export interface ProspectiveCommitteeMember {
  membershipId: string;
  memberName: string;
}

export interface ProspectiveCommitteeRollcallObservation {
  billId: string;
  identifier: string;
  membershipId: string;
  memberName: string;
  voteSide: 'aye' | 'nay';
  motionText: string;
  excerpt: string;
  blockIndex: number;
  extractionRule: ExtractionRule;
  mechanics: HistoricalDeepProceduralMechanic[];
}

export interface ProspectiveCommitteeRollcallExtraction {
  observations: ProspectiveCommitteeRollcallObservation[];
  diagnostics: Array<{
    identifier: string;
    rawName: string;
    type: 'unresolved_vote_name' | 'ambiguous_vote_name';
  }>;
}

export function minnesotaLegislatureForSessionStart(startYear: number): number {
  if (!Number.isInteger(startYear) || startYear < 1857) {
    throw new Error(`Unsupported Minnesota session start year: ${startYear}`);
  }
  return Math.round((startYear - 1837) / 2);
}

export function extractCurrentHouseCommitteeIds(html: string, legislature: number): string[] {
  const prefix = String(legislature);
  const ids = new Set<string>();
  for (const match of html.matchAll(/\/Committees\/(?:minutes|home)\/(\d{5})\b/gi)) {
    const id = match[1];
    if (id.startsWith(prefix)) ids.add(id);
  }
  return [...ids].sort((left, right) => Number(left) - Number(right));
}

function mentionedBillIdentifiers(lines: readonly string[]): string[] {
  const identifiers = new Set<string>();
  const text = lines.join(' ');
  for (const match of text.matchAll(/\b(HF|SF)\s*(\d+)\b/gi)) {
    identifiers.add(`${match[1].toUpperCase()}${match[2]}`);
  }
  return [...identifiers].sort();
}

export function extractProspectiveCommitteeRollcalls(input: {
  html: string;
  bills: readonly ProspectiveCommitteeBill[];
  members: readonly ProspectiveCommitteeMember[];
}): ProspectiveCommitteeRollcallExtraction {
  const lines = historicalHtmlLines(input.html);
  const billByIdentifier = new Map(
    input.bills.map((bill) => [bill.identifier.toUpperCase().replace(/\s+/g, ''), bill]),
  );
  const aliases = buildPageAliases(lines, input.members);
  const observations: ProspectiveCommitteeRollcallObservation[] = [];
  const diagnostics: ProspectiveCommitteeRollcallExtraction['diagnostics'] = [];
  const dedupe = new Set<string>();

  for (const identifier of mentionedBillIdentifiers(lines)) {
    const bill = billByIdentifier.get(identifier);
    if (!bill) continue;
    const blocks = findExpandedRollCalls(lines, bill.identifier);
    blocks.forEach((block, blockIndex) => {
      for (const [voteSide, rawNames] of [['aye', block.ayes], ['nay', block.nays]] as const) {
        for (const rawName of rawNames) {
          const resolved = resolveVoteName(rawName, input.members, aliases);
          if (!resolved.member) {
            diagnostics.push({
              identifier: bill.identifier,
              rawName,
              type: resolved.ambiguous ? 'ambiguous_vote_name' : 'unresolved_vote_name',
            });
            continue;
          }
          const key = [
            bill.billId,
            blockIndex,
            block.motionText,
            resolved.member.membershipId,
            voteSide,
          ].join('|');
          if (dedupe.has(key)) continue;
          dedupe.add(key);
          observations.push({
            billId: bill.billId,
            identifier: bill.identifier,
            membershipId: resolved.member.membershipId,
            memberName: resolved.member.memberName,
            voteSide,
            motionText: block.motionText,
            excerpt: block.excerpt,
            blockIndex,
            extractionRule: block.extractionRule,
            mechanics: classifyMotion(block.motionText),
          });
        }
      }
    });
  }

  observations.sort((left, right) => left.identifier.localeCompare(right.identifier)
    || left.blockIndex - right.blockIndex
    || left.membershipId.localeCompare(right.membershipId)
    || left.voteSide.localeCompare(right.voteSide));

  return { observations, diagnostics };
}
