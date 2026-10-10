/**
 * Issue #864: BOUNDED PUBLIC CFB "current lists" source-shape probe.
 * Only inspects publicly available HTML/JS metadata and response schemas.
 * Does not retain respondent rows, addresses, contacts, donors or report PDFs.
 * Never infer historical active registrations or filings from a current list.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const ORIGIN = 'https://register.cfb.mn.gov';
const APP = ORIGIN + '/reports/current-lists/';
const API = ORIGIN + '/reports/api/';
const USER_AGENT = 'Mozilla/5.0 VotePredict/2.0 cfb-public-current-lists-shape-audit';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

async function getBounded(url: string, init: RequestInit = {}): Promise<{ text: string; url: string; status: number; cookies: string[] }> {
  const target = new URL(url, ORIGIN);
  if (target.protocol !== 'https:' || target.hostname !== 'register.cfb.mn.gov') throw Error('Nonofficial URL');
  const response = await fetch(target.toString(), {
    ...init, redirect: 'follow', signal: AbortSignal.timeout(25_000),
    headers: { 'user-agent': USER_AGENT, ...(init.headers as Record<string, string> ?? {}) },
  });
  const final = new URL(response.url);
  if (final.protocol !== 'https:' || final.hostname !== 'register.cfb.mn.gov') throw Error('Unexpected redirect host');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 8_000_000) throw Error('Public response exceeded 8 MB');
  const text = new TextDecoder().decode(bytes);
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = (typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [response.headers.get('set-cookie') ?? ''].filter(Boolean))
    .map(s => s.split(';', 1)[0]!.trim()).filter(Boolean);
  return {text, url:final.toString(), status:response.status, cookies};
}

function readScriptSrc(html: string): string[] {
  const paths: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const u = new URL(match[1]!, ORIGIN);
    if (u.hostname === 'register.cfb.mn.gov' && u.protocol === 'https:' &&
      !paths.includes(u.toString())) paths.push(u.toString());
  }
  return paths.slice(0, 16);
}

function exposePossiblePublicListIdentifiers(js: string) {
  const tokens = [...js.matchAll(/(?:candidate|committee|terminated|registr)[a-z0-9_-]{0,65}/gi)]
    .map(x => x[0]!).filter(x => x.length >= 8);
  return [...new Set(tokens)].sort().slice(0, 100);
}

function publicGridShape(json: any) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {kind:'not-json-object'};
  const root = json as Record<string, unknown>;
  const cols = Array.isArray(root.cols) ? root.cols.filter(x => typeof x === 'string') as string[] : [];
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data as Record<string, unknown> : {};
  const maybeRows = Object.values(data).filter(x => Array.isArray(x)) as unknown[][];
  const rows = maybeRows.flatMap(x => x);
  const regIndex = cols.findIndex(s => /RegisteredEntityID|registration.*(?:id|num)|regnum/i.test(s));
  const officeIndex = cols.findIndex(s => /office|chamber/i.test(s));
  const sampleRegistrationIds = regIndex >= 0 ? [...new Set(rows.map(x => Array.isArray(x) ? String(x[regIndex] ?? '').trim() : '')
    .filter(x => /^\d{3,8}$/.test(x)))].slice(0, 8) : [];
  const officeValues = officeIndex >= 0 ? [...new Set(rows.map(x => Array.isArray(x) ? String(x[officeIndex] ?? '').trim() : '')
    .filter(Boolean))].slice(0, 20) : [];
  const dateFieldIndexes = cols.map((name,i) => ({name,i}))
    .filter(field => /(?:registration|termination|filed|due).*date|date.*(?:registration|termination)/i.test(field.name));
  const dateFieldProof = dateFieldIndexes.map(field=>({
    name:field.name,
    populatedCount:rows.filter(row=>Array.isArray(row)&&Boolean(row[field.i])).length,
    dateSamples:[...new Set(rows.map(row=>Array.isArray(row)?String(row[field.i]??'').trim():'').filter(Boolean))].slice(0,5),
  }));
  return {
    rootFields: Object.keys(root).slice(0, 20),
    columns: cols.slice(0, 90), reportedRowCount: root.row_count ?? null,
    entityBucketCount: Object.keys(data).length, visibleArrayRowCount: rows.length,
    candidateRegistrationIdColumn: regIndex >= 0 ? cols[regIndex] : null,
    sampleCandidateRegistrationIds: sampleRegistrationIds,
    possibleOfficeColumn: officeIndex >= 0 ? cols[officeIndex] : null,
    possibleOfficeValues: officeValues, dateFieldProof,
    has18443: rows.some(x => Array.isArray(x) && x.some(y => String(y) === '18443')),
    has19205: rows.some(x => Array.isArray(x) && x.some(y => String(y) === '19205')),
  };
}

async function probeAction(kind: string, cookie: string) {
  const params = new URLSearchParams();
  params.set('action','grid_data');
  params.set('data[action]',kind);
  params.set('data[type]','current-lists');
  params.set('data[params][0]','all');
  try {
    const r = await getBounded(API, {
      method:'POST',
      headers:{
        'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with':'XMLHttpRequest',
        'referer':APP, cookie,
      }, body:params.toString()
    });
    let shape: unknown;
    try { shape = publicGridShape(JSON.parse(r.text)); }
    catch { shape = {kind:'non-JSON API response', possibleErrorTokens:r.text.match(/(?:error|invalid|unknown|not found)/ig)?.length ?? 0}; }
    console.log(JSON.stringify({action:kind,apiUrl:r.url,httpStatus:r.status,
      responseBytes:Buffer.byteLength(r.text),apiBodySha256:hash(r.text),shape}));
  } catch (error) {
    console.log(JSON.stringify({action:kind,status:'source_probe_failed',
      error:(error instanceof Error?error.message:String(error)).slice(0,140)}));
  }
}


function currentListNavigationContexts(html: string) {
  const labels = [
    'All registered candidate committees', 'Current candidate reports',
    'Recent candidate committee registrations',
    'Recently terminated candidate committee registrations',
    'Candidates who have not filed current reports',
    'candidate-registrations', 'candidate-reports',
  ];
  const results = [];
  for (const label of labels) {
    const offset = html.toLowerCase().indexOf(label.toLowerCase());
    const snippet = offset >= 0
      ? html.slice(Math.max(0,offset-600),Math.min(html.length,offset+450))
          .replace(/\s+/g,' ').replace(/(?:\d[\d -]{7,}\d)/g,'[possible-contact]').slice(0,1100)
      : null;
    results.push({label,found:offset>=0,htmlContext:snippet});
  }
  return results;
}

function relevantPublicScriptLiterals(js: string) {
  const hits: string[] = [];
  for (const m of js.matchAll(/["']([^"'<>]{0,80}(?:candidate|registr|terminat)[^"'<>]{0,90})["']/gi)) {
    const value = m[1]!.trim();
    if (!hits.includes(value)) hits.push(value);
    if (hits.length >= 60) break;
  }
  return hits;
}


async function probeOfficialGridInfo(kind: string, cookie: string) {
  const params = new URLSearchParams();
  params.set('action','grid_info');
  params.set('data[action]',kind);
  params.set('data[type]','current-lists');
  params.set('data[params][0]','all');
  try {
    const r = await getBounded(API, {
      method:'POST',
      headers:{
        'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with':'XMLHttpRequest',
        'referer':APP, cookie,
      }, body:params.toString()
    });
    let data: unknown;
    try { data=JSON.parse(r.text); } catch { data=null; }
    const obj = data && typeof data==='object' && !Array.isArray(data)
      ? data as Record<string,unknown> : null;
    const info = obj && obj.info && typeof obj.info==='object' && !Array.isArray(obj.info)
      ? obj.info as Record<string,unknown> : null;
    const fields = obj ? Object.keys(obj).slice(0,25) : [];
    const displayDescription = info && typeof info.description === 'string'
      ? info.description.slice(0,180) : null;
    const linkNames = info && Array.isArray(info.links)
      ? info.links.slice(0,15).map(x => x && typeof x === 'object' &&
          typeof x.name === 'string' ? x.name.slice(0,80) : null).filter(Boolean) : [];
    console.log(JSON.stringify({type:'official-current-list-grid-info',
      action:kind,status:r.status,sha256:hash(r.text),responseBytes:Buffer.byteLength(r.text),
      validInfoObject:!!info,rootKeys:fields,description:displayDescription,links:linkNames,
      infoFields:info?Object.keys(info).slice(0,30):[],
      gridColumnNames:obj && Array.isArray(obj.cols)?obj.cols.filter(x=>typeof x==='string').slice(0,80):[],
      emptyPayload:!obj || fields.length===0}));
  } catch(error) {
    console.log(JSON.stringify({type:'official-current-list-grid-info',action:kind,status:'fetch_failed',
      error:(error instanceof Error?error.message:String(error)).slice(0,120)}));
  }
}

async function main() {
  const page = await getBounded(APP);
  console.log(JSON.stringify({type:'official-app-shell',status:page.status,url:page.url,
    htmlBytes:Buffer.byteLength(page.text),htmlSha256:hash(page.text),
    scriptSources:readScriptSrc(page.text)}));
  console.log(JSON.stringify({type:'official-static-current-list-menu-context',items:currentListNavigationContexts(page.text)}));
  let cookies = page.cookies.join('; ');
  for (const src of readScriptSrc(page.text)) {
    try {
      const file = await getBounded(src);
      // Save only public program JS for offline endpoint routing inspection.
      // No raw app HTML, API response rows, donor/committee contact details.
      const scriptFilename = new URL(src).pathname;
      const knownName = /^\/cache\/(default|app|site)\.[a-f0-9]+\.js$/.exec(scriptFilename)?.[1];
      if (knownName && file.status === 200) {
        mkdirSync('artifacts/cfb-public-js', { recursive: true });
        writeFileSync('artifacts/cfb-public-js/' + knownName + '.js', file.text, {encoding:'utf8',flag:'w'});
      }
      const tokens = exposePossiblePublicListIdentifiers(file.text);
      const relevant = tokens.filter(s => /candidate|registr|terminated/i.test(s));
      console.log(JSON.stringify({type:'public-script-source-shape',url:src,status:file.status,
        responseBytes:Buffer.byteLength(file.text),sha256:hash(file.text),
        sourceCandidateListIdentifiers:relevant.slice(0,70),publicCandidateStringLiterals:relevantPublicScriptLiterals(file.text)}));
    } catch(e) {
      console.log(JSON.stringify({type:'script_fetch_failed',url:src,error:(e instanceof Error?e.message:String(e)).slice(0,120)}));
    }
  }
  // First is an existing known-good app action from the repository. The
  // candidate-registrations action is explicitly a HYPOTHESIS under test.
  for (const action of ['candidate-reports','all-registered-candidates','recent-candidate-registrations','recent-candidate-terminations']) {
    await probeAction(action,cookies);
  }
  const candidateListHypotheses = [
    'recent-candidate-registrations',
    'all-candidate-registrations',
    'all-registered-candidate-committees',
    'all-registered-candidates',
    'candidate-registration-list',
    'recently-terminated-candidate-registrations',
    'recent-candidate-terminations',
    'terminated-candidate-registrations',
    'recent-terminated-candidate-registrations',
    'candidate-reports-not-filed',
  ];
  for (const action of candidateListHypotheses) {
    await probeOfficialGridInfo(action,cookies);
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1});
