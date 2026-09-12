import { createHash } from 'node:crypto';
import { HISTORICAL_DEEP_PILOT_CASES, type HistoricalDeepPilotSpec } from './historical-deep-pilot';

export const HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA = 'historical-deep-source-catalog-v1' as const;
export const HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA = 'historical-deep-source-bundle-v1' as const;

export type HistoricalDeepSourceClass = 'revisor_bill_text' | 'house_committee_record';

export interface HistoricalDeepSourceCatalogCase {
  session: string;
  chamber: string;
  identifier: string;
  occurredOn: string;
}

export interface HistoricalDeepSourceCatalogEntry {
  case: HistoricalDeepSourceCatalogCase;
  id: string;
  sourceClass: HistoricalDeepSourceClass;
  url: string;
  title: string;
  publishedAt: string;
  expectedMarkers: string[];
}

export interface HistoricalDeepSourceCatalog {
  schemaVersion: typeof HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA;
  jurisdictionSlug: string;
  sources: HistoricalDeepSourceCatalogEntry[];
}

export interface HistoricalDeepCollectedSource extends HistoricalDeepSourceCatalogEntry {
  fetchedAt: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  bytes: number;
  contentSha256: string;
  content: string;
}

export interface HistoricalDeepSourceBundle {
  schemaVersion: typeof HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA;
  catalogSchemaVersion: typeof HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA;
  jurisdictionSlug: string;
  generatedAt: string;
  sourceCount: number;
  caseCount: number;
  sources: HistoricalDeepCollectedSource[];
}

const ALLOWED_HOSTS = new Set([
  'revisor.mn.gov',
  'www.revisor.mn.gov',
  'house.mn.gov',
  'www.house.mn.gov',
]);

function timestamp(value: string): number | undefined {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function historicalDeepSourceCaseKey(value: HistoricalDeepSourceCatalogCase): string {
  return `${value.session}|${value.chamber}|${value.identifier}|${value.occurredOn}`;
}

function pilotCaseKey(value: HistoricalDeepPilotSpec): string {
  return historicalDeepSourceCaseKey(value);
}

function urlError(entry: HistoricalDeepSourceCatalogEntry): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(entry.url);
  } catch {
    return `source ${entry.id} has an invalid URL`;
  }
  if (parsed.protocol !== 'https:') return `source ${entry.id} must use https`;
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return `source ${entry.id} uses unapproved host ${parsed.hostname}`;
  }
  if (entry.sourceClass === 'revisor_bill_text') {
    if (!/^\/bills\/\d+\/\d+\/\d+\/HF\/\d+\/versions\/\d+\/?$/i.test(parsed.pathname)) {
      return `source ${entry.id} must use an exact Revisor bill-version URL`;
    }
  }
  if (entry.sourceClass === 'house_committee_record') {
    if (!/^\/committees\/minutes\/\d+\/\d+\/?$/i.test(parsed.pathname)) {
      return `source ${entry.id} must use an exact House committee-minutes URL`;
    }
  }
  return undefined;
}

export function historicalDeepSourceCatalogErrors(catalog: HistoricalDeepSourceCatalog): string[] {
  const errors: string[] = [];
  if (catalog.schemaVersion !== HISTORICAL_DEEP_SOURCE_CATALOG_SCHEMA) {
    errors.push(`unsupported catalog schema: ${String(catalog.schemaVersion)}`);
  }
  if (catalog.jurisdictionSlug !== 'us-mn') errors.push('historical Deep source catalog must target us-mn');
  if (!Array.isArray(catalog.sources) || catalog.sources.length === 0) errors.push('source catalog is empty');

  const pilotKeys = new Set(HISTORICAL_DEEP_PILOT_CASES.map(pilotCaseKey));
  const coveredPilotKeys = new Set<string>();
  const ids = new Set<string>();
  const urls = new Set<string>();

  for (const entry of catalog.sources ?? []) {
    if (!entry.id?.trim()) errors.push('source id is required');
    if (ids.has(entry.id)) errors.push(`duplicate source id: ${entry.id}`);
    ids.add(entry.id);
    if (urls.has(entry.url)) errors.push(`duplicate source URL: ${entry.url}`);
    urls.add(entry.url);

    const key = historicalDeepSourceCaseKey(entry.case);
    if (!pilotKeys.has(key)) {
      errors.push(`source ${entry.id} targets an unknown pilot case: ${key}`);
    } else {
      coveredPilotKeys.add(key);
    }

    const publishedAt = timestamp(entry.publishedAt);
    const voteDay = timestamp(`${entry.case.occurredOn}T00:00:00.000Z`);
    if (publishedAt === undefined) {
      errors.push(`source ${entry.id} has invalid publishedAt`);
    } else if (voteDay === undefined) {
      errors.push(`source ${entry.id} has invalid vote date`);
    } else if (publishedAt >= voteDay) {
      errors.push(`source ${entry.id} is not strictly before the vote date`);
    }

    const invalidUrl = urlError(entry);
    if (invalidUrl) errors.push(invalidUrl);
    if (!entry.title?.trim()) errors.push(`source ${entry.id} requires a title`);
    if (!Array.isArray(entry.expectedMarkers) || entry.expectedMarkers.length < 2) {
      errors.push(`source ${entry.id} requires at least two expected markers`);
    } else if (entry.expectedMarkers.some((marker) => !marker.trim())) {
      errors.push(`source ${entry.id} has an empty expected marker`);
    }
  }

  for (const spec of HISTORICAL_DEEP_PILOT_CASES) {
    const key = pilotCaseKey(spec);
    if (!coveredPilotKeys.has(key)) errors.push(`pilot case has no cataloged sources: ${key}`);
  }

  return errors;
}

