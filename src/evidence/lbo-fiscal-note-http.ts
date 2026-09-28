import { createHash } from 'node:crypto';

const LBO_HOST = 'mn.gov';
const LBO_PATH = '/mmbapps/fnsearchlbo/';
const MAX_REDIRECTS = 3;

export interface LboFiscalNotePage {
  requestedUrl: string;
  finalUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  contentSha256: string;
  bytes: number;
  rawContent: string;
  cookieCount: number;
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function allowedLboUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== LBO_HOST || url.pathname !== LBO_PATH) {
    throw new Error('Historical fiscal-note fetch left the fixed official LBO search endpoint');
  }
  return url;
}

function setCookieValues(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  const native = extended.getSetCookie?.();
  if (native?.length) return native;
  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
}

export class LboFiscalNoteSession {
  private readonly cookies = new Map<string, string>();

  private rememberCookies(headers: Headers) {
    for (const line of setCookieValues(headers)) {
      const matcher = /(?:^|,\s*)([A-Za-z0-9!#$%&'*+.^_\x60|~-]+)=([^;,\r\n]*)/g;
      for (const match of line.matchAll(matcher)) {
        const name = match[1]?.trim();
        if (!name) continue;
        this.cookies.set(name, match[2] ?? '');
      }
    }
  }

  private cookieHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()]
      .map(([name, value]) => name + '=' + value)
      .join('; ');
  }

  async fetchBill(input: {
    billIdentifier: string;
    sessionStartYear: number;
    timeoutMs?: number;
    maxBytes?: number;
  }): Promise<LboFiscalNotePage> {
    const requested = allowedLboUrl(
      'https://mn.gov/mmbapps/fnsearchlbo/?number='
      + encodeURIComponent(input.billIdentifier)
      + '&year='
      + input.sessionStartYear,
    );
    let current = requested;
    let response: Response | undefined;

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const cookie = this.cookieHeader();
      response = await fetch(current, {
        redirect: 'manual',
        headers: {
          'user-agent': 'VotePredict/2.0 historical-fiscal-note-backfill (public legislative research)',
          accept: 'text/html,application/xhtml+xml;q=0.9',
          ...(cookie ? { cookie } : {}),
        },
        signal: AbortSignal.timeout(input.timeoutMs ?? 25_000),
      });
      this.rememberCookies(response.headers);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Official fiscal-note redirect did not provide Location');
        current = allowedLboUrl(new URL(location, current).toString());
        continue;
      }
      break;
    }

    if (!response) throw new Error('Official fiscal-note search returned no response');
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      throw new Error('Official fiscal-note search exceeded redirect limit');
    }
    if (!response.ok) {
      throw new Error('Official fiscal-note search returned HTTP ' + response.status);
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!['text/html', 'application/xhtml+xml'].includes(contentType)) {
      throw new Error('Official fiscal-note search returned unsupported content type ' + contentType);
    }

    const declared = Number(response.headers.get('content-length'));
    const maxBytes = input.maxBytes ?? 3_000_000;
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error('Official fiscal-note response exceeds byte limit');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new Error('Official fiscal-note response exceeds byte limit');
    }
    const rawContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (rawContent.length < 100) throw new Error('Official fiscal-note response is unexpectedly short');

    return {
      requestedUrl: requested.toString(),
      finalUrl: current.toString(),
      fetchedAt: new Date().toISOString(),
      httpStatus: response.status,
      contentType,
      contentSha256: sha256(bytes),
      bytes: bytes.byteLength,
      rawContent,
      cookieCount: this.cookies.size,
    };
  }
}
