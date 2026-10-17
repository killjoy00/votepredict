import type { RawSenateRole } from './senate-roles';
import type { MinnesotaHouseSession } from './sessions';

export interface SenateAssignmentPdfResult {
  roles: RawSenateRole[];
  text: string;
  sourceDate: string | null;
}

function dateShown(text: string): string | null {
  const value = text.match(/\bAs of:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
    ?? text.slice(0, 1000).match(/(?:^|\n)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?=\n|$)/);
  return value ? `${value[3]}-${value[1].padStart(2, '0')}-${value[2].padStart(2, '0')}` : null;
}

function committeeHeading(lines: string[], chairIndex: number): { start: number; title: string } {
  let start = chairIndex - 1;
  let title = lines[start].replace(/\s+/g, ' ');
  while (start > 0 && /^(?:Policy|Legacy Finance|Elections|and\b)/i.test(title)
    && /\b(?:and|Finance|Policy)\s*$/i.test(lines[start - 1])
    && !/^(?:Office|Meets|Members|Chair|Vice Chair)\s*:/i.test(lines[start - 1])) {
    title = (lines[--start] + ' ' + title).replace(/\s+/g, ' ');
  }
  return { start, title };
}

// The Senate's dated committee-assignment PDFs use surnames, sometimes
// multiword surnames, rather than full names. Preserve them as written.
export function parseSenateAssignmentPdfText(text: string, session: MinnesotaHouseSession): SenateAssignmentPdfResult {
  // Retain PDF column separators until after names are delimited. Collapsing
  // tabs first can turn a neighboring senator into part of the ranking name.
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const years = session.slug.split('-');
  if (!lines.some((line) => years.some((year) => line.includes(`${year} Committee Assignments`)))) {
    return { roles: [], text, sourceDate: dateShown(text) };
  }
  const roles: RawSenateRole[] = [];
  const add = (senatorName: string, role: string, committee: string, rawContent: string): void => {
    if (!senatorName || !committee) return;
    roles.push({ senatorName, role, committee, startsOn: null, endsOn: null, rawContent });
  };
  for (let index = 1; index < lines.length; index += 1) {
    const leadership = lines[index];
    if (!/^Chair\s*:/i.test(leadership)) continue;
    const committee = committeeHeading(lines, index).title;
    if (/^(?:Minnesota Senate|Committees|Members:|Office:|Meets:|As of:)/i.test(committee)) continue;
    const chair = leadership.match(/\bChair\s*:\s*(.*?)\s*(?=Vice Chair\s*:|$)/i)?.[1]?.trim();
    const vice = leadership.match(/\bVice Chair\s*:\s*(.*?)\s*(?=Chair\s*:|$)/i)?.[1]?.trim();
    if (chair) { add(chair, 'Chair', committee, `${committee} | ${leadership}`); add(chair, 'Committee Member', committee, `${committee} | ${leadership}`); }
    if (vice) { add(vice, 'Vice Chair', committee, `${committee} | ${leadership}`); add(vice, 'Committee Member', committee, `${committee} | ${leadership}`); }
    const next = lines.findIndex((line, nextIndex) => nextIndex > index && /^Chair\s*:/i.test(line));
    const block = lines.slice(index + 1, next === -1 ? undefined : committeeHeading(lines, next).start);
    const minority = block.flatMap((line) => line.split(/\t+| {2,}/))
      .map((cell) => cell.match(/^\s*([^()]+?)\s*\(L\)/))
      .find((match) => match && !/\b(?:Office|Meets|Members|denotes)\b/i.test(match[1]));
    if (minority) add(minority[1].trim(), 'Ranking Minority Member', committee, `${committee} | ${minority[0]} (L denotes ranking minority member)`);
    let inMembers = false;
    for (const line of block) {
      if (/^Members:\s*\d*\s*$/i.test(line)) { inMembers = true; continue; }
      if (!inMembers || /^(?:--|\(L\)|Office:|Meets:|Senate Information)/i.test(line)) continue;
      const cells = line.split(/\t+| {2,}/);
      // A multiword single cell could be a name or flattened neighboring names.
      // Keep only explicit column cells or an unambiguous one-word row.
      if (cells.length === 1 && !/^[A-Za-zÀ-ž'’.-]+(?:\s*\(L\))?$/.test(line)) continue;
      for (const cell of cells) {
        const name = cell.replace(/\s*\(L\)\s*$/, '').trim();
        if (/^[A-Za-zÀ-ž'’.-]+(?:\s+[A-Za-zÀ-ž'’.-]+){0,3}$/.test(name)) add(name, 'Committee Member', committee, `${committee} | ${cell.trim()}`);
      }
    }
  }
  const unique = [...new Map(roles.map(role => [[role.senatorName, role.role, role.committee].join('|'), role])).values()];
  return { roles: unique, text, sourceDate: dateShown(text) };
}

export function senateAssignmentPdfUrl(session: MinnesotaHouseSession): string {
  return `https://www.senate.mn/committees/${session.slug}/info/comlegal.pdf`;
}

export async function fetchSenateAssignmentPdf(session: MinnesotaHouseSession): Promise<SenateAssignmentPdfResult | null> {
  const sourceUrl = senateAssignmentPdfUrl(session);
  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'VotePredict/2.0 Minnesota Senate raw-role ingester' }, signal: AbortSignal.timeout(25_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Official Senate assignment PDF HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 200 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return null;
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  try {
    const extraction = await parser.getText();
    return parseSenateAssignmentPdfText(extraction.text, session);
  } finally {
    await parser.destroy();
  }
}
