/**
 * Source/geometry verification of #864 116 actual Senate candidate contribution
 * rows from two independent ORIGINAL-source-attested contemporary PAC IDs.
 * This READ ONLY script never transfers original PDFs or donor details into
 * public GitHub output. No association with an actual historical vote or
 * original historical PDF public-by date may be inferred.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {PDFParse} from 'pdf-parse';
import {CanvasFactory} from 'pdf-parse/worker';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
 reconcilePositionedOriginalA1Page,safePositionedOriginalSummary
} from '../src/evidence/cfb-pac116-original-positioned-text-v5.mjs';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {validateCfbIssueSourceManifest}
 from '../src/evidence/cfb-issue-source-observation-v1.mjs';
import {attestCurrentPacSourcePairs}
 from '../src/evidence/cfb-issue-pac-original-attestations-v2.mjs';
import {assertPac116FinanceReadOnlyGuard}
 from './audit-cfb-pac-116-contribution-provenance-readonly.mjs';
import {independentlyRehashCfbPdf}
 from '../src/evidence/cfb-pac-contribution-provenance-v1.mjs';
import {
 isOriginalA1PacPage,isOriginalA1RegisteredPacPage,
 exactPrintedPacReg,verifyOriginalA1PacTable,
 safeOriginalA1PacCohortSummary
} from '../src/evidence/cfb-pac116-original-a1-geometry-v4.mjs';

const MAX_ORIGINAL_TABLE_PAGES=240;
const SQL_ORIGINALS=[
 'SELECT source_id,organization_group,source_role,source_url,final_url,',
 'html_sha256,raw_html_bytes,observed_at,claim_status,',
 'historical_asof_eligible,mechanically_actionable,model_weight',
 'FROM cfb_issue_finance_source_observations',
 'WHERE source_id=ANY($1::text[]) ORDER BY source_id,observed_at'
].join(' ');
const SQL_COHORT=[
 "SELECT ei.metadata->>'rowKey' AS row_key,",
 "ei.metadata->>'filerRegistrationNumber' AS filer_reg,",
 "ei.metadata->>'year' AS year,",
 "ei.metadata->>'contributorRegistrationNumber' AS donor_reg,",
 "ei.metadata->>'transactionDate' AS tx_on,",
 "ei.metadata->>'contributor' AS contributor,",
 "ei.metadata->>'amount' AS amount",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND ei.metadata->>'year' IN ('2021','2022','2023','2024','2025')",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'",
 "AND ei.metadata->>'contributorRegistrationNumber' = ANY($1::text[])",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))",
 'ORDER BY 2,3,1'
].join(' ');
const SQL_COMPARATOR=[
 'WITH receiving AS (SELECT DISTINCT reg,year FROM jsonb_to_recordset($1::jsonb)',
 'AS x(reg text,year integer))',
 "SELECT ei.metadata->>'rowKey' AS row_key,",
 "ei.metadata->>'filerRegistrationNumber' AS filer_reg,",
 "ei.metadata->>'year' AS year,",
 "ei.metadata->>'contributorRegistrationNumber' AS donor_reg,",
 "ei.metadata->>'transactionDate' AS tx_on,",
 "ei.metadata->>'contributor' AS contributor,",
 "ei.metadata->>'amount' AS amount",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 'LEFT JOIN memberships m ON m.id=ei.membership_id',
 'LEFT JOIN chambers c ON c.id=m.chamber_id',
 "JOIN receiving x ON x.reg=ei.metadata->>'filerRegistrationNumber'",
 "AND x.year::text=ei.metadata->>'year'",
 "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')",
 "AND ei.metadata->>'subtype'='candidate_contribution_record'",
 "AND ei.metadata->>'rowKey' ~ '^[a-f0-9]{64}$'",
 "AND (c.slug='senate' OR (c.slug IS NULL AND ei.metadata->>'chamber'='senate'))"
].join(' ');
const SQL_REPORTS=[
 'WITH receiving AS (SELECT DISTINCT reg,year FROM jsonb_to_recordset($1::jsonb)',
 'AS x(reg text,year integer))',
 'SELECT v.report_version_id,v.report_year,v.committee_registration,',
 'v.full_original_pdf_sha256 AS pdf_sha,',
 'v.full_original_pdf_bytes AS pdf_bytes',
 'FROM cfb_official_senate_pdf_versions v JOIN receiving x',
 'ON x.reg=v.committee_registration AND x.year=v.report_year',
 'ORDER BY v.report_year DESC,v.report_version_id'
].join(' ');
const SQL_PAGES=[
 'SELECT pdf_sha256,page_number,raw_page_text',
 'FROM cfb_finance_report_schedule_pages',
 'WHERE pdf_sha256=ANY($1::text[])',
 'ORDER BY pdf_sha256,page_number'
].join(' ');
const SQL_BODY=[
 'SELECT pdf_sha256,byte_length,original_pdf',
 'FROM cfb_finance_pdf_body_captures',
 'WHERE pdf_sha256=$1 AND byte_length BETWEEN 501 AND 30000000'
].join(' ');
function asRow(r){
 return {
  filerReg:r.filer_reg,year:Number(r.year),rowKey:r.row_key,
  contributorReg:r.donor_reg??'',transactionDate:r.tx_on,
  contributor:r.contributor,amount:r.amount
 };
}
function hashedRows(rows,{allowConflicts=false}={}){
 const unique=new Map();
 for(const r of rows){
  const row=asRow(r);
  const key=[row.filerReg,row.year,row.rowKey].join('|');
  const prior=unique.get(key);
  if(prior&&JSON.stringify({...prior,sourceConflict:undefined})!==
   JSON.stringify({...row,sourceConflict:undefined})){
   if(!allowConflicts)throw Error('Conflicting original PAC contribution source copies');
   prior.sourceConflict=true;
  }else if(!prior)unique.set(key,row);
 }
 return [...unique.values()];
}
const printable=x=>typeof x==='string'&&x.trim().length>0;

export function safeOriginalPacPageFormatCensus(pages,registrations){
 if(!Array.isArray(pages)||pages.length>30000||
  !Array.isArray(registrations)||registrations.length!==2||
  registrations.some(x=>!(/^[0-9]{3,8}$/.test(x))))
  throw Error('Bounded original PAC source-format census required');
 const counts={
  originalCachedPdfPages:0,
  cachedPagesWithoutReadableText:0,
  originalPagesWithAnyA1ScheduleHeading:0,
  originalPagesWithStrictA1PacHeading:0,
  originalPagesWithGenericA1AndPoliticalCommitteeWords:0,
  originalPagesWithAnyContributionOrReceiptHeading:0,
  originalPagesWithAnyContributionRegistrationColumnHeading:0,
  originalPagesWithAnyCashKindTotalColumns:0,
  originalPagesWithExactRegisteredPACNumber:0,
  originalPagesWithRegisteredPACNumberAndAnyA1:0,
  originalPagesWithRegisteredPACNumberAndPACOrCommitteeWords:0,
  originalPagesWithRegisteredPACNumberAndDateAndMoney:0,
  originalPagesWithEducationOrChamberNameTokens:0,
  originalPagesWithNamedPACAndAnyA1:0,
  originalPagesWithPACNumberOrNameWithoutA1:0
 };
 for(const row of pages){
  const p=String(row.raw_page_text??'').replace(/\s+/g,' ');
  counts.originalCachedPdfPages++;
  if(p.trim().length<15)counts.cachedPagesWithoutReadableText++;
  const a1=/\b(?:SCHEDULE|SCH[.])\s*A\s*1\b/i.test(p);
  const strict=isOriginalA1PacPage(p);
  const pac=/\b(?:PAC|political committee|political fund|P\.?C\.?F\.?)\b/i.test(p);
  const receipts=/\b(?:contributions received|receipts received|itemized (?:receipts|contributions)|contributions from)\b/i.test(p);
  const regCol=/\b(?:registration number|reg[.]?\s*#|registered committee|committee registration)\b/i.test(p);
  const money=/\bcash\b/i.test(p)&&/\bin[- ]?kind\b/i.test(p)&&/\btotal\b/i.test(p);
  const exact=registrations.some(x=>exactPrintedPacReg(p,x));
  const named=/\b(?:education|chamber)\b/i.test(p);
  const dateMoney=/(?:\d{1,2}\/\d{1,2}\/\d{2,4}|20\d{2}-\d\d-\d\d)/.test(p)&&
   /\b\d{1,3}(?:,\d{3})*\.\d{2}\b/.test(p);
  counts.originalPagesWithAnyA1ScheduleHeading+=Number(a1);
  counts.originalPagesWithStrictA1PacHeading+=Number(strict);
  counts.originalPagesWithGenericA1AndPoliticalCommitteeWords+=Number(a1&&pac);
  counts.originalPagesWithAnyContributionOrReceiptHeading+=Number(receipts);
  counts.originalPagesWithAnyContributionRegistrationColumnHeading+=Number(regCol);
  counts.originalPagesWithAnyCashKindTotalColumns+=Number(money);
  counts.originalPagesWithExactRegisteredPACNumber+=Number(exact);
  counts.originalPagesWithRegisteredPACNumberAndAnyA1+=Number(exact&&a1);
  counts.originalPagesWithRegisteredPACNumberAndPACOrCommitteeWords+=Number(exact&&pac);
  counts.originalPagesWithRegisteredPACNumberAndDateAndMoney+=Number(exact&&dateMoney);
  counts.originalPagesWithEducationOrChamberNameTokens+=Number(named);
  counts.originalPagesWithNamedPACAndAnyA1+=Number(named&&a1);
  counts.originalPagesWithPACNumberOrNameWithoutA1+=Number((exact||named)&&!a1);
 }
 return counts;
}

export function geometryPagesForSource({
 reports,pages,pacs,maxPages=MAX_ORIGINAL_TABLE_PAGES
}){
 if(!Array.isArray(reports)||reports.length>830||
  !Array.isArray(pages)||pages.length>30000||
  !Array.isArray(pacs)||pacs.length!==2||
  !Number.isInteger(maxPages)||maxPages<1||maxPages>500)
  throw Error('Bounded original PAC geometry selection required');
 const bySha=new Map();
 for(const p of pages){
  if(!bySha.has(p.pdf_sha256))bySha.set(p.pdf_sha256,[]);
  bySha.get(p.pdf_sha256).push(p);
 }
 const selected=[],seen=new Set();
 let pacA1PageCount=0,originalPagesWithPACRegistration=0,
  imageOrUnrenderedPages=0;
 for(const report of reports){
  for(const p of bySha.get(report.pdfSha)??[]){
   if(!printable(p.raw_page_text)||p.raw_page_text.trim().length<15)
    imageOrUnrenderedPages++;
   // Source-observed production reports use generic A1 labels. Select
   // only an A1 original that ALSO literally displays one of the two
   // independently identified registered PAC numbers and committee context.
   if(!isOriginalA1RegisteredPacPage(
    p.raw_page_text,pacs.map(item=>item.registration)))continue;
   pacA1PageCount++;
   originalPagesWithPACRegistration++;
   const key=report.pdfSha+'|'+p.page_number;
   if(seen.has(key))continue;
   seen.add(key);
   selected.push({
    pdfSha:report.pdfSha,pageNumber:Number(p.page_number),
    rawPageText:p.raw_page_text
   });
  }
 }
 selected.sort((a,b)=>a.pdfSha.localeCompare(b.pdfSha)||a.pageNumber-b.pageNumber);
 return {
  selected:selected.slice(0,maxPages),
  deferred:Math.max(0,selected.length-maxPages),
  allEligible:selected.length,
  pacA1PageCount,originalPagesWithPACRegistration,
  imageOrUnrenderedPages
 };
}
export async function main({inspectTwoOriginalPages}={}){
 assertPac116FinanceReadOnlyGuard(process.env);
 const manifest=validateCfbIssueSourceManifest(JSON.parse(readFileSync(
  'data/evidence/cfb-issue-finance-source-observation-manifest-v1.json','utf8')));
 const config=JSON.parse(readFileSync(
  'data/evidence/cfb-issue-pac-attestation-candidates-v2.json','utf8'));
 const target=await discoverExistingVotePredictNeonConnection({
  apiKey:process.env.NEON_API_KEY,
  projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID,
  preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,
  requirePrimary:true
 });
 const pool=new Pool({
  host:target.host,port:target.port,user:target.role,
  password:target.password,database:target.database,
  ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:15000,
  query_timeout:180000,statement_timeout:180000,
  application_name:'cfb-864-a1-original-pac-geometry-readonly',
  options:'-c statement_timeout=180000 -c lock_timeout=4000'
 });
 const client=await pool.connect();
 let opened=false;
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  opened=true;
  const who=(await client.query(
   "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation"
  )).rows[0];
  if(who?.db!==target.database||who?.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')
   throw Error('Incorrect existing Neon protected read-only transaction identity');
  const registry=(await client.query([
   'SELECT count(*)::int AS total,',
   'count(DISTINCT full_original_pdf_sha256)::int AS unique_shas',
   'FROM cfb_official_senate_pdf_versions'
  ].join(' '))).rows[0];
  if(registry.total!==830||registry.unique_shas!==813)
   throw Error('Source-authenticated CFB PDF 830/813 baseline absent');

  const originals=(await client.query(SQL_ORIGINALS,
   [manifest.map(s=>s.id)])).rows;
  if(originals.length>100)throw Error('Source identity snapshot history out of bounds');
  const snapshots=originals.map(s=>({
   sourceId:s.source_id,organizationGroup:s.organization_group,
   sourceRole:s.source_role,sourceUrl:s.source_url,
   finalUrl:s.final_url,htmlSha256:s.html_sha256,
   rawHtmlBytes:s.raw_html_bytes,
   observedAt:new Date(s.observed_at).toISOString(),
   claimStatus:s.claim_status,
   historicalAsOfEligible:s.historical_asof_eligible,
   mechanicallyActionable:s.mechanically_actionable,
   modelWeight:s.model_weight
  }));
  const statuses=attestCurrentPacSourcePairs({
   snapshots,manifest,config,cutoffOn:new Date().toISOString().slice(0,10)
  }).statuses;
  const approved=statuses.filter(s=>
   s.status==='current_dual_original_source_attested');
  if(approved.length!==2)
   throw Error('Expected exactly two independently source-proven contemporary PACs');
  const regs=approved.map(x=>x.registration);
  const originalRows=(await client.query(SQL_COHORT,[regs])).rows;
  const cohort=hashedRows(originalRows);
  if(cohort.length!==116||originalRows.length>2000)
   throw Error('Unexpected source-attested 116 distinct finance rows');
  const recipientPairs=[...new Map(cohort.map(r=>[
   r.filerReg+'|'+r.year,{reg:r.filerReg,year:r.year}
  ])).values()];
  const rows=(await client.query(SQL_COMPARATOR,
   [JSON.stringify(recipientPairs)])).rows;
  if(rows.length>50000)throw Error('Too many receiving-committee comparison rows');
  const allRows=hashedRows(rows,{allowConflicts:true});
  if(allRows.length<cohort.length)throw Error('Missing full committee comparison data');
  const reportsRaw=(await client.query(SQL_REPORTS,
   [JSON.stringify(recipientPairs)])).rows;
  if(reportsRaw.length>830)throw Error('Report universe outside source reviewed bounds');
  const reports=reportsRaw.map(x=>({
   reportVersionId:x.report_version_id,committeeReg:x.committee_registration,
   reportYear:Number(x.report_year),pdfSha:x.pdf_sha,pdfBytes:x.pdf_bytes
  }));
  const pages=(await client.query(SQL_PAGES,
   [[...new Set(reports.map(r=>r.pdfSha))]])).rows;
  if(pages.length>30000)throw Error('Unbounded private CFB original page text volume');
  const pacs=approved.map(s=>{
   const x=config.candidates.find(c=>
    c.contributorRegistrationNumber===s.registration);
   return {registration:s.registration,officialName:x.officialRegisteredName,
    name:x.exactFirstPartyPacPhrase};
  });
  const selection=geometryPagesForSource({reports,pages,pacs});
  const formatCensus=safeOriginalPacPageFormatCensus(pages,regs);
  const byHash=new Map();
  for(const r of reports){
   if(!byHash.has(r.pdfSha))byHash.set(r.pdfSha,[]);
   byHash.get(r.pdfSha).push(r);
  }
  const pagesByHash=new Map();
  for(const p of selection.selected){
   if(!pagesByHash.has(p.pdfSha))pagesByHash.set(p.pdfSha,[]);
   pagesByHash.get(p.pdfSha).push(p);
  }
  const registeredNames=new Map(pacs.map(p=>[p.registration,p.officialName]));
  const outcomes=[],positionedOutcomes=[];
  let bodiesChecked=0,parseFailures=0,positionedFailures=0;
  for(const [sha,chosenPages] of pagesByHash){
   const originals=(await client.query(SQL_BODY,[sha])).rows;
   const reportsForHash=byHash.get(sha)??[];
   if(originals.length!==1)throw Error('Original CFB PDF source body unavailable');
   const body=originals[0].original_pdf;
   if(body.length!==originals[0].byte_length||
    reportsForHash.some(r=>Number(r.pdfBytes)!==body.length)||
    !independentlyRehashCfbPdf(body,sha))
    throw Error('Original government PDF whole-body SHA invalid');
   bodiesChecked++;
   // Preserve the previous strict vector-table readout, but its absence
   // cannot block independent positioned TEXT diagnostics of this same
   // exact byte-for-byte verified government source PDF.
   const parser=new PDFParse({
    data:new Uint8Array(body),CanvasFactory
   });
   let tablePageResult=null;
   try{
    const parsed=await parser.getTable({
     partial:chosenPages.map(p=>p.pageNumber)
    });
    if(parsed&&Array.isArray(parsed.pages))tablePageResult=parsed.pages;
    else parseFailures+=chosenPages.length;
   }catch{
    parseFailures+=chosenPages.length;
   }finally{await parser.destroy().catch(()=>{});}
   if(tablePageResult){
    const sourceTables=new Map(tablePageResult.map(p=>[
     Number(p.num??p.pageNumber),
     Array.isArray(p.tables)?p.tables:[]
    ]));
    for(const p of chosenPages){
     const tables=sourceTables.get(p.pageNumber);
     if(!tables){parseFailures++;continue;}
     for(const report of reportsForHash){
      outcomes.push(verifyOriginalA1PacTable({
       report:{...report,pageNumber:p.pageNumber},
       pageText:p.rawPageText,tablePages:tables,allRows,
       registeredNames,sourceHashVerified:true
      }));
     }
    }
   }
   // PDF.js accesses actual positioned text spans (x/y/width), not the
   // table-grid recognition that returned zero readable headers on 173
   // authenticated source bodies. Keep the row-level details private.
   const loading=getDocument({
    data:new Uint8Array(body),verbosity:0,disableFontFace:true,
    useSystemFonts:false
   });
   let pdf=null;
   try{
    pdf=await loading.promise;
    for(const p of chosenPages){
     if(p.pageNumber<1||p.pageNumber>pdf.numPages){
      positionedFailures++;continue;
     }
     try{
      const sourcePage=await pdf.getPage(p.pageNumber);
      const text=await sourcePage.getTextContent({
       disableCombineTextItems:true,includeMarkedContent:false
      });
      for(const report of reportsForHash){
       positionedOutcomes.push(reconcilePositionedOriginalA1Page({
        items:text.items,cachedPageText:p.rawPageText,
        report:{...report,pageNumber:p.pageNumber},
        allRows,registeredNames,sourceHashVerified:true
       }));
      }
      sourcePage.cleanup?.();
     }catch{
      // Never print untrusted PDF text or stack traces to public logs.
      positionedFailures++;
     }
    }
   }catch{
    positionedFailures+=chosenPages.length;
   }finally{
    if(pdf)await pdf.destroy().catch(()=>{});
    else await loading.destroy().catch(()=>{});
   }
  }
  if(inspectTwoOriginalPages)await inspectTwoOriginalPages({client,cohort,allRows,reports,pages,positionedOutcomes,registeredNames});
  const summary=safeOriginalA1PacCohortSummary({
   cohort,allRows,reports,pageOutcomes:outcomes,
   pdfHashesChecked:bodiesChecked,
   pagesEligibleForGeometry:selection.allEligible,
   pagesSkippedByLimit:selection.deferred,parseFailedPages:parseFailures
  });
  const positionedSummary=safePositionedOriginalSummary({
   cohort,allRows,reports,pageOutcomes:positionedOutcomes,
   originalBodiesRehashed:bodiesChecked,
   selectedUniquePages:selection.allEligible,
   sourcePagesDeferred:selection.deferred,
   parseErrors:positionedFailures
  });
  summary.originalSourcePagesWithGenericA1AndRegisteredPAC=selection.pacA1PageCount;
  summary.originalA1PacPagesWithLiteralRegisteredPAC=selection.originalPagesWithPACRegistration;
  summary.originalCachedPagesWithoutReadableText=selection.imageOrUnrenderedPages;
  Object.assign(summary,formatCensus);
  await client.query('ROLLBACK');opened=false;
  console.log('CFB_864_PAC116_ORIGINAL_A1_GEOMETRY_SAFE_COUNTS '+JSON.stringify(summary));
  console.log('CFB_864_PAC116_POSITIONED_TEXT_SAFE_COUNTS '+JSON.stringify(positionedSummary));
 }finally{
  if(opened)await client.query('ROLLBACK').catch(()=>{});
  client.release(true);await pool.end();
 }
}
if(import.meta.url==='file://'+process.argv[1]||
 process.argv[1]?.endsWith('/audit-cfb-pac116-original-a1-geometry-readonly.mjs'))
 main().catch(()=>{
  console.error('CFB_864_PAC116_ORIGINAL_A1_GEOMETRY_HELD');
  process.exitCode=1;
 });
