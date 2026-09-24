export const HISTORICAL_PUBLIC_AVAILABILITY_VERSION = 'historical-public-availability-v1' as const;

export type HistoricalAvailabilityProof =
  | 'official_publication_timestamp'
  | 'independent_archive_capture'
  | 'regulatory_filing_or_disclosure_timestamp'
  | 'publisher_page_metadata';

export interface HistoricalAvailabilityRecord {
  proof: HistoricalAvailabilityProof;
  availableAt: string;
  canonicalUrl: string;
  archiveUrl?: string;
  capturedAt?: string;
  publishedAt?: string;
  filingAt?: string;
  contentSha256: string;
  metadata?: Record<string, unknown>;
}

function instant(value:string,label:string):number{
  const t=new Date(value).getTime();
  if(!Number.isFinite(t))throw new Error(label+' must be a valid timestamp');
  return t;
}

export function historicalAvailabilityErrors(row:HistoricalAvailabilityRecord):string[]{
  const errors:string[]=[];
  if(!/^https:\/\//i.test(row.canonicalUrl))errors.push('canonicalUrl must be https');
  if(!/^[a-f0-9]{64}$/i.test(row.contentSha256))errors.push('contentSha256 must be sha256');
  let available:number|undefined;
  try{available=instant(row.availableAt,'availableAt');}catch(e){errors.push((e as Error).message);}
  if(row.proof==='independent_archive_capture'){
    if(!row.archiveUrl||!/^https:\/\//i.test(row.archiveUrl))errors.push('archive capture requires https archiveUrl');
    if(!row.capturedAt)errors.push('archive capture requires capturedAt');
    else{
      try{
        const captured=instant(row.capturedAt,'capturedAt');
        if(available!==undefined&&captured!==available)errors.push('archive availableAt must equal capturedAt');
      }catch(e){errors.push((e as Error).message);}
    }
  }
  if(row.proof==='official_publication_timestamp' && !row.publishedAt)errors.push('official publication requires publishedAt');
  if(row.proof==='publisher_page_metadata' && !row.publishedAt)errors.push('publisher metadata requires publishedAt');
  if(row.proof==='regulatory_filing_or_disclosure_timestamp'){
    if(!row.filingAt)errors.push('regulatory disclosure requires filingAt');
    else{
      try{
        const filing=instant(row.filingAt,'filingAt');
        if(available!==undefined&&available<filing)errors.push('regulatory availableAt cannot precede filingAt');
      }catch(e){errors.push((e as Error).message);}
    }
  }
  return errors;
}

export function isHistoricallyAvailableBefore(
  row:HistoricalAvailabilityRecord,
  cutoff:string,
):boolean{
  if(historicalAvailabilityErrors(row).length) return false;
  return instant(row.availableAt,'availableAt') < instant(cutoff,'cutoff');
}

export function dateExclusiveAvailable(
  row:HistoricalAvailabilityRecord,
  cutoffDateExclusive:string,
):boolean{
  if(historicalAvailabilityErrors(row).length) return false;
  const availableDate=row.availableAt.slice(0,10);
  const cutoff=cutoffDateExclusive.slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(availableDate)
    && /^\d{4}-\d{2}-\d{2}$/.test(cutoff)
    && availableDate < cutoff;
}

export function availabilityMetadata(row:HistoricalAvailabilityRecord){
  return {
    historicalAvailabilityVersion:HISTORICAL_PUBLIC_AVAILABILITY_VERSION,
    availabilityProof:row.proof,
    availableAt:row.availableAt,
    canonicalSourceUrl:row.canonicalUrl,
    archiveUrl:row.archiveUrl ?? null,
    archiveCapturedAt:row.capturedAt ?? null,
    sourcePublishedAt:row.publishedAt ?? null,
    regulatoryFiledAt:row.filingAt ?? null,
    sourceContentSha256:row.contentSha256.toLowerCase(),
  };
}
