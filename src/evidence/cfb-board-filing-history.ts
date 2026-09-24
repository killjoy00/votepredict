import { buildCfbReportDisclosureProof, type CfbDisclosureProof } from './cfb-report-availability';

export const CFB_BOARD_FILING_HISTORY_VERSION = 'mn-cfb-board-filing-history-v1' as const;
export const CFB_BOARD_AGENDAS_URL =
  'https://register.cfb.mn.gov/citizen-resources/the-board/meetings/agendas/';

export interface CfbBoardMaterialsLink {
  sourceUrl: string;
  meetingDate: string;
}

export interface CfbHistoricalReportFiling extends CfbDisclosureProof {
  entityName: string;
  dueOn: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function isoDateFromUs(value: string): string | undefined {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return undefined;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const result = `${year.toString().padStart(4, '0')}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const parsed = new Date(result + 'T00:00:00Z');
  return Number.isNaN(parsed.getTime()) ? undefined : result;
}

function meetingDateFromHref(href: string): string | undefined {
  const path = new URL(href, CFB_BOARD_AGENDAS_URL).pathname;
  const match = path.match(/\/(20\d{2})[_-](\d{2})[_-](\d{2})[^/]*materials[^/]*\.pdf$/i);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function discoverCfbBoardMaterialsLinks(
  html: string,
  baseUrl = CFB_BOARD_AGENDAS_URL,
): CfbBoardMaterialsLink[] {
  const found = new Map<string, CfbBoardMaterialsLink>();
  for (const match of decodeHtml(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    let sourceUrl: string;
    try {
      sourceUrl = new URL(match[1], baseUrl).toString();
    } catch {
      continue;
    }
    const meetingDate = meetingDateFromHref(sourceUrl);
    if (!meetingDate) continue;
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'register.cfb.mn.gov') continue;
    if (!/^\/pdf\/bdinfo\/agendas\//i.test(parsed.pathname)) continue;
    found.set(sourceUrl, { sourceUrl, meetingDate });
  }
  return [...found.values()].sort(
    (left, right) => left.meetingDate.localeCompare(right.meetingDate) || left.sourceUrl.localeCompare(right.sourceUrl),
  );
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\f/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeEntityName(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^\d+\.\s*/, '')
    .replace(/\s+-\s*$/, '')
    .trim();
}

function normalizeReportName(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\bpre\s*[- ]\s*primary\b/i, 'Pre-Primary')
    .replace(/\bpre\s*[- ]\s*general\b/i, 'Pre-General')
    .replace(/\byear\s*[- ]\s*end\b/i, 'Year-End')
    .replace(/\b1st\s+quarter\b/i, '1st Quarter')
    .replace(/\bfirst\s+quarter\b/i, '1st Quarter')
    .replace(/\s+/g, ' ')
    .trim();
}

const REPORT_LABEL =
  '(?:20\\d{2}\\s+)?(?:Year\\s*[- ]\\s*End|Pre\\s*[- ]\\s*Primary|Pre\\s*[- ]\\s*General|1st\\s+Quarter|First\\s+Quarter|April|June|July|September|October|November|December)';

export function parseCfbBoardMaterialsFilingProofs(
  text: string,
  proofUrl: string,
): CfbHistoricalReportFiling[] {
  const normalized = normalizeWhitespace(text);
  const headings = [...normalized.matchAll(/(?:^|\s)(?:\d+\.\s*)?([^()]{3,120}?)\s*\((\d{4,6})\)\s+(?=Report\(s\)|Reports?\b)/gi)];
  const proofs: CfbHistoricalReportFiling[] = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? normalized.length;
    const block = normalized.slice(start, end);
    if (!/Report\(s\)|Reports?\b/i.test(block) || !/\bDue\b/i.test(block) || !/\bFiled\b/i.test(block)) continue;

    const entityName = normalizeEntityName(heading[1]);
    const registrationNumber = heading[2];
    const rowPattern = new RegExp(
      `(${REPORT_LABEL})\\s+(\\d{1,2}\\/\\d{1,2}\\/(?:\\d{2}|\\d{4}))\\s+(\\d{1,2}\\/\\d{1,2}\\/(?:\\d{2}|\\d{4}))`,
      'gi',
    );

    for (const row of block.matchAll(rowPattern)) {
      const dueOn = isoDateFromUs(row[2]);
      const filedOn = isoDateFromUs(row[3]);
      if (!dueOn || !filedOn) continue;
      const reportName = normalizeReportName(row[1]);
      const proof = buildCfbReportDisclosureProof({
        registrationNumber,
        reportName,
        filedOn,
        proofUrl,
      });
      proofs.push({ ...proof, entityName, dueOn });
    }
  }

  const unique = new Map<string, CfbHistoricalReportFiling>();
  for (const proof of proofs) {
    unique.set(
      [proof.registrationNumber, proof.reportName, proof.filedOn, proof.proofUrl].join('|'),
      proof,
    );
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.filedOn.localeCompare(right.filedOn)
      || left.registrationNumber.localeCompare(right.registrationNumber)
      || left.reportName.localeCompare(right.reportName),
  );
}
