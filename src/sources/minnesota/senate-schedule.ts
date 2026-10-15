import { createHash } from 'node:crypto';

const SENATE_BASE = 'https://www.senate.mn';
const USER_AGENT = 'VotePredict/2.0 raw Senate vote collector';

/** One committee hearing as listed by the senate.mn schedule API. */
export interface SenateHearing {
  hearingId: number;
  startsAt: string | null;
  date: string;
  committeeId: number | null;
  committeeName: string | null;
  legislature: number | null;
  minutesPublic: boolean;
  minutesUrl: string | null;
  notes: string | null;
  agenda: unknown;
}

type ApiHearing = Record<string, unknown>;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildSenateHearingMinutesUrl(hearingId: number, legislature: number): string {
  return `${SENATE_BASE}/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=${hearingId}&ls=${legislature}&type=minutes`;
}

/** Reads the hearing dates list from /api/schedule/allDates, limited to [from, to]. */
export function parseSenateHearingDates(json: unknown, from: string, to: string): string[] {
  const events = (json as { events?: Array<{ hearing_start?: unknown }> } | null)?.events ?? [];
  const dates = new Set<string>();
  for (const event of events) {
    const date = stringValue(event.hearing_start)?.slice(0, 10);
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= from && date <= to) dates.add(date);
  }
  return [...dates].sort();
}

/** Reads one day's committee hearings from /api/schedule/daily?date=. */
export function parseSenateDailyHearings(json: unknown, date: string): SenateHearing[] {
  const events = (json as { events?: ApiHearing[] } | null)?.events ?? [];
  const hearings: SenateHearing[] = [];
  for (const event of events) {
    const hearingId = numberValue(event.hearing_id);
    if (!hearingId) continue;
    const minutesLink = stringValue(event.minutes_link);
    const legislature = numberValue(minutesLink?.match(/[?&]ls=(\d+)/)?.[1]);
    const committee = event.committee;
    const committeeName = committee && typeof committee === 'object'
      ? stringValue((committee as Record<string, unknown>).committee_name)
      : stringValue(committee);
    hearings.push({
      hearingId,
      startsAt: stringValue(event.hearing_start),
      date: stringValue(event.hearing_start)?.slice(0, 10) ?? date,
      committeeId: numberValue(event.cmte_id),
      committeeName,
      legislature,
      minutesPublic: event.hearing_minutes_public === 'Y',
      minutesUrl: minutesLink && legislature ? buildSenateHearingMinutesUrl(hearingId, legislature) : null,
      notes: stringValue(event.hearing_notes),
      agenda: event.agenda ?? null,
    });
  }
  return hearings;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[lr]dquo;/gi, '"')
    .replace(/&[lr]squo;/gi, "'")
    .replace(/&[mn]dash;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Plain text of a senate.mn minutes page, trimmed to the minutes body when it can be found. */
export function extractSenateMinutesText(html: string): string {
  const text = decodeHtml(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  const start = text.search(/^\s*Present\s*:/m);
  const fallbackStart = text.search(/called the meeting to order/i);
  const from = start >= 0 ? start : fallbackStart >= 0 ? text.lastIndexOf('\n', fallbackStart) + 1 : 0;
  const end = text.indexOf('About the Legislature', from);
  return text.slice(from, end > from ? end : undefined).trim();
}

/** Names on the minutes' "Present:" line, as printed (e.g. "Eric R. Pratt - Chair" → "Eric R. Pratt"). */
export function parseSenateMinutesPresent(text: string): string[] {
  const line = text.match(/^\s*Present\s*:\s*(.+)$/m)?.[1];
  if (!line) return [];
  return line
    .split(',')
    .map((name) => name.replace(/^\s*Senator\s+/i, '').replace(/\s+-\s+.*$/, '').trim())
    .filter((name) => /[A-Za-zÀ-ž]/.test(name));
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

async function fetchSenate(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`senate.mn returned ${response.status}: ${url}`);
  return response;
}

export async function listSenateHearingDates(from: string, to: string): Promise<string[]> {
  const response = await fetchSenate(`${SENATE_BASE}/api/schedule/allDates`);
  return parseSenateHearingDates(await response.json(), from, to);
}

export async function listSenateHearingsOnDate(date: string): Promise<SenateHearing[]> {
  const response = await fetchSenate(`${SENATE_BASE}/api/schedule/daily?date=${date}`);
  return parseSenateDailyHearings(await response.json(), date);
}

export async function fetchSenateMinutesHtml(url: string): Promise<string> {
  return (await fetchSenate(url)).text();
}
