/**
 * #864: read-only senator/year/issue overlay using only independently audited
 * official serving-95 source matrix + immutable public research receipts.
 *
 * Do NOT infer "no policy" from unsampled years; do NOT pretend original
 * candidate-site evidence from an old cycle is 2023 bill-specific policy;
 * do NOT interpret a joint article as 2 original individual speeches.
 */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ISSUES} from './audit-senate-864-substantive-public-positions-offline.mjs';
const rosterSha='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sha=/^[a-f0-9]{64}$/;
const known=fn=>JSON.parse(readFileSync(fn,'utf8'));
const ledgerFile={
 old:'data/evaluation/senate-864-historically-authenticated-and-current-primary-substantive-claims-v1.json',
 bonding:'data/evaluation/senate-864-bonding-four-conditional-statements-original-hf669-hf670-personal-rolls-v1.json',
 wiger:'data/evaluation/senate-864-wiger-three-2021-22-original-firstparty-publisher-receipts-v1.json',
 joint:'data/evaluation/senate-864-bakk-tomassoni-2021-line3-signed-original-joint-leads-v1.json'
};
const readAll=()=>({prior:known(ledgerFile.old),bonding:known(ledgerFile.bonding),wiger:known(ledgerFile.wiger),joint:known(ledgerFile.joint)});
const distinct=xs=>[...new Set(xs)].sort();
const firstYear=s=>Number(String(s).slice(0,4));
export function auditOverlayMatrix(matrix,ledgers=readAll()){
 const {prior,bonding,wiger,joint}=ledgers;
 assert.equal(matrix.schema,'senate-864-95-serving-person-year-issue-current-firstparty-lead-matrix-v1');
 assert.equal(matrix.sourceOriginal95RosterSha256,rosterSha);
 assert.equal(matrix.totals.actualServedSenators,95);
 assert.equal(matrix.totals.siteCoveredSenators,92);
 assert.equal(matrix.totals.siteExcerptsSelected,1285);
 assert.equal(matrix.totals.serviceYearIssueCells,5085);
 assert.equal(prior.claims.length,33);
 assert.equal(bonding.bySenator.length,4);
 assert.equal(wiger.originals.length,3);
 assert.equal(wiger.counts.verifiedSignedSingleSenatorQuotedOriginals,1);
 assert.equal(joint.officialServingPersonNames.length,2);
 const names=new Map(matrix.byActuallyServedSenator.map(x=>[x.officialName,x]));
 assert.equal(names.size,95);
 let cells=0,newGovVoteEvents=0,yearRows=0,personSiteTotal=0;
 const rows=matrix.byActuallyServedSenator.map(orig=>{
  const row={...orig,serviceYears:orig.serviceYears.map(y=>({
    ...y,issueCells:Object.fromEntries(Object.entries(y.issueCells).map(([area,cell])=>[
     area,{...cell,independentOriginalIndividualStatementEvidence:[],
      officialIndividuallyNamedVoteEvidence:[],
      originalPublisherUnsignedOrUnverifiedLeads:[],
      signedJointStatementOriginalAuthenticationStatus:null,
      archivalSourceDoesNotImplyOfficialVote:true,
      asOfProductionSourcePresenceVerified:false}
    ]))
  }))};
  const map=new Map(row.serviceYears.map(y=>[y.year,y]));
  const expectedYears=distinct(orig.actualSenateServiceYears);
  assert.equal(map.size,expectedYears.length);
  for(const year of expectedYears){
   assert.ok(map.has(year));
   assert.deepEqual(Object.keys(map.get(year).issueCells),[...ISSUES]);
   cells+=ISSUES.length;yearRows++;
  }
  personSiteTotal+=orig.selectedHistoricCampaignOwnedShortExcerptCount;
  return row;
 });
 assert.equal(cells,5085);assert.equal(personSiteTotal,1285);
 const byName=new Map(rows.map(x=>[x.officialName,x]));
 const at=(name,year,issue)=>{
  const r=byName.get(name);
  assert.ok(r,'Not an actual 95 senator: '+name);
  assert.ok(ISSUES.includes(issue),'Not an approved exact issue: '+issue);
  const y=r.serviceYears.find(x=>x.year===year);
  assert.ok(y,'Original current speaker attributed outside serving year: '+name+' '+year);
  return y.issueCells[issue];
 };
 const added=[],historicalOutsideService=[];
 for(const q of prior.claims){
  const day=q.sourceStatementDate||q.publisherDisplayedPublicationDate;
  const year=firstYear(day);
  if(year<2021||year>2025){historicalOutsideService.push(q.claimId);continue;}
  const cell=at(q.officialSenatorName,year,q.issue);
  const payload={id:q.claimId,origin:'previous_named_senator_research_ledger_33',
   sourceUrl:q.sourceUrl,sourceSha256:q.sourceOriginalHtmlSha256,
   independentlyVerifiedPublicByUtc:q.independentlyEstablishedHistoricalPublicByUtc,
   firstSourcePublishedUtcStillUnverified:true,
   quotePresentation:q.attributionKind||'individual_written_statement',
   memberOfficialVoteNotImpliedByQuote:true,
   historicPredictionAsOfExistingDatabaseVerified:false};
  if(q.sourceIntegrity==='independently_archived_full_body_sha1_sha256'){
   assert.match(payload.sourceSha256,sha);assert.match(payload.independentlyVerifiedPublicByUtc,/^20/);
   cell.independentOriginalIndividualStatementEvidence.push(payload);
  }else{
   assert.equal(payload.independentlyVerifiedPublicByUtc,null);
   cell.originalPublisherUnsignedOrUnverifiedLeads.push(payload);
  }
  added.push(q.claimId);
  if(q.relatedOfficialPersonalVote?.official===true){
   const vote=q.relatedOfficialPersonalVote;
   if(ISSUES.includes(q.issue)&&/^(?:HF|SF)/.test(vote.bill)){
    cell.officialIndividuallyNamedVoteEvidence.push({sourceClaimId:q.claimId,
     officialVoteBill:vote.bill,recordedVoteChoice:vote.choice,
     originalJournalPdfSha256:q.relatedOfficialVotePdfSha256,
     passageEventDate:q.eventDate||null,
     partialVersionTextAndMotionStillNeedExactReconciliation:true,
     notProductionLabel:true});
    newGovVoteEvents++;
   }
  }
 }
 for(const person of bonding.bySenator){
  const cell=at(person.officialName,2023,'transport_infrastructure');
  for(const v of person.verifiedVotes){
   if(v.senatorChoice==='UNKNOWN')continue;
   const event=bonding.eventJournals.find(e=>e.id===v.eventId);
   assert.ok(event);
   assert.match(event.sha256,sha);
   cell.officialIndividuallyNamedVoteEvidence.push({
    sourceClaimId:'bonding-2023-'+v.eventId+'-'+person.officialName,
    officialVoteBill:event.bill,recordedVoteChoice:v.senatorChoice,
    motionKind:event.motion,passageEventDate:event.date,
    originalJournalPdfSha256:event.sha256,originalPdfPageOneBased:event.rollPageOneBased,
    differentMarchMayAmendedBillVersionsMustStayDistinct:true,
    notProductionLabel:true,
    voteNotExplainedByPreviouslyObservedStatement:true
   });
   newGovVoteEvents++;
  }
  const tax=at(person.officialName,2023,'taxes_budget');
  const entry={id:'2023-bonding-conditional-'+person.individualOriginalPublishedStatementPrimaryId,
    sourceUrl:person.sourcePageUrl,
    issue:'tax_relief_condition_before_bonding',
    originalArchivePublicByUtc:person.originalQuoteArchivePublicByUtc,
    originalStatementIndividuallyBoundedFromAuthenticatedHtml:person.quoteSourceHistoricOriginalAuthenticated,
    conditionsCouldHaveChangedDuringCompromise:true,
    exactBillVersionNotEstablished:true,
    noVoteMotivationInferred:true
  };
  if(person.quoteSourceHistoricOriginalAuthenticated){
   assert.equal(person.officialName,'Mark T. Johnson');
   tax.independentOriginalIndividualStatementEvidence.push({...entry,
    sourceSha256:bonding.sourceOriginalFullDocumentAndQuoteProof.wholeRawHtmlSha256,
    quotedBoundedSha256:bonding.sourceOriginalFullDocumentAndQuoteProof.selectedBoundedNamedQuoteSha256});
  }else tax.originalPublisherUnsignedOrUnverifiedLeads.push(entry);
 }
 for(const orig of wiger.originals){
  if(!orig.quoteBoundedToSignedSenator)continue;
  const c=at('Sr., Charles W. Wiger',2021,'education_childcare');
  c.independentOriginalIndividualStatementEvidence.push({
   id:'2021-Wiger-SF960-signed-archived-exact',
   sourceUrl:orig.url,sourceSha256:orig.rawHtmlSha256,
   independentlyVerifiedPublicByUtc:orig.archiveCaptureUtc,
   shortPolicies:orig.selectedExactShortPolicyFragments.map(x=>x.excerpt),
   afterPriorSF960April22ThirdReading:true,
   postVoteIssueCriticismCannotBeUsedBeforeApril22:true,
   noOfficialPersonalVoteClaimFromQuotedStatement:true,
   historicalOriginalWrittenSignedSenatorBoundariesVerified:true,
   publisherNotCandidateOwnedOriginalCampaignWebsite:true
  });
 }
 const jointNotVerified=joint.officialServingPersonNames;
 for(const name of jointNotVerified){
  const c=at(name,2021,'climate_environment_energy');
  c.signedJointStatementOriginalAuthenticationStatus={
   sourceUrl:joint.sourceHtmlUrls[0].url,
   sourceDay:joint.sourceDisplayedDay,
   historicalOriginalPublicByVerified:false,
   speakerStatus:'named_joint_legislator_signatory_not_personally_spoken_verbatim',
   policyScope:joint.endorsedPolicyScope,
   duplicatePublisherIsNotIndependentPolicyStatement:true,
   mustNeverCountAsHistoricalOriginalUntilSourceSHAProof:true
  };
 }
 const all=rows.flatMap(x=>x.serviceYears.flatMap(y=>Object.entries(y.issueCells).map(([issue,cell])=>({
  person:x.officialName,year:y.year,issue,
  nOriginal:cell.independentOriginalIndividualStatementEvidence.length,
  nOfficialVote:cell.officialIndividuallyNamedVoteEvidence.length,
  nUnverified:cell.originalPublisherUnsignedOrUnverifiedLeads.length,
  nUnverifiedJoint:cell.signedJointStatementOriginalAuthenticationStatus?1:0
 }))));
 assert.equal(all.length,5085);
 const output={schema:'senate-864-95-person-year-issue-matrix-with-2023-bonding-and-2021-wiger-originals-v1',
 issue:864,officialRosterOriginalSHA256:rosterSha,
 denominators:{actualServingSenators:95,candidateOriginalSiteCoveredSenators:92,
  authenticSelectedCandidateSiteResearchExcerpts:1285,actualServingYearIssueCells:5085},
 summary:{
  thisResearchIsNotExhaustiveHistoricalPolicyCorpus:true,
  personYearIssueCellsWithAnyIndividuallyNamedArchivedStatement:all.filter(x=>x.nOriginal>0).length,
  personYearIssueCellsWithAnyExactOriginalJournalMemberVote:all.filter(x=>x.nOfficialVote>0).length,
  personYearIssueCellsWithOnlyUnverifiedCurrentPublisherStatement:all.filter(x=>x.nOriginal===0&&x.nUnverified>0).length,
  unverifiedJointSignedOriginalCells:all.filter(x=>x.nUnverifiedJoint>0).length,
  selfReportedSenateMemberBallotsInferredFromCampaignSite:0,
  newNamedLegislativeVoteEventLinksIncludingPreviousOriginalAnchors:newGovVoteEvents,
  originalPriorClaimRowsInServingYears:added.length,
  older2020OriginalRemarksKeptInSourceContextNotRetroactivelyMisdated:historicalOutsideService,
  sourceOriginalQuoteNeverAutomaticallyAsOfStoredBacktestEvidence:true,
  noProductionDatabaseModelOrServingModifications:true
 },
 byActuallyServedSenator:rows,
 documentedUnknowns:[
  '2021 Bakk/Tomassoni signed joint Line3 source archive CDX unavailable; not an individually spoken quotation',
  '2023 May22 HF670 individual Housley and Weber choice remains UNKNOWN, no floor roster inference',
  '2023 March/May HF669 underlying specific floor text versions different; separate event IDs',
  'Quote source archival public-by does not establish private evidence ingestion or first publisher authored minute',
  'Full statewide hearing and transcript source denominator remains unknown',
  'Three senators Wiger Bakk Tomassoni still have zero historic authenticated candidate-owned original Senate site excerpts'
 ]};
 return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const a=process.argv.indexOf('--source-matrix-json');
 assert.ok(a>=0&&process.argv[a+1]);
 const o=process.argv.indexOf('--out'),out=o>=0?resolve(process.argv[o+1]):'/tmp/senate-864-95-person-substantive-overlaid.json';
 const result=auditOverlayMatrix(known(resolve(process.argv[a+1])));
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({out,summary:result.summary,denominators:result.denominators}));
}
