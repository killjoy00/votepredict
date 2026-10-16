/**
 * Versioned public source catalogs, loaded as bundled JSON and validated on
 * import. The checked-in JSON Schema is the authority for required fields,
 * allowed fields, types, enums and string patterns. Extra runtime checks cover
 * unique IDs, normalized URLs and actual calendar-date boundaries.
 *
 * Keeping bundled imports intentional: edits require a reviewed deployment;
 * this is NOT a live database catalog or a mutable production source list.
 */
import catalogSchema from '../../data/sources/source-catalog.schema.json';

export type PublicSourceCatalogKind = 'local_trade_news' | 'organization_publication';

type PropertyRule = {
  type?: 'string' | 'array';
  const?: unknown;
  enum?: readonly string[];
  minLength?: number;
  pattern?: string;
  format?: 'uri';
  items?: PropertyRule;
  uniqueItems?: boolean;
};
type ObjectRule = {
  required: readonly string[];
  additionalProperties: boolean;
  properties: Record<string, PropertyRule>;
};
type CatalogRule = ObjectRule & {
  properties: {
    schemaVersion: PropertyRule;
    kind: PropertyRule;
    sources: PropertyRule & { items: { $ref: string } };
  };
};
type SchemaDefinition = {
  oneOf: readonly CatalogRule[];
  $defs: Record<string, ObjectRule>;
};

const schema = catalogSchema as unknown as SchemaDefinition;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(label: string): never {
  throw new Error('Invalid public source catalog: ' + label);
}

function validateRule(value: unknown, rule: PropertyRule, label: string): void {
  if (Object.prototype.hasOwnProperty.call(rule, 'const') && value !== rule.const) fail(label);
  if (rule.type === 'string') {
    if (typeof value !== 'string' || (rule.minLength !== undefined && value.length < rule.minLength)) fail(label);
    if (rule.enum && !rule.enum.includes(value)) fail(label);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail(label);
    if (rule.format === 'uri') {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail(label);
      } catch {
        fail(label);
      }
    }
    return;
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || !rule.items) fail(label);
    for (const [index, item] of value.entries()) validateRule(item, rule.items, label + '[' + index + ']');
    if (rule.uniqueItems && new Set(value).size !== value.length) fail(label);
    return;
  }
  if (rule.type !== undefined) fail(label);
}

function validateObject(value: unknown, rule: ObjectRule, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail(label);
  for (const field of rule.required) if (!Object.prototype.hasOwnProperty.call(value, field)) fail(label + '.' + field);
  for (const [field, entry] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(rule.properties, field)) {
      if (!rule.additionalProperties) fail(label + '.' + field);
      continue;
    }
    const property = rule.properties[field];
    // The nested sources array is validated by loadPublicSourceCatalog.
    if (field !== 'sources') validateRule(entry, property, label + '.' + field);
  }
}

function validateCalendarDay(value: string, label: string): void {
  if (!/^[0-9]{8}$/.test(value)) fail(label);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) fail(label);
}

/** Return exactly the original ordered seed records, without normalization or deduplication. */
export function loadPublicSourceCatalog<Seed extends object>(
  input: unknown,
  expectedKind: PublicSourceCatalogKind,
): readonly Seed[] {
  const variant = schema.oneOf.find(item => item.properties.kind.const === expectedKind);
  if (!variant || !schema.$defs) fail('unrecognized catalog schema');
  validateObject(input, variant, expectedKind);
  if (input.kind !== expectedKind || !Array.isArray(input.sources) || input.sources.length < 1)
    fail(expectedKind + '.sources');
  const pointer = variant.properties.sources.items.$ref;
  if (!pointer.startsWith('#/$defs/')) fail('catalog source reference');
  const seedRule = schema.$defs[pointer.slice('#/$defs/'.length)];
  if (!seedRule) fail('catalog source definition');

  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const [index, rawSeed] of input.sources.entries()) {
    const label = expectedKind + '.sources[' + index + ']';
    validateObject(rawSeed, seedRule, label);
    const id = rawSeed.id;
    const url = rawSeed.url;
    const from = rawSeed.from;
    const to = rawSeed.to;
    if (typeof id !== 'string' || typeof url !== 'string' ||
        typeof from !== 'string' || typeof to !== 'string') fail(label);
    if (ids.has(id)) fail(label + '.duplicate-id');
    ids.add(id);
    const normalizedUrl = new URL(url).href;
    if (urls.has(normalizedUrl)) fail(label + '.duplicate-url');
    urls.add(normalizedUrl);
    validateCalendarDay(from, label + '.from');
    validateCalendarDay(to, label + '.to');
    if (from > to) fail(label + '.date-window');
  }
  return input.sources as Seed[];
}
