/**
 * #864 2026 MN Senate incumbents: PUBLIC candidate URL ↔ PRIVATE database source
 * identity comparison in trusted ephemeral memory.
 *
 * No SQL, API call, filesystem, GitHub, production credentials or logging here.
 * The ONLY return values are public district numbers and tightly bounded
 * classification/status counts. Source/document IDs, original URLs, snapshots,
 * excerpt bodies, private stored people names and private hashes never escape.
 *
 * Exact/alias URL overlap is NOT source-byte SHA parity, quote attribution,
 * policy support, production serving-binding proof or an absence certificate.
 */
const EXPECTED=[1,2,3,4,6,7,8,9,10,11,12,14,16,17,18,19,23,25,27,28,29,30,31,32,33,34,35,36,38,39,40,41,42,45,46,47,48,55,56,57,58,59,60,61,62,63,64,66,67];
const STATUS=new Set([
 'matched_exact_url_with_named_senator_evidence',
 'matched_url_alias_with_named_senator_evidence',
 'source_url_present_but_no_named_senator_evidence',
 'source_url_not_observed_in_bounded_lookup',
 'senator_membership_identity_unresolved'
]);
export function auditPublic2026IncumbentSourceManifest(m,duckworth){
 if(m?.schema!=='mn-senate-864-2026-49-incumbent-main-branch-code-reference-source-join-v1'
  || m.issue!==864 ||m.election!=='2026-11-03'
  || !Array.isArray(m.rows)||m.rows.length!==49
  ||m.summary?.selectedOlderSiteResearchExcerpts!==716)
  throw Error('Unexpected reviewed 49-incumbent source manifest');
 const actual=m.rows.map(x=>x.district);
 if(JSON.stringify(actual)!==JSON.stringify(EXPECTED))
  throw Error('Missing, repeated or reordered official 2026 incumbent districts');
 if(m.rows.reduce((n,r)=>n+r.selectedOlderOriginalSiteExcerpts,0)!==716)
  throw Error('Historically authenticated original site excerpt count drifted');
 if(duckworth?.issue!==864 ||duckworth.duckworth?.original2022CaptureUtc!=='2022-01-18T02:14:14.000Z'
   ||duckworth.duckworth?.selectedOlderOriginalSiteExcerpts!==14
   ||duckworth.duckworth?.newDated2026SourceLeads?.length!==4)
  throw Error('Duckworth current source list or old site separation changed');
 const ids=new Set();
 for(const row of m.rows){
  if(!Number.isInteger(row.district)||!row.senator ||!/^[^\n\r]{5,90}$/.test(row.senator))
   throw Error('Invalid public Senate candidate identity');
  if(ids.has(row.senator.toLowerCase()))throw Error('Repeated incumbent identity');
  ids.add(row.senator.toLowerCase());
  publicUrl(row.researchSourceUrl);
 }
 for(const s of duckworth.duckworth.newDated2026SourceLeads) {
  publicUrl(s.url);
  if(!/duckworth/i.test(s.speakerCue)
    ||!/^[a-z0-9-]{5,75}$/.test(s.id)
    ||!/^2026-\d{2}-\d{2}$/.test(s.dateDisplayed))
   throw Error('Untrusted Duckworth public source identity');
 }
 return true;
}
export function publicUrl(raw){
 if(typeof raw!=='string'||raw.length<15||raw.length>500)throw Error('Invalid public source locator');
 let u;try{u=new URL(raw)}catch{throw Error('Invalid public URL')};
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash
  ||u.port||! /^[a-z0-9.-]+$/.test(u.hostname)
  ||!/\.[a-z]{2,}$/i.test(u.hostname)
  ||/\/(?:\.{1,2})(?:\/|$)/.test(u.pathname))
  throw Error('Unsafe public source URL');
 return u;
}
export function urlFingerprint(raw){
 const u=publicUrl(raw);
 return u.hostname.toLowerCase().replace(/^www\./,'')+
  (u.pathname.replace(/\/+$/,'')||'/');
}
/** URL variants are only public address spellings; they do not prove bytes equal. */
export function publicUrlVariants(raw){
 const u=publicUrl(raw);
 const path=u.pathname.replace(/\/+$/,'')||'/';
 const hosts=[u.hostname];
 if(u.hostname.startsWith('www.'))hosts.push(u.hostname.slice(4));
 else hosts.push('www.'+u.hostname);
 const variants=new Set([u.href]);
 for(const scheme of ['https:','http:'])for(const host of hosts){
  for(const p of path==='/'?['/']:[path,path+'/']){
   variants.add(scheme+'//'+host+p);
  }
 }
 return [...variants].sort();
}
function normalizeWords(x){
 return String(x??'').normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
  .replace(/\s+/g,' ').toLowerCase().trim();
}
function lastName(name){
 const atoms=normalizeWords(name).replace(/[^a-z-]+/g,' ').trim().split(/\s+/);
 return atoms.at(-1)?.replace(/[^a-z]/g,'')||'';
}
export function compare49IncumbentSources(m,d,sqlMemberships,sqlSourceEvidence,publisherRawReceipt){
 auditPublic2026IncumbentSourceManifest(m,d);
 if(!publisherRawReceipt ||
  publisherRawReceipt.schema!=='senate-864-2026-duckworth-four-successful-live-first-party-publisher-original-html-sha-fingerprints-v1'
  ||publisherRawReceipt.sourcePages?.length!==4
  ||publisherRawReceipt.completeRawHtmlSha256SourceBodies!==4)
  throw Error('Independent exact whole publisher HTML fingerprints required before private parity');
 const publicRawByUrl=new Map();
 for(let i=0;i<4;i++){
  const raw=publisherRawReceipt.sourcePages[i];
  if(raw.id!==d.duckworth.newDated2026SourceLeads[i].id
    ||raw.url!==d.duckworth.newDated2026SourceLeads[i].url
    ||raw.originalHttpStatus!==200
    ||raw.observedAtUtc.slice(0,10)!=='2026-10-13'
    ||! /^[a-f0-9]{64}$/.test(raw.rawWholeHtmlSha256)
    ||raw.rawWholeHtmlBytes<1000 ||!raw.namedDuckworthSpeakerCueVisible
    ||raw.firstAuthoredOnDisplayedDateProven!==false)
   throw Error('Pinned source-original SHA/date/speaker identity mismatch');
  publicRawByUrl.set(raw.url,raw.rawWholeHtmlSha256);
 }
 if(!Array.isArray(sqlMemberships)||sqlMemberships.length>210
  ||!Array.isArray(sqlSourceEvidence)||sqlSourceEvidence.length>1200)
  throw Error('Private in-memory source compare bound exceeded');
 const pub=m.rows;
 const publicInputs=[...pub.map(x=>x.researchSourceUrl),
  ...d.duckworth.newDated2026SourceLeads.map(x=>x.url)];
 const allowable=new Set(publicInputs.flatMap(publicUrlVariants));
 const publicFingerprints=new Set(publicInputs.map(urlFingerprint));
 if(publicInputs.length!==53||new Set(publicInputs).size!==53
  ||publicFingerprints.size!==53)
  throw Error('Public source cohort repeated or mismatched');
 const memberships=new Map(pub.map(r=>[r.district, new Set()]));
 const observedMemberId=new Map();
 for(const record of sqlMemberships){
  if(!record ||typeof record!=='object'
   ||typeof record.district!=='string'||typeof record.senatorName!=='string'
   ||typeof record.membershipId!=='string'
   ||record.membershipId.length<8||record.membershipId.length>100)
   throw Error('Malformed private source membership record');
  const district=Number(record.district);
  if(!Number.isInteger(district)||!memberships.has(district))
   throw Error('Unexpected district from bounded membership query');
  const expected=pub.find(r=>r.district===district);
  if(lastName(record.senatorName)===lastName(expected.senator)){
   memberships.get(district).add(record.membershipId);
  }
  const old=observedMemberId.get(record.membershipId);
  if(old!==undefined&&old!==district)throw Error('Private membership id repeated across district');
  observedMemberId.set(record.membershipId,district);
 }
 const docUrls=new Map();
 const seenRowIds=new Map();
 const matchedRows=[];
 for(const row of sqlSourceEvidence){
  if(!row||typeof row!=='object'||typeof row.sourceDocumentId!=='string'
   ||typeof row.sourceUrl!=='string'||typeof row.sourceKind!=='string'
   ||(row.contentSha256!==null && (typeof row.contentSha256!=='string'||! /^[a-f0-9]{64}$/.test(row.contentSha256)))
   ||typeof row.sourceEvidenceId!=='string' && row.sourceEvidenceId!==null
   ||typeof row.membershipId!=='string' && row.membershipId!==null
   ||typeof row.excerpt!=='string'&&row.excerpt!==null)
   throw Error('Invalid bounded private source record');
  if(!allowable.has(row.sourceUrl)||!publicFingerprints.has(urlFingerprint(row.sourceUrl)))
   throw Error('Unexpected source URL in bounded query; cannot report private rows');
  if(row.excerpt?.length>4000)throw Error('Private excerpt too large');
  const existing=docUrls.get(row.sourceDocumentId);
  if(existing&&existing!==row.sourceUrl)throw Error('Private source document identity conflict');
  docUrls.set(row.sourceDocumentId,row.sourceUrl);
  if(row.sourceEvidenceId){
   const key=row.sourceEvidenceId;
   const previously=seenRowIds.get(key);
   const identity=row.sourceDocumentId+'|'+row.membershipId;
   if(previously&&previously!==identity)throw Error('Contradictory private evidence/source pairing');
   seenRowIds.set(key,identity);
  }
  matchedRows.push(row);
 }
 const statuses=[],byStatus={};
 const sourceRowsFor=u=>matchedRows.filter(x=>urlFingerprint(x.sourceUrl)===urlFingerprint(u));
 for(const person of pub){
  const identity=memberships.get(person.district);
  const sourceRows=sourceRowsFor(person.researchSourceUrl);
  const referenced=sourceRows.filter(x=>x.sourceEvidenceId &&identity.has(x.membershipId));
  const exact=referenced.some(x=>x.sourceUrl===person.researchSourceUrl);
  let status;
  if(!identity.size)status='senator_membership_identity_unresolved';
  else if(exact)status='matched_exact_url_with_named_senator_evidence';
  else if(referenced.length)status='matched_url_alias_with_named_senator_evidence';
  else if(sourceRows.length)status='source_url_present_but_no_named_senator_evidence';
  else status='source_url_not_observed_in_bounded_lookup';
  if(!STATUS.has(status))throw Error('Unsafe source classification');
  statuses.push({district:person.district,status});
  byStatus[status]=(byStatus[status]||0)+1;
 }
 const duckworth=d.duckworth.newDated2026SourceLeads.map(s=>{
  const sourceRows=sourceRowsFor(s.url);
  const memberIds=memberships.get(57);
  const individual=sourceRows.filter(x=>x.sourceEvidenceId&&memberIds.has(x.membershipId));
  const cue=normalizeWords(s.shortIssueCue);
  const literal=individual.some(x=>normalizeWords(x.excerpt).includes(cue));
  const rawBodyParity=individual.some(x=>x.contentSha256===publicRawByUrl.get(s.url));
  return {sourceOrdinal:d.duckworth.newDated2026SourceLeads.indexOf(s)+1,
   urlInStoredDocuments:sourceRows.length>0,
   currentSenatorEvidenceLinked:individual.length>0,
   exactShortCueInStoredEvidence:literal,
   originalRawPublisherBodyShaProvenSame:rawBodyParity,
   originalFirstPublicationTimeProven:false};
 });
 const summarize=(items,key)=>items.filter(x=>x[key]===true).length;
 const classified={schema:'mn-864-2026-49-incumbent-protected-url-parity-v1',
  issue:864,asOfElection:'2026-11-03',researchCandidateCount:49,
  olderSelectedOriginalSiteExcerpts:716,
  comparedPublicCurrentSourceUrls:49,
  limitedUrlVariantSourceLookupNotExhaustive:true,
  identityValidatedByDistrictAndSurnameNotIndependent2026ElectionAudit:true,
  outputContainsPrivateSourceRows:false,outputContainsPrivateUrls:false,
  outputContainsPrivatePeopleNames:false,outputContainsPrivateHashes:false,
  currentSourceOriginalHtmlRawShaParityProven:false,
  duckworthLiveOriginalRawShaComparedAgainstStoredSourceSha:true,
  currentSourceHumanAttributedStatementsReviewed:false,
  deployedProductionDbBindingProven:false,
  sourceUrlStatusByDistrict:statuses,
  groupedStatusCounts:byStatus,
  duckworth:{
   comparedDatedPublicSources:4,perSource:duckworth,
   sourceUrlsObserved:summarize(duckworth,'urlInStoredDocuments'),
   senatorEvidenceLinked:summarize(duckworth,'currentSenatorEvidenceLinked'),
   literalShortCueObserved:summarize(duckworth,'exactShortCueInStoredEvidence'),
   exactLiveWholePublisherHtmlShaMatches:summarize(duckworth,'originalRawPublisherBodyShaProvenSame'),
   historic2022WebsiteStillIndependent:true,
  },
 };
 if(statuses.length!==49||Object.values(byStatus).reduce((a,b)=>a+b,0)!==49
  ||duckworth.length!==4)
  throw Error('Private source classification totals invalid');
 return classified;
}
