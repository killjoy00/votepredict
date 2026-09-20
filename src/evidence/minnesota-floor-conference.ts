export const MN_FLOOR_CONFERENCE_PARSER_VERSION = 'mn-floor-conference-v2' as const;

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


export function extractHouseRecordedVoteLinks(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (!/^\/votes\/details$/i.test(url.pathname)) continue;
      if (!/^https?:$/i.test(url.protocol)) continue;
      urls.push(url.toString());
    } catch {
      // Ignore malformed/non-HTTP links.
    }
  }
  return [...new Set(urls)];
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
    const amendmentCell = cells.find((cell) => /\b(?:H|S)?\d+[A-Z]\d+[A-Z0-9-]*\b/i.test(cell)
      || /\b(?:HF|SF)\d+[A-Z]\d+\b/i.test(cell));
    const amendmentMatch = amendmentCell?.match(/\b((?:H|S)?\d+[A-Z]\d+[A-Z0-9-]*|(?:HF|SF)\d+[A-Z]\d+)\b(?:\s+(.+))?/i);
    const amendmentRef = amendmentMatch?.[1];
    const description = cells[billIndex + 1] ?? '';
    const amendmentIndex = amendmentCell ? cells.indexOf(amendmentCell) : -1;
    const proposerName = amendmentMatch?.[2]?.trim()
      || (amendmentIndex >= 0 ? cells[amendmentIndex + 1] : undefined);
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

function conferenceAppointmentsForRows(
  billIdentifiers: readonly string[],
  rows: readonly string[][],
): ConferenceAppointment[] {
  const results: ConferenceAppointment[] = [];
  for (const cells of rows) {
    const labelIndex = cells.findIndex((cell) => /conferees?\s+appointed/i.test(cell));
    if (labelIndex < 0) continue;
    const houseCell = cells[labelIndex + 1] ?? '';
    const senateCell = cells[labelIndex + 2] ?? '';
    for (const memberName of names(houseCell)) {
      results.push({ billIdentifiers: [...billIdentifiers], chamber: 'house', memberName });
    }
    for (const memberName of names(senateCell)) {
      results.push({ billIdentifiers: [...billIdentifiers], chamber: 'senate', memberName });
    }
  }
  return results;
}

export function parseConferenceCommitteeAppointments(html: string): ConferenceAppointment[] {
  const results: ConferenceAppointment[] = [];

  const sectionPattern = /<h[1-4]\b[^>]*>([\s\S]*?\b(?:HF|SF)\s*\d+[\s\S]*?)<\/h[1-4]>([\s\S]*?)(?=<h[1-4]\b[^>]*>[\s\S]*?\b(?:HF|SF)\s*\d+\b|$)/gi;
  for (const section of html.matchAll(sectionPattern)) {
    const billIdentifiers = [...section[1].matchAll(/\b(?:HF|SF)\s*\d+\b/gi)]
      .map((match) => match[0].toUpperCase().replace(/\s+/g, ''));
    if (billIdentifiers.length === 0) continue;
    results.push(...conferenceAppointmentsForRows(
      [...new Set(billIdentifiers)],
      tableRows(section[2]),
    ));
  }

  if (results.length === 0) {
    let currentBills: string[] = [];
    for (const cells of tableRows(html)) {
      const billIds = cells.flatMap((cell) => [...cell.matchAll(/\b(?:HF|SF)\s*\d+\b/gi)]
        .map((match) => match[0].toUpperCase().replace(/\s+/g, '')));
      if (billIds.length > 0) currentBills = [...new Set(billIds)];
      if (currentBills.length > 0) {
        results.push(...conferenceAppointmentsForRows(currentBills, [cells]));
      }
    }
  }

  const unique = new Map<string, ConferenceAppointment>();
  for (const row of results) {
    const key = row.billIdentifiers.join('|') + '|' + row.chamber + '|' + row.memberName;
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}
