/**
 * #946: Offline, public URL-only shadow diagnostics for the existing
 * 2021-2025 Minnesota Reformer and MPR Wayback seed discovery.
 *
 * NEVER create evidence rows, compare original SHA bytes, approve human
 * quotations, infer senator vote stances, or extrapolate missing-article
 * fractions from sampled public URLs. No HTTP or Postgres activity.
 */
import {
  LOCAL_TRADE_NEWS_SEEDS,
  localTradeNewsUrlPassesCurrentPathPriority,
} from './local-trade-news-history.js';

export const MEDIA_PUBLIC_DISCOVERY_GAP_VERSION =
  'senate-media-public-url-path-diagnostic-v1' as const;
const DAY=/^20(?:21|22|23|24|25)-\d{2}-\d{2}$/;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS='https:';

export interface MediaPublicDiscoveryLeadInput {
  id:string;
  seedId:string;
  livePageUrl:string;
  publicationDayDisplayedOnPublicPage:string;
}
export interface MediaPublicLeadPathDiagnostic {
  id:string;
  displayedPublicationDay:string;
  publisher:string;
  originalUrl:string;
  configuredSeedPrefix:string;
  currentSeedPrefixWouldIncludeUrl:boolean;
  currentPathPriorityWouldSelectUrl:boolean;
  currentTwoGateDiscoveryWouldSelectUrl:boolean;
  /** This is NOT independently known archived/published completeness. */
  measuredAgainst:'current_seed_prefix_and_path_rules_only';
  originalWaybackCaptureVerified:false;
  matchedDatabaseSourceDocument:false;
  exactSenatorQuoteVerified:false;
  forecastEligibilityVerified:false;
}
export interface PossibleMediaArticleAliasPair {
  firstLeadId:string;
  secondLeadId:string;
  commonDisplayedPublicationDay:string;
  reason:'same_reformer_host_day_and_slug_brief_vs_dated_path';
  status:'candidate_alias_not_verified_same_article';
  originalArchivedBytesCompared:false;
  publishedMediaDenominatorDeduplicated:false;
}
export interface MediaPublicGapReport {
  version:typeof MEDIA_PUBLIC_DISCOVERY_GAP_VERSION;
  totalCuratedPublicUrlLeads:number;
  urlLeadsOutsideConfiguredSeedPrefix:number;
  urlLeadsFilteredByTopicalPathPriority:number;
  urlLeadsExcludedByEitherGate:number;
  urlLeadsExcludedByBothGates:number;
  leads:MediaPublicLeadPathDiagnostic[];
  possibleAliasPairs:PossibleMediaArticleAliasPair[];
  isPublisherPublicationCensus:false;
  sourceBytesOrDatabaseAccessed:false;
  quotesHumanVerified:0;
  statewideDenominatorEstablished:false;
}

/** A conservative URL similarity clue, never an alias equivalence proof. */
function aliasFamily(value:URL,publicationDay:string):string|null {
  if(value.hostname!=='minnesotareformer.com')return null;
  const brief=value.pathname.match(/^\/briefs\/([a-z0-9-]+)\/?$/);
  const dated=value.pathname.match(/^\/(20(?:21|22|23|24|25))\/(\d{2})\/(\d{2})\/([a-z0-9-]+)\/?$/);
  if(brief?.[1] && SLUG.test(brief[1]))
    return value.hostname+'|'+publicationDay+'|'+brief[1];
  if(dated?.[4] && SLUG.test(dated[4])
    && publicationDay===dated[1]+'-'+dated[2]+'-'+dated[3])
    return value.hostname+'|'+publicationDay+'|'+dated[4];
  return null;
}
function urlKind(value:URL):'brief'|'dated'|'other' {
  if(/^\/briefs\/[a-z0-9-]+\/?$/.test(value.pathname))return 'brief';
  if(/^\/20(?:21|22|23|24|25)\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/.test(value.pathname))
    return 'dated';
  return 'other';
}

