/**
 * #310 offline-only P8 enrollment / daily-gap reconciliation.
 *
 * An externally supplied list of bill IDs is NOT proof of the full official
 * introduced-bill universe. Only measure coverage against that supplied
 * snapshot. Never compute predictions, train, promote, mutate a database, or
 * certify P8's frozen production thresholds from these numbers.
 */
import { createHash } from 'node:crypto';
import {
  P8_DAILY_CAPTURE_SESSION, P8_DAILY_CAPTURE_TIMEZONE,
  type P8DailyCaptureBatch,
} from './lifecycle-p8-daily-capture';
import { verifyOfflineP8BatchIntegrity } from './lifecycle-p8-offline-store';

export const P8_UNIVERSE_AUDIT_SCHEMA = 'lifecycle-p8-supplied-universe-coverage-v1' as const;
export const P8_UNIVERSE_PROOF = 'supplied-list-not-independent-official-enumeration' as const;
type Chamber = 'house' | 'senate';

export interface P8SuppliedUniverseRow {
  billId: string;
  identifier: string;
  firstObservedAt: string;
}
export interface P8SuppliedUniverseIndex {
  schemaVersion: typeof P8_UNIVERSE_AUDIT_SCHEMA;
  session: typeof P8_DAILY_CAPTURE_SESSION;
  cutoffDateExclusive: string;
  source: {
    sourceUrl: string;
    sourceSha256: string;
    observedAt: string;
    proofLevel: typeof P8_UNIVERSE_PROOF;
  };
  bills: P8SuppliedUniverseRow[];
  contentSha256: string;
}
function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function exactKeys(value: unknown, allowed: string[], label: string) {
  if (!value || typeof value!=='object' || Array.isArray(value) ||
    Object.keys(value).sort().join('|')!==allowed.sort().join('|'))
    throw Error('Unexpected '+label+' keys or outcome fields');
}
function exactDate(value: string): string {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value+'T00:00:00Z')) ||
      new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)
    throw Error('Invalid P8 cutoff date');
  return value;
}
function chicagoInstant(value: string):string {
  if(typeof value!=='string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString()!==value)
    throw Error('P8 universe source timestamp must be canonical UTC');
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:P8_DAILY_CAPTURE_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date(value));
  const part=(kind:string)=>parts.find(x=>x.type===kind)?.value;
  return [part('year'),part('month'),part('day')].join('-');
}
function checkId(identifier:string):Chamber {
  if (typeof identifier!=='string'|| !/^(HF|SF)[1-9]\d{0,5}$/.test(identifier))
    throw Error('Unexpected or noncanonical P8 HF/SF identifier');
  return identifier.startsWith('HF')?'house':'senate';
}
function checkSource(source:P8SuppliedUniverseIndex['source'],cutoff:string) {
  exactKeys(source,['sourceUrl','sourceSha256','observedAt','proofLevel'],'manifest source');
  let url:URL;
  try {url=new URL(source.sourceUrl)}catch{throw Error('Invalid P8 universe source')}
  if(url.protocol!=='https:' ||
    !['api.revisor.mn.gov','www.revisor.mn.gov','revisor.mn.gov'].includes(url.hostname) ||
    url.username || url.password || url.search || url.hash ||
    !/^[a-f0-9]{64}$/.test(source.sourceSha256) ||
    source.proofLevel!==P8_UNIVERSE_PROOF ||
    chicagoInstant(source.observedAt)>=cutoff)
    throw Error('Untrusted or post-cutoff P8 universe source');
}
export function sealP8SuppliedUniverseIndex(input:Omit<P8SuppliedUniverseIndex,'contentSha256'>):
  P8SuppliedUniverseIndex {
  exactKeys(input,['schemaVersion','session','cutoffDateExclusive','source','bills'],
    'supplied manifest');
  if(input.schemaVersion!==P8_UNIVERSE_AUDIT_SCHEMA ||
    input.session!==P8_DAILY_CAPTURE_SESSION)
    throw Error('P8 supplied universe is not a 2027-2028 as-of index');
  const cutoff=exactDate(input.cutoffDateExclusive);
  if(cutoff<'2027-01-01'||cutoff>'2028-12-31')throw Error('P8 universe cutoff outside 2027-28');
  checkSource(input.source,cutoff);
  if(!Array.isArray(input.bills)||input.bills.length>40000)
    throw Error('Unbounded P8 supplied universe');
  const ids=new Set<string>(),identifiers=new Set<string>();
  for(const bill of input.bills){
    exactKeys(bill,['billId','identifier','firstObservedAt'],'universe bill');
    checkId(bill.identifier);
    if(typeof bill.billId!=='string'|| !/^[a-zA-Z0-9_-]{1,96}$/.test(bill.billId) ||
      ids.has(bill.billId)||identifiers.has(bill.identifier))
      throw Error('Duplicate or invalid stable P8 bill identity');
    ids.add(bill.billId);identifiers.add(bill.identifier);
    if(chicagoInstant(bill.firstObservedAt)>=cutoff ||
      bill.firstObservedAt>input.source.observedAt)
      throw Error('P8 future-observed bill cannot appear in the earlier universe');
  }
  const bills=[...input.bills].sort((a,b)=>a.billId.localeCompare(b.billId))
    .map(row=>({...row}));
  const content={schemaVersion:input.schemaVersion,session:input.session,
    cutoffDateExclusive:input.cutoffDateExclusive,
    source:{...input.source},bills};
  return {...content,contentSha256:sha256(content)};
}
export function verifyP8SuppliedUniverseIndex(manifest:P8SuppliedUniverseIndex):void {
  exactKeys(manifest,
    ['schemaVersion','session','cutoffDateExclusive','source','bills','contentSha256'],
    'sealed universe');
  const {contentSha256,...input}=manifest;
  const expected=sealP8SuppliedUniverseIndex(input);
  if(expected.contentSha256!==contentSha256 ||
    JSON.stringify(expected.bills)!==JSON.stringify(manifest.bills))
    throw Error('Modified or nondeterministic P8 supplied universe index');
}
export function auditP8OfflineUniverseCoverage(
  manifest:P8SuppliedUniverseIndex,batch:P8DailyCaptureBatch,
){
  verifyP8SuppliedUniverseIndex(manifest);
  verifyOfflineP8BatchIntegrity(batch);
  if(batch.cutoffDateExclusive!==manifest.cutoffDateExclusive ||
    batch.session!==manifest.session ||
    batch.source!=='offline_observed_revisor_receipts' &&
    batch.source!=='offline_supplied_asof_fixtures')
    throw Error('P8 daily/manifest cutoff or source mismatch');
  const byId=new Map(manifest.bills.map(b=>[b.billId,b]));
  for (const row of batch.rows){
    const expected=byId.get(row.bill.billId);
    if(!expected||expected.identifier!==row.bill.identifier ||
      chicagoInstant(row.lineage.firstObservedAt)>=manifest.cutoffDateExclusive)
      throw Error('P8 daily capture includes unenumerated or post-cutoff bill');
    if(row.lineage.eligibleProcessEvents.some(e=>
      chicagoInstant(e.observedAt)>=manifest.cutoffDateExclusive ||
      e.occurredOn>=manifest.cutoffDateExclusive) ||
      row.lineage.eligibleBillVersions.some(v=>
      chicagoInstant(v.observedAt)>=manifest.cutoffDateExclusive ||
      v.publishedOn>=manifest.cutoffDateExclusive))
      throw Error('P8 daily capture contains post-cutoff event or version');
  }
  const captured=new Set(batch.rows.map(r=>r.bill.billId));
  const missing=manifest.bills.filter(b=>!captured.has(b.billId))
    .map(b=>b.identifier).sort();
  const chambers:Record<Chamber,{expected:number;captured:number;parsed:number}>={
    house:{expected:0,captured:0,parsed:0},
    senate:{expected:0,captured:0,parsed:0},
  };
  for (const b of manifest.bills)chambers[checkId(b.identifier)].expected++;
  for (const r of batch.rows) {
    const slot=chambers[r.bill.chamber];
    slot.captured++;
    if(r.lineage.processStatus==='parsed' && r.lineage.processSourceEligible)slot.parsed++;
  }
  const parsed=chambers.house.parsed+chambers.senate.parsed;
  const coverage={
    suppliedManifestCount:manifest.bills.length,
    capturedRows:batch.rows.length,
    missingRows:missing.length,
    processSourceParsedRows:parsed,
    missingPublicIdentifierPreview:missing.slice(0,12),
    missingPreviewTruncated:missing.length>12,
    byChamber:chambers,
  };
  const content={
    schemaVersion:P8_UNIVERSE_AUDIT_SCHEMA,
    session:P8_DAILY_CAPTURE_SESSION,
    cutoffDateExclusive:batch.cutoffDateExclusive,
    manifestContentSha256:manifest.contentSha256,
    dailyContentSha256:batch.contentSha256,
    suppliedUniverseOnly:true as const,
    independentOfficialDenominatorVerified:false as const,
    publicationTimeIndependentlyVerified:false as const,
    futureSessionOutcomesRead:false as const,
    predictionsComputed:false as const,
    productionCaptureActivated:false as const,
    servingChanged:false as const,
    primaryProspectiveScoringAllowed:false as const,
    captureSource:batch.source,
    coverage,
  };
  return {...content,contentSha256:sha256(content)};
}
/** Source-lineage continuity only; no future event/outcome is considered. */
export function auditP8OfflineCaptureContinuity(input:{
  previousManifest:P8SuppliedUniverseIndex;
  previousBatch:P8DailyCaptureBatch;
  currentManifest:P8SuppliedUniverseIndex;
  currentBatch:P8DailyCaptureBatch;
}) {
  const previous=auditP8OfflineUniverseCoverage(input.previousManifest,input.previousBatch);
  const current=auditP8OfflineUniverseCoverage(input.currentManifest,input.currentBatch);
  if(previous.cutoffDateExclusive>=current.cutoffDateExclusive)
    throw Error('P8 capture continuity must move forward in time');
  const prior=new Map(input.previousBatch.rows.map(r=>[r.bill.billId,r]));
  const now=new Map(input.currentBatch.rows.map(r=>[r.bill.billId,r]));
  const missingPrevious=[...prior.keys()].filter(id=>!now.has(id)).length;
  const changedFirstObservation=[...prior].filter(([id,row])=>
    now.has(id) && now.get(id)!.lineage.firstObservedAt!==row.lineage.firstObservedAt).length;
  return {
    previousCutoff:previous.cutoffDateExclusive,
    currentCutoff:current.cutoffDateExclusive,
    previousManifestCount:previous.coverage.suppliedManifestCount,
    currentManifestCount:current.coverage.suppliedManifestCount,
    previouslyCapturedNowMissing:missingPrevious,
    changedOriginalFirstObservation:changedFirstObservation,
    sourceOnlyUnverifiedDenominator:true as const,
    productionCaptureActivated:false as const,
    scoringAllowed:false as const,
  };
}
