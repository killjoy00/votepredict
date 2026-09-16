import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DEFAULT_MAX_BYTES = 1_500_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'source']);

export interface PublicPage {
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  contentSha256: string;
  bytes: number;
  title?: string;
  publishedAt?: string;
  rawContent: string;
  text: string;
  excerpt: string;
  links: string[];
}

export interface PublicFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  allowContentTypes?: string[];
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalizeWhitespace(value: string): string {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

export function canonicalPublicUrl(value: string, base?: string): string {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported public evidence protocol: ${url.protocol}`);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return url.toString();
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || a >= 224;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb')
      || normalized.startsWith('::ffff:127.')
      || normalized.startsWith('::ffff:10.')
      || normalized.startsWith('::ffff:192.168.');
  }
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error(`Private hostname is not allowed: ${hostname || '(empty)'}`);
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error(`Private address is not allowed: ${hostname}`);
    return;
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error(`No DNS address resolved for ${hostname}`);
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error(`Hostname resolves to a non-public address: ${hostname}`);
  }
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`Public evidence response exceeds ${maxBytes} bytes`);
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`Public evidence response exceeds ${maxBytes} bytes`);
    }
    chunks.push(result.value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function metaValue(html: string, names: readonly string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const forward = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i');
    const match = html.match(forward) ?? html.match(reverse);
    if (match?.[1]) return normalizeWhitespace(match[1]);
  }
  return undefined;
}

function publishedAt(html: string): string | undefined {
  const raw = metaValue(html, [
    'article:published_time',
    'datePublished',
    'date',
    'pubdate',
    'publishdate',
    'parsely-pub-date',
  ]);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function htmlTitle(html: string): string | undefined {
  const meta = metaValue(html, ['og:title', 'twitter:title']);
  if (meta) return meta;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? normalizeWhitespace(match[1]) : undefined;
}

function extractText(html: string): string {
  return normalizeWhitespace(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function extractLinks(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi)) {
    try {
      const canonical = canonicalPublicUrl(decodeEntities(match[1]), baseUrl);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      links.push(canonical);
    } catch {
      // Ignore mailto/javascript/malformed links.
    }
  }
  return links;
}

function normalizePersonText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function publicPageMentionsPerson(text: string, personName: string): boolean {
  const tokens = normalizePersonText(personName)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !new Set(['jr', 'sr', 'ii', 'iii', 'iv']).has(token));
  if (tokens.length < 2) return false;

  const variants = new Set<string>();
  variants.add(tokens.join(' '));
  const withoutInitials = tokens.filter((token, index) => index === 0 || index === tokens.length - 1 || token.length > 1);
  variants.add(withoutInitials.join(' '));
  variants.add(`${tokens[0]} ${tokens[tokens.length - 1]}`);

  const haystack = ` ${normalizePersonText(text)} `;
  return [...variants]
    .filter((variant) => variant.split(' ').length >= 2)
    .some((variant) => haystack.includes(` ${variant} `));
}

export async function fetchPublicPage(rawUrl: string, options: PublicFetchOptions = {}): Promise<PublicPage> {
  const requestedUrl = canonicalPublicUrl(rawUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const allowContentTypes = options.allowContentTypes ?? ['text/html', 'text/plain', 'application/xhtml+xml'];
  let current = requestedUrl;
  let response: Response | undefined;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const url = new URL(current);
    await assertPublicHost(url);
    response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': options.userAgent ?? 'VotePredict/2.0 public-evidence-pipeline',
        accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect without Location from ${current}`);
      current = canonicalPublicUrl(location, current);
      continue;
    }
    break;
  }

  if (!response) throw new Error(`No response returned for ${requestedUrl}`);
  if ([301, 302, 303, 307, 308].includes(response.status)) throw new Error(`Too many redirects for ${requestedUrl}`);
  if (!response.ok) throw new Error(`Public evidence fetch returned HTTP ${response.status} for ${current}`);
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!allowContentTypes.some((allowed) => contentType === allowed || contentType.startsWith(`${allowed};`))) {
    throw new Error(`Unsupported public evidence content type ${contentType || '(missing)'} for ${current}`);
  }
  const bytes = await readLimitedBody(response, maxBytes);
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const htmlLike = contentType.includes('html');
  const text = htmlLike ? extractText(decoded) : normalizeWhitespace(decoded);
  if (text.length < 40) throw new Error(`Public evidence page has too little readable text: ${current}`);
  const finalUrl = canonicalPublicUrl(current);
  return {
    requestedUrl,
    finalUrl,
    canonicalUrl: finalUrl,
    fetchedAt: new Date().toISOString(),
    httpStatus: response.status,
    contentType,
    contentSha256: sha256(bytes),
    bytes: bytes.byteLength,
    title: htmlLike ? htmlTitle(decoded) : undefined,
    publishedAt: htmlLike ? publishedAt(decoded) : undefined,
    rawContent: decoded,
    text,
    excerpt: text.slice(0, 1600),
    links: htmlLike ? extractLinks(decoded, finalUrl) : [],
  };
}
