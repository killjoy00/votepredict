import type { WaybackCapture } from './wayback';

export const WAYBACK_PUBLIC_EVIDENCE_BACKFILL_VERSION =
  'wayback-public-evidence-backfill-v1' as const;

export interface WaybackSeed {
  membershipId:string;
  memberName:string;
  sessionSlug:string;
  chamber:'house'|'senate';
  seedKind:'campaign'|'member_primary';
  seedUrl:string;
  prefix:boolean;
  sourceQuality:'official'|'member_primary';
}

function priority(url:string):number{
  let path:string;
  try{path=new URL(url).pathname.toLowerCase();}catch{return -100;}
  if(path==='/'||path==='')return 100;
  if(/issue|priorit|policy|platform|legislat/.test(path))return 95;
  if(/news|press|media|update|blog/.test(path))return 90;
  if(/endorse|questionnaire|scorecard/.test(path))return 85;
  if(/about|bio/.test(path))return 75;
  return 20;
}

export function selectWaybackEvidenceCaptures(
  captures:readonly WaybackCapture[],
  input:{maxCaptures?:number}={},
):WaybackCapture[]{
  const maxCaptures=Math.max(1,Math.min(50,input.maxCaptures??12));
  const byOriginalYear=new Map<string,WaybackCapture>();
  for(const capture of captures){
    const year=capture.capturedAt.slice(0,4);
    const key=capture.original+'|'+year;
    const existing=byOriginalYear.get(key);
    if(!existing||capture.timestamp>existing.timestamp)byOriginalYear.set(key,capture);
  }
  return [...byOriginalYear.values()]
    .sort((a,b)=>
      priority(b.original)-priority(a.original)
      || b.timestamp.localeCompare(a.timestamp)
      || a.original.localeCompare(b.original)
    )
    .slice(0,maxCaptures)
    .sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.original.localeCompare(b.original));
}

export function sessionArchiveWindow(sessionSlug:string):{from:string;to:string}{
  if(sessionSlug==='2021-2022')return {from:'20200101',to:'20221231'};
  if(sessionSlug==='2023-2024')return {from:'20220101',to:'20241231'};
  if(sessionSlug==='2025-2026')return {from:'20240101',to:'20261231'};
  throw new Error('Unsupported archive session '+sessionSlug);
}
