import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const doc=JSON.parse(readFileSync(new URL('../data/evaluation/senate-864-public-social-and-caucus-alternative-source-leads-v1.json',import.meta.url),'utf8'));

test('strict 95 senator / 92 owned-person / 1285 short site row corpus is unchanged',()=>{
 assert.equal(doc.issue,864);
 assert.equal(doc.exactGovernmentBaseline.actualServingSenators2021to2025,95);
 assert.equal(doc.exactGovernmentBaseline.peopleWithAuthenticatedOriginalCandidateOwnedWebsites,92);
 assert.equal(doc.exactGovernmentBaseline.selectedOwnedWebsiteExcerpts,1285);
 assert.equal(doc.effectOnVerifiedCorpus.newAuthenticatedOriginalCandidateOwnedWebsitePeople,0);
 assert.equal(doc.effectOnVerifiedCorpus.newAuthenticatedOriginalCampaignWebsiteExcerpts,0);
 assert.equal(doc.effectOnVerifiedCorpus.newAuthenticallyDatedSpeakerScopedStatementExcerpts,0);
});
test('research mirror text and retroactive party data never becomes historical candidate-owned policy',()=>{
 const social=doc.publicSources.filter(s=>s.category==='independent_academic_public_research_mirror');
 assert.equal(social.length,2);
 const candidates=new Map([['Sr., Charles W. Wiger','43'],['David J. Tomassoni','6']]);
 for(const s of social){
  assert.equal(s.official2020District,candidates.get(s.senator));
  assert.ok(s.url.startsWith('https://picso101.sci.pitt.edu/CivicWatch/who/'));
  assert.equal(s.exactOriginalPostIdsObtained,0);
  assert.equal(s.exactOriginalHistoricalPostBodiesAuthenticated,0);
  assert.equal(s.originalElectionCyclePublicationCutoffAuthenticated,false);
  assert.equal(s.retweetsMustNotBeTreatedAsCandidateOwnSpeech,true);
  for(const lead of s.unverifiedSpeakerLeads){
   assert.match(lead.displayedDate,/^2020-\d{2}-\d{2}$/);
   assert.equal(lead.originalPostId,null);
   assert.ok(lead.paraphrase.length<180);
  }
  assert.ok(s.unverifiedSpeakerLeads.some(p=>p.isRepostOnResearchDisplay));
 }
 const tomassoni=social.find(s=>s.senator==='David J. Tomassoni');
 assert.equal(tomassoni.displayedParty,'Independent');
 assert.equal(tomassoni.original2020OfficialElectionParty,'Democratic-Farmer-Labor');
 assert.equal(tomassoni.retroactivelyLabeledPartyMustNotBeAssignedToPreNov2020Source,true);
});
test('DAPR 2025 academic source describes a potential self-service post-ID route, not recovered raw 2020 posts',()=>{
 const x=doc.publicSources.find(x=>x.id==='dapr-methods-and-original-post-id-route');
 assert.equal(x.publicationDate,'2025-09-25');
 assert.equal(x.directDatasetFilesIndependentlyRetrievedHere,false);
 assert.equal(x.archiveResearchMirrorAndDAPRExactRecordCorrespondenceVerified,false);
 assert.equal(x.originalPlatformPostIdDecodedAndTextMatchedForTargets,false);
 assert.equal(x.dateRecordedInAcademicDatasetIsNotDirectOriginalBodyPreElectionSourceReceipt,true);
 assert.match(x.publicDownloadLandingUrl,/^https:\/\/dataverse\.harvard\.edu\//);
});
test('senator authored caucus page is separately typed and lacks independently recovered 2020 original full body',()=>{
 const s=doc.publicSources.find(x=>x.id==='wiger-2020-july-school-safety-caucus');
 assert.equal(s.displayedPublicationDate,'2020-07-20');
 assert.equal(s.sourceCandidateOwnedWebsite,false);
 assert.equal(s.originalArchived2020HTMLSha1IndexedAndWholeSha256VerifiedHere,false);
 assert.equal(s.originalCaptureBefore2020ElectionIndependent,false);
 assert.equal(s.literalQuoteAdmittedInThisRound,false);
});
test('already authenticated Bakk 2020 publisher Q&A cannot be double counted as a new website',()=>{
 const s=doc.publicSources.find(x=>x.id==='bakk-previously-audited-2020-kaxe');
 assert.equal(s.official2020District,'3');
 assert.equal(s.originalSpeakerScopedResearchLedgerAlreadyExists,true);
 assert.equal(s.newStatementHere,false);
 assert.equal(s.sourceCandidateOwnedWebsite,false);
});
test('publication timing uncertainty, personal privacy, non-contact and production isolation are mandatory',()=>{
 const p=doc.currentSourceLimitations;
 assert.equal(p.original2020And2022SOS21ColumnFiledCandidateWebsiteExportStillUnretrieved,true);
 assert.equal(p.currentlyVisibleOldPostDateIsNotIndependentSourceCaptureDate,true);
 assert.equal(p.missingTwitterPostIdAndOriginalPlatformBodyBlockNewStatementAdmission,true);
 assert.equal(p.personallyIdentifyingAddressPhoneEmailOrWholeCopyrightedCorpusNotPersisted,true);
 assert.equal(p.noAutomaticInferenceFromAcademicTopicOrVotingPosition,true);
 assert.equal(p.noOutsideContactEmailsRecordsRequests,true);
 assert.equal(p.noProductionDatabaseReadsWrites,true);
 assert.equal(p.noTrainingForecastAppSchedulerOrDeployChanges,true);
});
