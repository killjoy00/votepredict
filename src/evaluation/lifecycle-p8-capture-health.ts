/**
 * #310 P8 source/capture health, outcome-blind. This intentionally assesses only
 * the supplied list: it is NOT a verified official 2027 bill denominator.
 *
 * Nothing in this module connects to a source, schedules a job or scores a
 * forecast. The future capture operator must invoke the auditor/annotation
 * integration and arrange delivery; absence of a scheduled job is visible.
 */
import {
  type P8DailyCaptureBatch,P8_DAILY_CAPTURE_TIMEZONE,
} from './lifecycle-p8-daily-capture.js';
import {
  auditP8OfflineUniverseCoverage,auditP8OfflineCaptureContinuity,
  type P8SuppliedUniverseIndex,
} from './lifecycle-p8-universe-coverage.js';

export const P8_CAPTURE_HEALTH_SCHEMA='lifecycle-p8-capture-health-v1' as const;
export type P8CaptureAlertSeverity='notice'|'warning'|'critical';
export type P8CaptureAlertCode=
  'UNVERIFIED_OFFICIAL_UNIVERSE'|'SUPPLIED_BILL_MISSING'|
  'PROCESS_SOURCE_DEFERRED'|'PROCESS_SOURCE_COVERAGE_LOW'|
  'PRIOR_CAPTURE_BILL_DISAPPEARED'|'FIRST_OBSERVATION_CHANGED'|
  'CAPTURE_CALENDAR_DAYS_MISSED'|'CAPTURE_HEARTBEAT_STALE'|
  'CAPTURE_HEARTBEAT_NEVER_STARTED';
