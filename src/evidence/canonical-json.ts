/** Canonical comparison of JSON-compatible persisted values, including jsonb key order. */
export function canonicalJson(value:unknown):string {
  const clean=JSON.parse(JSON.stringify(value));
  const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'
    ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,ordered(x)])):v;
  return JSON.stringify(ordered(clean));
}
