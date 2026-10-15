import type { RawSenateRole } from './senate-roles';
import type { MinnesotaHouseSession } from './sessions';

export interface SenateAssignmentPdfResult {
  roles: RawSenateRole[];
  text: string;
  sourceDate: string | null;
}

function dateShown(text: string): string | null {
  const value = text.match(/\bAs of:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  return value ? `${value[3]}-${value[1].padStart(2, '0')}-${value[2].padStart(2, '0')}` : null;
}

// The Senate's dated committee-assignment PDFs use surnames, sometimes
// multiword surnames, rather than full names. Preserve them as written.
export function parseSenateAssignmentPdfText(text: string, session: MinnesotaHouseSession): SenateAssignmentPdfResult {
  const lines = text.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean);
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
    const committee = lines[index - 1];
    if (/^(?:Minnesota Senate|Committees|Members:|Office:|Meets:|As of:)/i.test(committee)) continue;
    const chair = leadership.match(/\bChair\s*:\s*(.*?)\s*(?=Vice Chair\s*:|$)/i)?.[1]?.trim();
    const vice = leadership.match(/\bVice Chair\s*:\s*(.*?)\s*(?=Chair\s*:|$)/i)?.[1]?.trim();
    if (chair) add(chair, 'Chair', committee, `${committee} | ${leadership}`);
    if (vice) add(vice, 'Vice Chair', committee, `${committee} | ${leadership}`);
    const next = lines.findIndex((line, nextIndex) => nextIndex > index && /^Chair\s*:/i.test(line));
    const block = lines.slice(index + 1, next === -1 ? undefined : next - 1);
    const minority = block.join(' ').match(/\b([A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*)?)\s*\(L\)/);
    if (minority) add(minority[1], 'Ranking Minority Member', committee, `${committee} | ${minority[0]} (L denotes ranking minority member)`);
  }
  return { roles, text, sourceDate: dateShown(text) };
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
