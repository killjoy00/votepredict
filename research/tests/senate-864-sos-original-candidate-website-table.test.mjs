import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateArchivedSenateWebsiteCells} from '../../src/evidence/senate-sos-original-candidate-website-table.mjs';

// Entirely fabricated fixture: DOES NOT represent a new 2020 or 2022 source.
// Checks only the original field-label alignment and negative-evidence
// classification, without copying actual SOS source or private contact data.
const person={surname:'Wiger',officialName:'Sr., Charles W. Wiger',
 officialSosWinnerDistrict:'43',originalFiledName:'Charles "Chuck" Wiger'};
const target={id:'synthetic',people:[person]};
const winners=new Map([['43','Charles "Chuck" Wiger']]);
function originalTable(websiteCell,head='<th>Office</th><th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th>',otherCell='State Senator District 43'){
 return Buffer.from('<!doctype html><html><body><table><tr>'+head+
  '</tr><tr><td>'+otherCell+'</td><td><a href="javascript:__doPostBack(&#39;list&#39;,&#39;2&#39;)">Charles &quot;Chuck&quot; Wiger</a></td>'+
  '<td>Democratic-Farmer-Labor</td><td>'+websiteCell+'</td><td>6/2/2020</td></tr></table></body></html>');
}
test('blank WEBSITE cell in a header-aligned original is only blank at observation time',()=>{
 const data=evaluateArchivedSenateWebsiteCells(originalTable('&nbsp;'),target,winners);
 assert.equal(data.page.numberOriginalHeaderRowsWithWebsiteLabel,1);
 const row=data.candidates[0];
 assert.equal(row.originalWebsiteColumnExplicitlyAlignedByArchivedHeader,true);
 assert.equal(row.originalWebsiteColumnIndex,3);
 assert.equal(row.originalWebsiteCellVisiblyEmpty,true);
 assert.equal(row.originalWebsiteFieldPubliclyDisplayedCandidateURL,null);
 assert.equal(row.noWebsiteShownInThisArchivedListingDoesNotEstablishNoOwnedWebsite,true);
});
test('authentic same-row URL in explicit original WEBSITE column is metadata only',()=>{
 const data=evaluateArchivedSenateWebsiteCells(originalTable('<a href="https://wiger-example.invalid/issues">Campaign Website</a>'),target,winners);
 const row=data.candidates[0];
 assert.equal(row.originalWebsiteCellVisiblyEmpty,false);
 assert.equal(row.originalWebsiteFieldPubliclyDisplayedCandidateURL,'https://wiger-example.invalid/issues');
 assert.equal(row.filedWebsiteDomainAndCampaignAuthorshipNotProvenByCandidateList,true);
 assert.equal(row.originalCandidateDetailTriggerIsASPNetPostback,true);
});
test('raw domain without www or protocol can be recognized only in explicitly labeled site column',()=>{
 const data=evaluateArchivedSenateWebsiteCells(originalTable('fictional-wiger-site.org'),target,winners);
 assert.equal(data.candidates[0].originalWebsiteFieldPubliclyDisplayedCandidateURL,'https://fictional-wiger-site.org/');
});
test('unrelated external link in another cell is NOT automatically an official candidate WEBSITE value',()=>{
 const page=originalTable('&nbsp;',undefined,'<a href="https://www.senate.mn.gov/fictional">Official office</a>');
 const data=evaluateArchivedSenateWebsiteCells(page,target,winners);
 assert.equal(data.candidates[0].originalWebsiteFieldPubliclyDisplayedCandidateURL,null);
 assert.equal(data.candidates[0].originalWebsiteCellVisiblyEmpty,true);
 assert.equal(data.candidates[0].candidateOtherExternalURLRowsNotWebsiteField.length,1);
});
test('unlabeled or misaligned website header is UNKNOWN, not safely blank',()=>{
 const head='<th>Candidate Name</th><th>Party</th><th>Website</th><th>File Date</th>';
 const d=evaluateArchivedSenateWebsiteCells(originalTable('&nbsp;',head),target,winners);
 assert.equal(d.candidates[0].originalWebsiteColumnExplicitlyAlignedByArchivedHeader,false);
 assert.equal(d.candidates[0].originalWebsiteCellVisiblyEmpty,null);
 assert.equal(d.candidates[0].originalWebsiteFieldPubliclyDisplayedCandidateURL,null);
});
test('candidate row cannot be joined to a wrong district winner',()=>{
 assert.throws(()=>evaluateArchivedSenateWebsiteCells(originalTable('&nbsp;'),target,new Map([['43','Jane Somebody Else']])),/Not correct.*winner/);
});
