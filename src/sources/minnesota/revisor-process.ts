import { parseRevisorOfficialActions, type RevisorActionChamber } from './revisor-actions';

export const REVISOR_PROCESS_PARSER_VERSION = 'revisor-process-v1' as const;

export type RevisorProcessStageKind =
  | 'committee_referral'
  | 'committee_report'
  | 'second_reading'
  | 'floor_scheduled'
  | 'amendment_activity'
  | 'author_added'
  | 'rules_referral'
  | 'cross_chamber_received'
  | 'companion_reference';

export interface RevisorProcessEvent {
  chamber: Exclude<RevisorActionChamber, null>;
  occurredOn: string;
  stageKind: RevisorProcessStageKind;
  description: string;
  companionIdentifiers: string[];
}

function normalizeIdentifier(value: string): string | null {
  const match = value.trim().match(/^(HF|SF)\s*0*(\d+)$/i);
  return match ? `${match[1].toUpperCase()}${Number(match[2])}` : null;
}

function companionIdentifiers(description: string, billIdentifier: string): string[] {
  if (!/\b(?:comparison with|companion|substitut(?:e|ed|ion|ing))\b/i.test(description)) return [];
  const current = normalizeIdentifier(billIdentifier);
  const found = [...description.matchAll(/\b(HF|SF)\s*0*(\d+)\b/gi)]
    .map((match) => `${match[1].toUpperCase()}${Number(match[2])}`)
    .filter((identifier) => identifier !== current);
  return [...new Set(found)];
}

function classifyDescription(description: string, billIdentifier: string): Array<{
  stageKind: RevisorProcessStageKind;
  companionIdentifiers: string[];
}> {
  const rows: Array<{ stageKind: RevisorProcessStageKind; companionIdentifiers: string[] }> = [];
  const companions = companionIdentifiers(description, billIdentifier);
  const referred = /\b(?:referred|re-referred|rereferred|re-refer(?:red)?)\s+to\b/i.test(description)
    || /\bcommittee report\b[\s\S]*\bre-refer\s+to\b/i.test(description)
    || /\bcomm(?:ittee)?\.?\s*report\b[\s\S]*\bre-refer\s+to\b/i.test(description);

  if (referred) rows.push({ stageKind: 'committee_referral', companionIdentifiers: [] });
  if (/\b(?:committee report|comm(?:ittee)?\.?\s*report)\b/i.test(description)) {
    rows.push({ stageKind: 'committee_report', companionIdentifiers: [] });
  }
  if (/\bsecond reading\b/i.test(description)) rows.push({ stageKind: 'second_reading', companionIdentifiers: [] });
  if (/\b(?:placed on (?:the )?calendar|calendar for the day|special order|general orders)\b/i.test(description)) {
    rows.push({ stageKind: 'floor_scheduled', companionIdentifiers: [] });
  }
  if (/\bamend(?:ed|ment|ments|ing)\b/i.test(description)) {
    rows.push({ stageKind: 'amendment_activity', companionIdentifiers: [] });
  }
  if (/\bauthors? added\b/i.test(description)) rows.push({ stageKind: 'author_added', companionIdentifiers: [] });
  if (referred && /\brules (?:and|&) administration\b/i.test(description)) {
    rows.push({ stageKind: 'rules_referral', companionIdentifiers: [] });
  }
  if (/\b(?:received|returned) from (?:the )?(?:house|senate)\b/i.test(description)) {
    rows.push({ stageKind: 'cross_chamber_received', companionIdentifiers: [] });
  }
  if (companions.length > 0) rows.push({ stageKind: 'companion_reference', companionIdentifiers: companions });
  return rows;
}

export function parseRevisorProcessEvents(input: {
  xml: string;
  identifier: string;
}): RevisorProcessEvent[] {
  const events: RevisorProcessEvent[] = [];
  for (const action of parseRevisorOfficialActions(input.xml)) {
    if (!action.chamber || !action.occurredOn || !action.description) continue;
    for (const classified of classifyDescription(action.description, input.identifier)) {
      events.push({
        chamber: action.chamber,
        occurredOn: action.occurredOn,
        stageKind: classified.stageKind,
        description: action.description,
        companionIdentifiers: classified.companionIdentifiers,
      });
    }
  }
  return events;
}
