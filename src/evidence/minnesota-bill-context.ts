export const MN_BILL_CONTEXT_PARSER_VERSION = 'mn-bill-context-v1' as const;

export interface OfficialBillResourceLink {
  kind: 'house_research_summary' | 'fiscal_notes';
  url: string;
  label: string;
}

export interface HouseResearchSummaryRow {
  billIdentifier: string;
  latestVersion: string;
  subject: string;
  hasPriorSummaries: boolean;
}

export interface FiscalNoteSummary {
  billIdentifier: string;
  noteCount: number;
  completedDates: string[];
}

function decode(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function tableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => decode(match[1]));
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

export function parseHouseResearchSummaryIndex(html: string): HouseResearchSummaryRow[] {
  const rows: HouseResearchSummaryRow[] = [];
  for (const cells of tableRows(html)) {
    const billIndex = cells.findIndex((cell) => /^(?:HF|SF)\s*\d+$/i.test(cell));
    if (billIndex < 0) continue;
    const billIdentifier = cells[billIndex].toUpperCase().replace(/\s+/g, '');
    const latestVersion = cells[billIndex + 1]?.trim() ?? '';
    const subject = cells[billIndex + 2]?.trim() ?? '';
    const prior = cells[billIndex + 3]?.trim() ?? '';
    if (!latestVersion && !subject) continue;
    rows.push({
      billIdentifier,
      latestVersion,
      subject,
      hasPriorSummaries: Boolean(prior) && !/^(?:none|n\/a|—|-)$/i.test(prior),
    });
  }
  return rows;
}

export function extractOfficialBillResourceLinks(
  html: string,
  baseUrl: string,
): OfficialBillResourceLink[] {
  const resources: OfficialBillResourceLink[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1];
    const label = decode(match[2]);
    let kind: OfficialBillResourceLink['kind'] | undefined;
    if (/house\s+research|bill\s+summar/i.test(label) || /billsum/i.test(href)) {
      kind = 'house_research_summary';
    } else if (/fiscal\s+notes?/i.test(label) || /fnsearch|fiscalnote|fiscal-note/i.test(href)) {
      kind = 'fiscal_notes';
    }
    if (!kind) continue;
    try {
      const url = new URL(href, baseUrl).toString();
      if (!/^https?:/i.test(url)) continue;
      resources.push({ kind, url, label });
    } catch {
      // Ignore malformed official links.
    }
  }
  return [...new Map(resources.map((row) => [row.kind + '|' + row.url, row])).values()];
}

function dateIso(value: string): string | undefined {
  const match = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return undefined;
  return match[3] + '-' + match[1].padStart(2, '0') + '-' + match[2].padStart(2, '0');
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}

export function summarizeFiscalNoteSearch(
  text: string,
  billIdentifier: string,
): FiscalNoteSummary {
  const normalized = billIdentifier.toUpperCase().replace(/\s+/g, '');
  const prefix = regexEscape(normalized.slice(0, 2));
  const number = regexEscape(normalized.slice(2));
  const compactText = text.replace(/\s+/g, ' ');
  const billPattern = new RegExp('\\b' + prefix + '\\s*' + number + '\\b', 'gi');
  const mentionCount = [...compactText.matchAll(billPattern)].length;
  const dates = [...compactText.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)]
    .map((match) => dateIso(match[0]))
    .filter((value): value is string => Boolean(value));
  const explicitNotes = [...compactText.matchAll(/\bfiscal\s+note\b/gi)].length;
  return {
    billIdentifier: normalized,
    noteCount: Math.max(mentionCount, explicitNotes > 0 ? Math.max(1, explicitNotes - 1) : 0),
    completedDates: [...new Set(dates)].sort(),
  };
}
