import { waybackSnapshotUrl, type WaybackCapture } from './wayback';

export const WAYBACK_AVAILABILITY_URL = 'https://archive.org/wayback/available' as const;

type AvailabilityClosest = {
  available?: boolean;
  url?: string;
  timestamp?: string;
  status?: string;
};

type AvailabilityPayload = {
  archived_snapshots?: {
    closest?: AvailabilityClosest;
  };
};

function timestampIso(timestamp: string): string {
  if (!/^\d{14}$/.test(timestamp)) throw new Error('Wayback availability timestamp must have 14 digits');
  const parsed = new Date(
    timestamp.slice(0, 4) + '-' + timestamp.slice(4, 6) + '-' + timestamp.slice(6, 8) + 'T'
    + timestamp.slice(8, 10) + ':' + timestamp.slice(10, 12) + ':' + timestamp.slice(12, 14) + 'Z',
  );
  if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid Wayback availability timestamp');
  return parsed.toISOString();
}

function sameFrozenResource(a: URL, b: URL): boolean {
  return a.hostname.toLowerCase() === b.hostname.toLowerCase()
    && a.port === b.port
    && a.pathname === b.pathname
    && a.search === b.search;
}

export function parseWaybackAvailabilityCapture(
  payload: unknown,
  frozenSourceUrl: string,
): WaybackCapture | null {
  if (!payload || typeof payload !== 'object') return null;
  const closest = (payload as AvailabilityPayload).archived_snapshots?.closest;
  if (!closest?.available || closest.status !== '200' || !closest.url || !closest.timestamp) return null;
  if (!/^\d{14}$/.test(closest.timestamp)) return null;

  const replay = new URL(closest.url);
  if (!['http:', 'https:'].includes(replay.protocol) || replay.hostname.toLowerCase() !== 'web.archive.org') {
    throw new Error('Wayback availability returned an unexpected replay host');
  }

  const match = closest.url.match(/^https?:\/\/web\.archive\.org\/web\/(\d{14})(?:[a-z_]+)?\/(https?:\/\/.+)$/i);
  if (!match) throw new Error('Wayback availability replay URL could not be parsed');
  const replayTimestamp = match[1];
  if (replayTimestamp !== closest.timestamp) throw new Error('Wayback availability timestamp mismatch');

  const original = new URL(match[2]);
  const frozen = new URL(frozenSourceUrl);
  if (!sameFrozenResource(original, frozen)) {
    throw new Error('Wayback availability capture does not match the frozen source resource');
  }

  return {
    timestamp: closest.timestamp,
    original: original.toString(),
    mimetype: 'text/html',
    statuscode: '200',
    digest: '',
    length: null,
    capturedAt: timestampIso(closest.timestamp),
    archiveUrl: waybackSnapshotUrl(closest.timestamp, original.toString()),
  };
}

export async function discoverWaybackAvailabilityCapture(input: {
  url: string;
  timestamp: string;
  fetchImpl?: typeof fetch;
}): Promise<WaybackCapture | null> {
  const source = new URL(input.url);
  if (!['http:', 'https:'].includes(source.protocol)) throw new Error('Wayback availability requires an http(s) URL');
  if (!/^\d{14}$/.test(input.timestamp)) throw new Error('Wayback availability query timestamp must have 14 digits');

  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    url: source.toString(),
    timestamp: input.timestamp,
  });
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetchImpl(WAYBACK_AVAILABILITY_URL + '?' + params.toString(), {
        headers: {
          accept: 'application/json',
          'user-agent': 'VotePredict/2.0 historical-public-evidence',
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) {
        return parseWaybackAvailabilityCapture(await response.json(), source.toString());
      }
      const error = new Error('Wayback availability returned HTTP ' + response.status);
      if (![429, 500, 502, 503, 504].includes(response.status)) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, [1500, 4000, 8000][attempt]));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Wayback availability discovery failed');
}