export function diagnoseMediaPublicDiscoveryPaths(
  leads:readonly MediaPublicDiscoveryLeadInput[],
):MediaPublicGapReport {
  if(!Array.isArray(leads)||leads.length>500)
    throw Error('Public discovery shadow analysis supports at most 500 leads');
  const seenIds=new Set<string>();
  const seenUrls=new Set<string>();
  const diagnostic:MediaPublicLeadPathDiagnostic[]=[];
  const familyMembers=new Map<string,Array<{id:string;kind:'brief'|'dated'|'other'}>>();
  for(const lead of leads){
    if(!lead || typeof lead.id!=='string'||!lead.id
      || !/^[a-z0-9-]{5,100}$/.test(lead.id)
      || seenIds.has(lead.id)
      || typeof lead.livePageUrl!=='string'
      || typeof lead.seedId!=='string'
      || typeof lead.publicationDayDisplayedOnPublicPage!=='string'
      || !DAY.test(lead.publicationDayDisplayedOnPublicPage)){
      throw Error('Malformed, duplicated or outside-2021-2025 publisher URL research lead');
    }
    const day=lead.publicationDayDisplayedOnPublicPage;
    const parsed=new Date(day+'T00:00:00Z');
    if(!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0,10)!==day)
      throw Error('Invalid displayed publication calendar date');
    const seed=LOCAL_TRADE_NEWS_SEEDS.find(s=>s.id===lead.seedId);
    if(!seed || !seed.prefix)throw Error('No recognized enabled local media discovery seed');
    let u:URL;
    try{u=new URL(lead.livePageUrl);}catch{throw Error('Malformed public URL');}
    const seedUrl=new URL(seed.url);
    if(u.protocol!==HTTPS || u.username || u.password || u.hash || u.search
      || u.hostname!==seedUrl.hostname || u.port || u.toString()!==lead.livePageUrl
      || seenUrls.has(u.toString()))
      throw Error('Untrusted, cross-publisher or duplicate public media research URL');
    seenIds.add(lead.id);
    seenUrls.add(u.toString());
    const prefix=u.toString().startsWith(seed.url);
    const path=localTradeNewsUrlPassesCurrentPathPriority(u.toString(),seed.pathHints);
    diagnostic.push({
      id:lead.id,displayedPublicationDay:day,publisher:seed.publisher,
      originalUrl:u.toString(),configuredSeedPrefix:seed.url,
      currentSeedPrefixWouldIncludeUrl:prefix,
      currentPathPriorityWouldSelectUrl:path,
      currentTwoGateDiscoveryWouldSelectUrl:prefix&&path,
      measuredAgainst:'current_seed_prefix_and_path_rules_only',
      originalWaybackCaptureVerified:false,
      matchedDatabaseSourceDocument:false,
      exactSenatorQuoteVerified:false,
      forecastEligibilityVerified:false,
    });
    const family=aliasFamily(u,day);
    if(family){
      const members=familyMembers.get(family)??[];
      members.push({id:lead.id,kind:urlKind(u)});
      familyMembers.set(family,members);
    }
  }
  const possibleAliasPairs:PossibleMediaArticleAliasPair[]=[];
  for(const [family,members] of familyMembers){
    const [,day]=family.split('|');
    const briefs=members.filter(x=>x.kind==='brief');
    const dated=members.filter(x=>x.kind==='dated');
    for(const b of briefs)for(const d of dated)possibleAliasPairs.push({
      firstLeadId:b.id,secondLeadId:d.id,
      commonDisplayedPublicationDay:day!,
      reason:'same_reformer_host_day_and_slug_brief_vs_dated_path',
      status:'candidate_alias_not_verified_same_article',
      originalArchivedBytesCompared:false,
      publishedMediaDenominatorDeduplicated:false,
    });
  }
  possibleAliasPairs.sort((a,b)=>
    a.firstLeadId.localeCompare(b.firstLeadId)||a.secondLeadId.localeCompare(b.secondLeadId));
  return {
    version:MEDIA_PUBLIC_DISCOVERY_GAP_VERSION,
    totalCuratedPublicUrlLeads:diagnostic.length,
    urlLeadsOutsideConfiguredSeedPrefix:diagnostic.filter(x=>!x.currentSeedPrefixWouldIncludeUrl).length,
    urlLeadsFilteredByTopicalPathPriority:diagnostic.filter(x=>!x.currentPathPriorityWouldSelectUrl).length,
    urlLeadsExcludedByEitherGate:diagnostic.filter(x=>!x.currentTwoGateDiscoveryWouldSelectUrl).length,
    urlLeadsExcludedByBothGates:diagnostic.filter(x=>
      !x.currentSeedPrefixWouldIncludeUrl&&!x.currentPathPriorityWouldSelectUrl).length,
    leads:diagnostic,
    possibleAliasPairs,
    isPublisherPublicationCensus:false,
    sourceBytesOrDatabaseAccessed:false,
    quotesHumanVerified:0,
    statewideDenominatorEstablished:false,
  };
}