export interface P8CaptureAlert {
  code:P8CaptureAlertCode;
  severity:P8CaptureAlertSeverity;
  count:number;
  message:string;
}
export interface P8CaptureHealth {
  schemaVersion:typeof P8_CAPTURE_HEALTH_SCHEMA;
  session:'2027-2028';
  cutoffDateExclusive:string;
  currentManifestSha256:string;
  currentCaptureSha256:string;
  independentlyVerifiedOfficialBillUniverse:false;
  predictionAndOutcomeDataRead:false;
  productionCollectionActive:false;
  status:'unverified'|'warning'|'critical';
  previousCutoffDateExclusive:string|null;
  metrics:{
    suppliedBillCount:number;
    capturedBillCount:number;
    missingSuppliedBills:number;
    parsedProcessBillCount:number;
    deferredOrUnobservableProcessBillCount:number;
    previouslyCapturedBillsDisappeared:number;
    alteredFirstObservationClocks:number;
    skippedCalendarDays:number;
  };
  alerts:P8CaptureAlert[];
}
const INDEX:Record<P8CaptureAlertSeverity,number>={notice:0,warning:1,critical:2};
function assertDay(s:string):void{
  if(!/^(2027|2028)-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s+'T00:00:00Z')) ||
    new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)
    throw Error('Invalid P8 health calendar cutoff');
}
function daysBetween(a:string,b:string):number{
  assertDay(a);assertDay(b);
  return(Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000));
}
function chicagoDay(now:string):string{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(now)||
     new Date(now).toISOString()!==now)
    throw Error('Health monitoring instant must be a canonical UTC timestamp');
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:P8_DAILY_CAPTURE_TIMEZONE,
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const get=(kind:string)=>parts.find(x=>x.type===kind)?.value;
  return [get('year'),get('month'),get('day')].join('-');
}
export function auditP8DailyCaptureHealth(input:{
  currentManifest:P8SuppliedUniverseIndex;
  currentBatch:P8DailyCaptureBatch;
  previousManifest?:P8SuppliedUniverseIndex;
  previousBatch?:P8DailyCaptureBatch;
}):P8CaptureHealth{
  if(Boolean(input.previousBatch)!==Boolean(input.previousManifest))
    throw Error('Previous P8 capture and universe must be provided together');
  const c=auditP8OfflineUniverseCoverage(input.currentManifest,input.currentBatch);
  const metrics={
    suppliedBillCount:c.coverage.suppliedManifestCount,
    capturedBillCount:c.coverage.capturedRows,
    missingSuppliedBills:c.coverage.missingRows,
    parsedProcessBillCount:c.coverage.processSourceParsedRows,
    deferredOrUnobservableProcessBillCount:
      c.coverage.capturedRows-c.coverage.processSourceParsedRows,
    previouslyCapturedBillsDisappeared:0,
    alteredFirstObservationClocks:0,
    skippedCalendarDays:0,
  };
  let previousCutoff:string|null=null;
  if(input.previousBatch&&input.previousManifest){
    const prev=auditP8OfflineCaptureContinuity({
      previousManifest:input.previousManifest,previousBatch:input.previousBatch,
      currentManifest:input.currentManifest,currentBatch:input.currentBatch,
    });
    previousCutoff=prev.previousCutoff;
    metrics.previouslyCapturedBillsDisappeared=prev.previouslyCapturedNowMissing;
    metrics.alteredFirstObservationClocks=prev.changedOriginalFirstObservation;
    metrics.skippedCalendarDays=Math.max(0,daysBetween(prev.previousCutoff,prev.currentCutoff)-1);
  }
  const alerts:P8CaptureAlert[]=[{
    code:'UNVERIFIED_OFFICIAL_UNIVERSE',severity:'notice',count:1,
    message:'Bill denominator is supplied, not independently verified official enumeration',
  }];
  const add=(code:P8CaptureAlertCode,severity:P8CaptureAlertSeverity,
    count:number,message:string)=>{
    if(count>0)alerts.push({code,severity,count,message});
  };
  add('SUPPLIED_BILL_MISSING','critical',metrics.missingSuppliedBills,
    'Supplied bill identifiers missing from this immutable daily snapshot');
  add('PROCESS_SOURCE_DEFERRED','warning',metrics.deferredOrUnobservableProcessBillCount,
    'Captured bills with deferred or cutoff-ineligible official process observations');
  // Operational warning only against the supplied list; never the frozen P8
  // 95% independent-source evaluation admission criterion.
  if(metrics.capturedBillCount>0&&
    metrics.parsedProcessBillCount/metrics.capturedBillCount<0.95)
    add('PROCESS_SOURCE_COVERAGE_LOW','warning',
      metrics.capturedBillCount-metrics.parsedProcessBillCount,
      'Observed process coverage below operational 95% threshold on captured bills');
  add('PRIOR_CAPTURE_BILL_DISAPPEARED','critical',
    metrics.previouslyCapturedBillsDisappeared,
    'Previously captured bill missing from a later daily snapshot');
  add('FIRST_OBSERVATION_CHANGED','critical',metrics.alteredFirstObservationClocks,
    'Previously captured bill changed immutable earliest source-observation timestamp');
  add('CAPTURE_CALENDAR_DAYS_MISSED','critical',metrics.skippedCalendarDays,
    'Calendar-day gaps between stored daily captures; no retroactive fills allowed');
  alerts.sort((a,b)=>INDEX[b.severity]-INDEX[a.severity]||a.code.localeCompare(b.code));
  const status=alerts.some(x=>x.severity==='critical')?'critical':
    alerts.some(x=>x.severity==='warning')?'warning':'unverified';
  return{
    schemaVersion:P8_CAPTURE_HEALTH_SCHEMA,session:'2027-2028',
    cutoffDateExclusive:c.cutoffDateExclusive,
    currentManifestSha256:input.currentManifest.contentSha256,
    currentCaptureSha256:input.currentBatch.contentSha256,
    independentlyVerifiedOfficialBillUniverse:false,
    predictionAndOutcomeDataRead:false,
    productionCollectionActive:false,
    status,previousCutoffDateExclusive:previousCutoff,metrics,alerts,
  };
}
export interface P8CaptureHeartbeat {
  status:'disabled'|'not_yet_due'|'current'|'critical';
  asOfChicagoDay:string;
  latestStoredCutoff:string|null;
  lateDays:number;
  alerts:P8CaptureAlert[];
}
/** Called by a future explicit operator check. DOES NOT schedule or send mail. */
export function auditP8CaptureHeartbeat(input:{
  checkedAt:string;latestStoredCutoff:string|null;collectionExpected:boolean;
}):P8CaptureHeartbeat{
  const today=chicagoDay(input.checkedAt);
  if(input.latestStoredCutoff!==null)assertDay(input.latestStoredCutoff);
  const base={asOfChicagoDay:today,latestStoredCutoff:input.latestStoredCutoff};
  if(!input.collectionExpected)return {...base,status:'disabled',lateDays:0,alerts:[]};
  // A same-day completed snapshot is the desired freshness; monitoring for
  // tomorrow cannot silently count a future-dated archived source as healthy.
  if(today<'2027-01-01')return {...base,status:'not_yet_due',lateDays:0,alerts:[]};
  if(input.latestStoredCutoff!==null&&input.latestStoredCutoff>today)
    throw Error('P8 ledger contains a cutoff after monitoring day');
  if(!input.latestStoredCutoff)return {...base,status:'critical',lateDays:1,alerts:[{
    code:'CAPTURE_HEARTBEAT_NEVER_STARTED',severity:'critical',count:1,
    message:'Expected active daily collector has no stored capture',
  }]};
  const lateDays=daysBetween(input.latestStoredCutoff,today);
  return lateDays===0?{...base,status:'current',lateDays,alerts:[]}:
    {...base,status:'critical',lateDays,alerts:[{
      code:'CAPTURE_HEARTBEAT_STALE',severity:'critical',count:lateDays,
      message:'Expected daily capture is stale by Chicago calendar days',
    }]};
}
/** Integrate into the job executing capture/health; no implicit notifications. */
export function formatP8CaptureActionAnnotations(alerts:readonly P8CaptureAlert[]):string[]{
  return alerts.filter(x=>x.severity!=='notice').map(x=>{
    const level=x.severity==='critical'?'error':'warning';
    return '::'+level+' title=P8 '+x.code+'::'+x.message+' (count='+x.count+')';
  });
}