function htmlText(content: string): string {
  return content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function historicalDeepSourceContentErrors(
  entry: HistoricalDeepSourceCatalogEntry,
  input: { status: number; finalUrl: string; contentType: string; bytes: Buffer },
): string[] {
  const errors: string[] = [];
  if (input.status < 200 || input.status >= 300) errors.push(`HTTP ${input.status}`);
  if (!/text\/html/i.test(input.contentType)) errors.push(`unexpected content type ${input.contentType || 'unknown'}`);
  if (input.bytes.length === 0) errors.push('empty response body');
  if (input.bytes.length > 5_000_000) errors.push(`response exceeds 5 MB (${input.bytes.length} bytes)`);
  let finalUrl: URL | undefined;
  try {
    finalUrl = new URL(input.finalUrl);
  } catch {
    errors.push('invalid final URL');
  }
  if (finalUrl && !ALLOWED_HOSTS.has(finalUrl.hostname.toLowerCase())) {
    errors.push(`redirected to unapproved host ${finalUrl.hostname}`);
  }
  const text = htmlText(input.bytes.toString('utf8')).toLowerCase();
  for (const marker of entry.expectedMarkers) {
    if (!text.includes(marker.toLowerCase())) errors.push(`missing expected marker: ${marker}`);
  }
  return errors;
}

export function collectedHistoricalDeepSource(
  entry: HistoricalDeepSourceCatalogEntry,
  input: { fetchedAt: string; status: number; finalUrl: string; contentType: string; bytes: Buffer },
): HistoricalDeepCollectedSource {
  const errors = historicalDeepSourceContentErrors(entry, input);
  if (errors.length > 0) throw new Error(`Historical source ${entry.id} failed validation: ${errors.join('; ')}`);
  return {
    ...entry,
    fetchedAt: input.fetchedAt,
    finalUrl: input.finalUrl,
    httpStatus: input.status,
    contentType: input.contentType,
    bytes: input.bytes.length,
    contentSha256: createHash('sha256').update(input.bytes).digest('hex'),
    content: input.bytes.toString('utf8'),
  };
}

export function buildHistoricalDeepSourceBundle(
  catalog: HistoricalDeepSourceCatalog,
  sources: HistoricalDeepCollectedSource[],
  generatedAt = new Date().toISOString(),
): HistoricalDeepSourceBundle {
  const errors = historicalDeepSourceCatalogErrors(catalog);
  if (errors.length > 0) throw new Error(`Invalid historical Deep source catalog: ${errors.join('; ')}`);
  const expectedIds = new Set(catalog.sources.map((entry) => entry.id));
  const actualIds = new Set(sources.map((entry) => entry.id));
  if (expectedIds.size !== actualIds.size || [...expectedIds].some((id) => !actualIds.has(id))) {
    throw new Error('Collected source set does not exactly match catalog');
  }
  return {
    schemaVersion: HISTORICAL_DEEP_SOURCE_BUNDLE_SCHEMA,
    catalogSchemaVersion: catalog.schemaVersion,
    jurisdictionSlug: catalog.jurisdictionSlug,
    generatedAt,
    sourceCount: sources.length,
    caseCount: new Set(sources.map((entry) => historicalDeepSourceCaseKey(entry.case))).size,
    sources,
  };
}
