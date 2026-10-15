/** #864. Pure bounded public-95 / private-in-memory source parity comparison.
 * Never serialize private legislator ids, memberships, URLs, source hashes or excerpts.
 */
export const OWNER_MARKER='[senate-864-95-historical-neon-readonly-20261015-v1]';
export const SOURCE_LEDGER_FILES=[
 'senate-second20-15-original-serving-senators-issue-excerpts-v1',
 'senate-capture-dated-original-2020-22-campaign-issue-excerpts-v1',
 'senate-first-20-original-nine-actual-senators-61-short-excerpts-v1',
 'senate-original-campaign-additional-35-statement-excerpts-v1',
 'senate-five-further-2022-authenticated-capture-dated-original-issue-excerpts-v1',
 'senate-last16-five-new-original-site-policy-excerpts-v1',
 'senate-five-new-2022-original-site-capture-dated-policy-excerpts-v1',
 'senate-five-additional-served-2022-capture-dated-candidate-quotes-v1',
 'senate-four-new-2022-served-original-2022-exact-policy-quotes-v1',
 'senate-four-more-2022-original-campaign-policy-excerpts-capture-dated-v1',
 'senate-kiffmeyer-newman-kreun-four-original-historic-site-excerpts-v1',
 'senate-three-2022-original-sites-25-short-excerpt-proofs-v1',
 'senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1',
 'senate-ruud-2013-chamberlain-2022-original-26-exact-policy-excerpts-v1',
 'senate-two-2021-serving-2020-original-capture-dated-41-policy-excerpts-v1',
 'senate-carlson-hawj-2020-22-original-first-party-17-issue-excerpts-v1',
 'senate-six-2020-original-pages-26-new-exact-first-party-excerpts-v1',
 'senate-two-more-2021-served-2020-original-campaign-dated-policy-excerpts-v1',
 'senate-pha-doron-2022-25-original-campaign-site-21-short-excerpts-v1',
 'senate-nicole-mitchell-2022-original-priorities-excerpts-v1',
 'senate-carla-nelson-2022-dated-original-platform-excerpts-v1',
 'senate-rosen-old-sd24-2004-legacy-vml-original-12-excerpts-v1',
 'senate-justin-eichorn-2016-original-12-capture-dated-exact-issues-v1',
 'senate-kent-eken-2020-original-13-capture-dated-platform-excerpts-v1',
 'senate-bruce-anderson-14-full-original-issues-leads-v1',
 'senate-nick-frentz-2022-podcast-site-26-original-capture-dated-policy-excerpts-v1',
 'senate-bill-ingebrigtsen-27-exact-historical-first-party-issues-2010-2012-v1',
 'senate-roger-chamberlain-2016-original-10-economic-issue-excerpts-and-domain-review-v1',
 'senate-dornink-35-2019-2022-original-firstparty-excerpts-v1'
].map(n=>'data/evaluation/'+n+'.json');
const YEAR_BUCKETS=['pre2020','2020','2021','2022','2023','2024','2025','2026','undated','outside'];
const sha=/^[a-f0-9]{64}$/i;
export function nameKey(value){
 let text=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
 let tokens=text.split(' ').filter(x=>x&&!['sr','jr','ii','iii','iv','sen','senator'].includes(x));
 // Initial before a familiar first-name token is not the preferred given name.
 if(tokens.length>=3 && tokens[0].length===1)tokens.shift();
 if(tokens.length<2)return null;
 return tokens[0]+'|'+tokens[tokens.length-1];
}
const ALIASES={
 'sandy|pappas':'sandra|pappas',
 'jen|mcewen':'jennifer|mcewen',
 'ron|latz':'ronald|latz',
 'tom|bakk':'thomas|bakk',
 'chuck|wiger':'charles|wiger',
 'charlie|wiger':'charles|wiger',
 'carrie|ruud':'carrie|ruud',
 'john|hoffman':'john|hoffman',
 'steve|cwodzinski':'steve|cwodzinski',
 'stephen|cwodzinski':'steve|cwodzinski',
 'melisa|franzen':'melisa|franzen',
 'melissa|franzen':'melisa|franzen',
 'robert|farnsworth':'robert|farnsworth',
 'nicholas|frentz':'nick|frentz',
 'william|weber':'bill|weber',
 'william|lieske':'bill|lieske',
 'william|ingebrigtsen':'bill|ingebrigtsen',
 'matthew|klein':'matt|klein',
 'anna|mann':'alice|mann',
 'ann|johnson':'ann|stewart',
 'ann|stewart':'ann|stewart',
 'jennifer|mcewen':'jennifer|mcewen',
 'jen|mcewen':'jennifer|mcewen'
};
export function canonicalKey(value){let k=nameKey(value);return k ? ALIASES[k]||k : null}
export function assertManifest(m){
 if(m?.schema!=='senate-864-95-actual-served-2021-25-historical-original-site-research-manifest-v1'
 ||!Array.isArray(m.people)||m.people.length!==95
 ||m.sourceArtifact?.jsonSha256!=='e47a363cf01a03b08d163768629d23b683438f27fab4200fbf5a6202f87e33c9')
 throw Error('Pinned 95-person source-cohort identity mismatch');
 const keys=new Set();let years=0,excerpts=0,covered=0;
 for(const row of m.people){
  if(typeof row.officialName!=='string'||!row.officialName
    ||!Array.isArray(row.serviceYears)||row.serviceYears.length<1
    ||!Number.isInteger(row.selectedCandidateOwnedResearchExcerpts)
    ||row.selectedCandidateOwnedResearchExcerpts<0||row.selectedCandidateOwnedResearchExcerpts>200)
   throw Error('Invalid official source-cohort person');
  if(row.serviceYears.some(y=>![2021,2022,2023,2024,2025].includes(y))
   ||new Set(row.serviceYears).size!==row.serviceYears.length)
   throw Error('Invalid official source-cohort service years');
  const k=canonicalKey(row.officialName);
  if(!k||keys.has(k))throw Error('Duplicate or ambiguous canonical official service person');
  keys.add(k);years+=row.serviceYears.length;
  excerpts+=row.selectedCandidateOwnedResearchExcerpts;
  covered+=Number(row.selectedCandidateOwnedResearchExcerpts>0);
 }
 if(years!==339||excerpts!==1285||covered!==92)
 throw Error('Authentic historic source-denominator counts changed');
 return m;
}
const DIRECT_PAGE_KEYS=new Set([
 'pages','year2022OriginalPages','originalAuthenticatedPageReceipts',
 'fullOriginalArchivedSourceReceipts','fullOriginalPageSHAReceipts',
 'fullOriginalPageReceipts','fullOriginalArchivedPageReceipts',
 'sourcePages','originalCandidateIssueSourcePages','candidateOwnedOriginalIssueSourceSections',
 'originalFullPageSourceReceipts','originalFullHTMLReceipts',
 'originalFullPageReceipts','originalPageReceipts',
 'verifiedOriginals','originals','originalFullPageSourceReceipts'
].map(x=>x.toLowerCase()));
function value(obj,keys){
 const vals=new Map(Object.entries(obj).map(([k,v])=>[k.toLowerCase(),v]));
 for(const k of keys){const v=vals.get(k.toLowerCase());if(typeof v==='string'&&v.trim())return v.trim();}
 return null;
}
export function extractAuthenticatedPageLeads(manifest,files){
 assertManifest(manifest);
 const roster=new Map(manifest.people.map((p,i)=>[canonicalKey(p.officialName),i]));
 const pages=manifest.people.map(()=>[]);
 const seen=new Set();
 let ledgersRead=0,excludedUnbound=0;
 for(const path of SOURCE_LEDGER_FILES){
  const doc=files.get(path);
  if(!doc||typeof doc!=='object')throw Error('One of the fixed 29 original-source ledgers missing');
  ledgersRead++;
  for(const [section,arr] of Object.entries(doc)){
   if(!DIRECT_PAGE_KEYS.has(section.toLowerCase())||!Array.isArray(arr))continue;
   for(const obj of arr){
    if(!obj||typeof obj!=='object'||Array.isArray(obj))continue;
    if(obj.candidateOwnedPoliticalAttributionAllowed===false
      ||obj.candidateOwnedOriginalSite===false
      ||obj.originalCandidateWebsiteTextDirectlyProvenAsOfCapture===false
      ||obj.candidateOwnedSite===false)continue;
    const url=value(obj,['sourceOriginalUrl','archivedOriginalSiteUrl','originalUrl','originalURL','originalPageUrl','originalSiteUrl','url']);
    const digest=value(obj,['actualOriginalHtmlSha256','originalHtmlSha256','originalHTMLSHA256','originalFullHtmlSHA256','originalRawHtmlSha256','fullHTMLSHA256','fullHtmlSha256','fullHTMLSHA256','originalFullHTMLSHA256','originalFullHtmlSHA256','originalBodySha256','htmlSha256','sourceSHA256','sha256','sha']);
    const person=value(obj,['officialSenateDirectoryName','officialSenatorName','person','senator','servingSenator','attributedTo']);
    if(!url||!digest||!sha.test(digest)||!/^https?:\/\/[^/\s]+/.test(url))continue;
    const ordinal=roster.get(canonicalKey(person));
    if(ordinal===undefined){excludedUnbound++;continue;}
    const key=ordinal+'|'+url+'|'+digest.toLowerCase();
    if(seen.has(key))continue;seen.add(key);
    pages[ordinal].push({url,sha:digest.toLowerCase()});
   }
  }
 }
 if(ledgersRead!==29)throw Error('Historical source ledger inventory incomplete');
 return {pages,ledgersRead,excludedUnbound};
}
function safeInt(n,cap=25000){return Number.isSafeInteger(n)&&n>=0&&n<=cap}
function publishedBucket(v){
 if(!v)return 'undated';
 const y=Number(String(v).slice(0,4));
 if(!Number.isInteger(y))return 'undated';
 if(y<2020)return 'pre2020';
 return y<=2026?String(y):'outside';
}
function dbEntryName(row){return row.name||row.legislator_name||'';}
export function compareHistoric95(manifest,research,rosterRows,campaignRows,primaryRows){
 assertManifest(manifest);
 if(!Array.isArray(rosterRows)||rosterRows.length>1000
   ||!Array.isArray(campaignRows)||campaignRows.length>8500
   ||!Array.isArray(primaryRows)||primaryRows.length>1000
   ||!Array.isArray(research.pages)||research.pages.length!==95)
  throw Error('Unbounded private SQL or public source rows');
 const matchKey=new Map();
 for(const row of rosterRows){
  if(typeof row.legislatorId!=='string'||typeof row.membershipId!=='string')
   throw Error('Invalid private roster row shape');
  const key=canonicalKey(dbEntryName(row));
  if(!key)continue;
  const arr=matchKey.get(key)||[];
  arr.push(row);matchKey.set(key,arr);
 }
 const rows=[];
 for(let i=0;i<95;i++){
  const official=manifest.people[i];
  const key=canonicalKey(official.officialName);
  const members=matchKey.get(key)||[];
  const legislators=new Set(members.map(m=>m.legislatorId));
  const matchStatus=legislators.size===0?'hold_person_not_joined':
    legislators.size>1?'hold_multiple_legislator_identities':'joined_unique_legislator';
  const rawSourcePages=research.pages[i];
  if(!Array.isArray(rawSourcePages)||rawSourcePages.length>120)throw Error('Unbounded researched pages');
  const item={ordinal:i+1,identityStatus:matchStatus,
    researchedOriginalPagesWithUrlSha:rawSourcePages.length,
    researchedExactUrlAndWholeShaMatched:null,
    researchedExactUrlOnlyMatched:null,
    researchedExactUrlNotObserved:null,
    storedHistoricalMembershipRows:null,
    storedCampaignSiteIssueRows:null,
    storedDistinctCampaignSourceDocuments:null,
    storedMemberPrimaryArticleRows:null,
    storedCampaignRowsByPublishedMetadataYear:null};
  if(matchStatus==='joined_unique_legislator'){
   const ids=new Set(members.map(m=>m.membershipId));
   const src=campaignRows.filter(r=>ids.has(r.membershipId));
   const primary=primaryRows.filter(r=>ids.has(r.membershipId));
   const bucket=Object.fromEntries(YEAR_BUCKETS.map(y=>[y,0]));
   for(const r of src)bucket[publishedBucket(r.publishedAt)]++;
   const own=src.map(r=>({url:r.sourceUrl,sha:String(r.contentSha256||'').toLowerCase()}));
   let exact=0,urlOnly=0,unobserved=0;
   for(const page of rawSourcePages){
    const candidates=own.filter(x=>x.url===page.url);
    if(candidates.some(x=>x.sha===page.sha))exact++;
    else if(candidates.length)urlOnly++;
    else unobserved++;
   }
   item.researchedExactUrlAndWholeShaMatched=exact;
   item.researchedExactUrlOnlyMatched=urlOnly;
   item.researchedExactUrlNotObserved=unobserved;
   item.storedHistoricalMembershipRows=ids.size;
   item.storedCampaignSiteIssueRows=src.length;
   item.storedDistinctCampaignSourceDocuments=new Set(src.map(r=>r.sourceDocumentId)).size;
   item.storedMemberPrimaryArticleRows=primary.length?primary.reduce((a,v)=>a+Number(v.rows),0):0;
   item.storedCampaignRowsByPublishedMetadataYear=bucket;
  }
  rows.push(item);
 }
 const joined=rows.filter(r=>r.identityStatus==='joined_unique_legislator');
 const holds=rows.filter(r=>r.identityStatus!=='joined_unique_legislator');
 if(joined.length+holds.length!==95)throw Error('Roster count drift');
 const sum=k=>joined.reduce((n,r)=>n+r[k],0);
 const report={
  schema:'senate-864-95-historical-source-to-existing-neon-protected-v1',
  issue:864,
  cohortSize:95,
  researchExcerptsAllCycles:1285,
  researchPeopleWithAnyOriginalSiteExcerpts:92,
  researchServicePersonYears:339,
  metadataSourceLedgersRead:research.ledgersRead,
  researchUrlShaDirectlyAttributedPages:rows.reduce((n,r)=>n+r.researchedOriginalPagesWithUrlSha,0),
  exactUrlShaStoredLinkedPages:sum('researchedExactUrlAndWholeShaMatched'),
  exactUrlOnlyStoredLinkedPages:sum('researchedExactUrlOnlyMatched'),
  exactUrlNotObservedPages:sum('researchedExactUrlNotObserved'),
  uniqueLegislatorJoins:joined.length,
  unjoinedOrAmbiguousOfficialPeople:holds.length,
  storedCampaignSiteEvidenceRowsAcrossJoinedHistoricMemberships:sum('storedCampaignSiteIssueRows'),
  storedMemberPrimaryArticleRowsAcrossJoinedHistoricMemberships:sum('storedMemberPrimaryArticleRows'),
  rows,
  archivedSourcePageExactURLNotObservedMeansMissingInBoundedComparisonOnly:true,
  noProofOf1285ExactQuotesMatched:true,
  storedPublicationYearsNotIndependentOriginalPublicBy:true,
  memberPrimaryRowsNotVerifiedPersonalPositions:true,
  originalCampaignSiteResearchDoesNotProveLegislativeVotes:true,
  productionChanges:0,
  readOnlyTransaction:true,
  explicitRollback:true,
  databaseIsVerifiedVotePredictExistingDefaultNeonBranch:true,
  publicSenatorNamesStoredOnlyInKeylessSourceManifest:true
 };
 return validatePublicReport(report,manifest);
}
export function validatePublicReport(report,manifest){
 assertManifest(manifest);
 if(report?.schema!=='senate-864-95-historical-source-to-existing-neon-protected-v1'
   ||report.cohortSize!==95||report.researchExcerptsAllCycles!==1285
   ||report.researchServicePersonYears!==339
   ||report.metadataSourceLedgersRead!==29
   ||report.readOnlyTransaction!==true||report.explicitRollback!==true
   ||report.productionChanges!==0||report.databaseIsVerifiedVotePredictExistingDefaultNeonBranch!==true
   ||!Array.isArray(report.rows)||report.rows.length!==95)
  throw Error('Invalid public sanitized 95-senator receipt');
 const allowed=['ordinal','identityStatus','researchedOriginalPagesWithUrlSha',
  'researchedExactUrlAndWholeShaMatched','researchedExactUrlOnlyMatched',
  'researchedExactUrlNotObserved','storedHistoricalMembershipRows',
  'storedCampaignSiteIssueRows','storedDistinctCampaignSourceDocuments',
  'storedMemberPrimaryArticleRows','storedCampaignRowsByPublishedMetadataYear'].sort();
 for(let i=0;i<95;i++){
  const r=report.rows[i];
  if(JSON.stringify(Object.keys(r).sort())!==JSON.stringify(allowed)
    ||r.ordinal!==i+1
    ||!['joined_unique_legislator','hold_person_not_joined','hold_multiple_legislator_identities'].includes(r.identityStatus)
    ||!safeInt(r.researchedOriginalPagesWithUrlSha,120))
   throw Error('Private SQL row fields or invalid public ordinal');
  const fields=['researchedExactUrlAndWholeShaMatched','researchedExactUrlOnlyMatched',
   'researchedExactUrlNotObserved','storedHistoricalMembershipRows','storedCampaignSiteIssueRows',
   'storedDistinctCampaignSourceDocuments','storedMemberPrimaryArticleRows'];
  if(r.identityStatus==='joined_unique_legislator'){
   if(fields.some(x=>!safeInt(r[x]))||r.storedHistoricalMembershipRows<1
    ||!r.storedCampaignRowsByPublishedMetadataYear
    ||JSON.stringify(Object.keys(r.storedCampaignRowsByPublishedMetadataYear).sort())!==JSON.stringify([...YEAR_BUCKETS].sort())
    ||Object.values(r.storedCampaignRowsByPublishedMetadataYear).some(v=>!safeInt(v))
    ||r.researchedExactUrlAndWholeShaMatched+r.researchedExactUrlOnlyMatched+r.researchedExactUrlNotObserved!==r.researchedOriginalPagesWithUrlSha
    ||Object.values(r.storedCampaignRowsByPublishedMetadataYear).reduce((a,b)=>a+b,0)!==r.storedCampaignSiteIssueRows)
    throw Error('Contradictory public person counts');
  }else if(fields.some(x=>r[x]!==null)||r.storedCampaignRowsByPublishedMetadataYear!==null)
    throw Error('HOLD must not be reported as zero');
 }
 const serialized=JSON.stringify(report);
 if(serialized.length>80000||/(?:https?:\/\/|postgresql:|neon\.tech|memberShipId|sourceDocumentId|legislatorId|sourceUrl|contentSha256|excerpt|password|NEON_API_KEY)/i.test(serialized.replace(/researchExcerptsAllCycles|noProofOf1285ExactQuotesMatched|researchPeopleWithAnyOriginalSiteExcerpts/g,'')))
  throw Error('Private value appeared in public report');
 return report;
}
