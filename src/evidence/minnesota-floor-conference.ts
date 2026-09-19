export const MN_FLOOR_CONFERENCE_PARSER_VERSION = 'mn-floor-conference-v1' as const;

export interface HouseFloorRollCall {
  billIdentifier: string;
  description: string;
  amendmentRef?: string;
  proposerName?: string;
  yeas: number;
  nays: number;
  journalPage?: string;
  occurredOn: string;
  rollCallWon: boolean;
}

export interface ConferenceAppointment {
  billIdentifiers: string[];
  chamber: 'house' | 'senate';
  memberName: string;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cellText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function tableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => cellText(match[1]))
      .filter(Boolean);
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function isoDate(value: string): string | undefined {
  const match = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return undefined;
  return match[3] + '-' + match[1].padStart(2, '0') + '-' + match[2].padStart(2, '0');
}

function integer(value: string): number | undefined {
  const compact = value.replace(/,/g, '').trim();
  if (!/^\d+$/.test(compact)) return undefined;
  const parsed = Number(compact);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseHouseRecordedFloorVotes(
  html: string,
  expectedBillIdentifier?: string,
): HouseFloorRollCall[] {
  const results: HouseFloorRollCall[] = [];
  for (const cells of tableRows(html)) {
    const billIndex = cells.findIndex((cell) => /^(?:HF|SF)\s*\d+$/i.test(cell));
    if (billIndex < 0) continue;
    const billIdentifier = cells[billIndex].toUpperCase().replace(/\s+/g, '');
    if (expectedBillIdentifier
      && billIdentifier !== expectedBillIdentifier.toUpperCase().replace(/\s+/g, '')) continue;
    const dateIndex = cells.findIndex((cell) => isoDate(cell) !== undefined);
    if (dateIndex < 0) continue;
    const occurredOn = isoDate(cells[dateIndex]);
    if (!occurredOn) continue;

    const numericIndexes = cells
      .map((cell, index) => ({ index, value: integer(cell) }))
      .filter((row) => row.value !== undefined && row.index > billIndex && row.index < dateIndex);
    if (numericIndexes.length < 2) continue;
    const yeasRow = numericIndexes[Math.max(0, numericIndexes.length - 3)] ?? numericIndexes[0];
    const naysRow = numericIndexes[Math.max(1, numericIndexes.length - 2)] ?? numericIndexes[1];
    const yeas = yeasRow.value as number;
    const nays = naysRow.value as number;
    const amendmentRef = cells.find((cell) => /^(?:H|S)?\d+[A-Z]\d+[A-Z0-9-]*$/i.test(cell)
      || /^(?:HF|SF)\d+[A-Z]\d+/i.test(cell));
    const description = cells[billIndex + 1] ?? '';
    const proposerName = amendmentRef
      ? cells[cells.indexOf(amendmentRef) + 1]
      : undefined;
    const journalCandidate = numericIndexes.at(-1);
    const journalPage = journalCandidate && journalCandidate.index > naysRow.index
      ? String(journalCandidate.value)
      : undefined;

    results.push({
      billIdentifier,
      description,
      amendmentRef,
      proposerName: proposerName && !/^\d+$/.test(proposerName) ? proposerName : undefined,
      yeas,
      nays,
      journalPage,
      occurredOn,
      rollCallWon: yeas > nays,
    });
  }
  return results;
}

function names(value: string): string[] {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s*;\s*|\s+and\s+/i)
    .map((name) => name.trim().replace(/[.;]+$/, ''))
    .filter(Boolean);
}

export function parseConferenceCommitteeAppointments(html: string): ConferenceAppointment[] {
  const rows = tableRows(html);
  const results: ConferenceAppointment[] = [];
  let currentBills: string[] = [];
  for (const cells of rows) {
    const billIds = cells.flatMap((cell) => [...cell.matchAll(/\b(?:HF|SF)\s*\d+\b/gi)]
      .map((match) => match[0].toUpperCase().replace(/\s+/g, '')));
    if (billIds.length > 0) currentBills = [...new Set(billIds)];
    const labelIndex = cells.findIndex((cell) => /conferees?\s+appointed/i.test(cell));
    if (labelIndex < 0 || currentBills.length === 0) continue;
    const houseCell = cells[labelIndex + 1] ?? '';
    const senateCell = cells[labelIndex + 2] ?? '';
    for (const memberName of names(houseCell)) {
      results.push({ billIdentifiers: currentBills, chamber: 'house', memberName });
    }
    for (const memberName of names(senateCell)) {
      results.push({ billIdentifiers: currentBills, chamber: 'senate', memberName });
    }
  }
  return results;
}
