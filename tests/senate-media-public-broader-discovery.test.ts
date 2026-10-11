/** #987 public senator media DISCOVERY does not establish original historical words. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const current=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json','utf8',
));
const old18=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json','utf8',
));
const old31=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-public-article-discovery-2021-25.json','utf8',
));
const rows=current.selectedPublicSourceLeads as Array<{
 id:string;url:string;publisher:string;currentPageDisplayedDates:string[];
 attributionCategory:string;
 individuallyNamedSenatorSpeakers:Array<{name:string;officialMemberHistoryUrl:string}>;
 observation:string;existingCohortOverlapCheckedAgainstOriginal31AndEarlier18:boolean;
 hasOriginalHistoricalArchivedBodySha256:false;exactQuoteFragmentHistoricallyChecked:false;
 originalPublishingTimestampVerified:false;namedSenatorQuotationApprovedForHistoricalEvidence:false;
 anyPrivateEvidenceReadOrMatched:false;anyLegislativeVoteProvedByThisPage:false;
}>;

test('25 genuinely new URLs and five selected publication-page dates per year, with no complete-corpus claim',()=>{
  assert.equal(current.version,'senate-media-2021-25-public-broader-source-discovery-v1');
  assert.equal(current.researchCheckedOn,'2026-10-11');
  assert.equal(rows.length,25);assert.equal(current.distinctPageCount,25);
  assert.deepEqual(current.countsByDisplayedYear,
    [2021,2022,2023,2024,2025].map(year=>({year,leads:5})));
  assert.deepEqual(current.samplesNotPublisherUniverse,{
    previousSelectedMprAndReformer:31,previousCaucusInterviewCohort:18,newAdditionalLeads:25,
  });
  const existing=new Set<string>([
    ...old18.selectedNewPublicSourcePages.map((x:{sourceUrl:string})=>x.sourceUrl),
    ...old31.selectedNonExhaustiveArticleLeads.map((x:{livePageUrl:string})=>x.livePageUrl),
  ]);
  const seen=new Set<string>();
  for(const row of rows){
    assert.ok(!seen.has(row.url),'duplicate new public page');seen.add(row.url);
    assert.ok(!existing.has(row.url),'old selected URL incorrectly counted as new');
    const parsed=new URL(row.url);
    assert.equal(parsed.protocol,'https:');assert.equal(parsed.search,'');assert.equal(parsed.hash,'');
    assert.ok(['senatedfl.mn','www.mnsenaterepublicans.com','minnesotareformer.com']
      .includes(parsed.hostname));
    assert.match(row.id,/^public-20(?:21|22|23|24|25)-[a-z0-9-]+$/);
    assert.ok(row.currentPageDisplayedDates.length>=1&&row.currentPageDisplayedDates.length<=2);
    for(const date of row.currentPageDisplayedDates){
      assert.match(date,/^20(?:21|22|23|24|25)-\d\d-\d\d$/);
      assert.equal(new Date(date+'T00:00:00Z').toISOString().slice(0,10),date);
      assert.equal(date.slice(0,4),row.id.slice(7,11));
    }
    assert.equal(row.existingCohortOverlapCheckedAgainstOriginal31AndEarlier18,true);
    assert.equal(row.hasOriginalHistoricalArchivedBodySha256,false);
    assert.equal(row.exactQuoteFragmentHistoricallyChecked,false);
    assert.equal(row.originalPublishingTimestampVerified,false);
    assert.equal(row.namedSenatorQuotationApprovedForHistoricalEvidence,false);
    assert.equal(row.anyPrivateEvidenceReadOrMatched,false);
    assert.equal(row.anyLegislativeVoteProvedByThisPage,false);
    assert.ok(row.observation.length>=8);
    for(const senator of row.individuallyNamedSenatorSpeakers){
      assert.ok(senator.name.length>=7);
      assert.match(senator.officialMemberHistoryUrl,
        /^https:\/\/www\.lrl\.mn\.gov\/legdb\/fulldetail\?ID=\d+$/);
    }
  }
  assert.equal(current.noArchiveBodyOrSpeakerQuoteAuthenticatedInThisNewCohort,true);
  assert.equal(current.publisherChronologyAndFirstPublicByNotProven,true);
  assert.equal(current.noPublisherPublicationCensusOrStatewideDenominator,true);
  assert.equal(current.noDatabasePrivateVoteOrForecastDataCompared,true);
});

test('distinguish explicit TWO speaker-labels in one Bigham/Eken story from three collective/mixed-chamber stories',()=>{
  assert.deepEqual(current.sourceAttributionCategoryCounts,{
    individual:20,two_labeled_individuals:1,independent_reporter_attributed:1,
    mixed_chamber_collective:2,unattributed_caucus_collective:1,
  });
  const bigham=rows.find(x=>x.id==='public-2022-bigham-eken-separated')!;
  assert.equal(bigham.attributionCategory,'two_labeled_individuals');
  assert.deepEqual(bigham.individuallyNamedSenatorSpeakers.map(x=>x.name),
    ['Karla Bigham','Kent Eken']);
  assert.equal(current.multiSenatorPageWithIndividuallyLabeledTurns,bigham.id);
  assert.equal(current.separateDirectSpeakerTurnCandidates,23);
  const holds=rows.filter(x=>x.individuallyNamedSenatorSpeakers.length===0);
  assert.deepEqual(holds.map(x=>x.id),[
    'public-2023-blandin-mixed-joint',
    'public-2024-inclusive-mixed-joint',
    'public-2025-senate-gop-collective',
  ]);
  assert.deepEqual(current.collectivelyUnassignedPages,holds.map(x=>x.id));
  assert.ok(holds.every(x=>x.attributionCategory.includes('collective')));
  assert.ok(holds.some(x=>x.observation.includes('HOUSE')));
  assert.ok(rows.some(x=>x.attributionCategory==='independent_reporter_attributed'
    &&x.publisher==='Minnesota Reformer'
    &&x.individuallyNamedSenatorSpeakers[0]?.name==='Ann Rest'));
});

test('serving-senator date boundaries and named-subject mentions are not silently conflated',()=>{
  const clark=rows.find(x=>x.id==='public-2025-clark-ice-student')!;
  assert.deepEqual(clark.currentPageDisplayedDates,['2025-03-28','2025-04-01']);
  assert.ok(clark.observation.includes('Feb 3 2025'));
  const former=rows.find(x=>x.id==='public-2021-torres-ray-retirement')!;
  assert.equal(former.currentPageDisplayedDates[0],'2021-11-16');
  const murphy=rows.find(x=>x.id==='public-2023-murphy-reproduction')!;
  assert.equal(murphy.individuallyNamedSenatorSpeakers[0]?.name,'Erin Murphy');
  const mitchell=rows.find(x=>x.id==='public-2024-mitchell-tax')!;
  assert.equal(mitchell.individuallyNamedSenatorSpeakers[0]?.name,'Nicole Mitchell');
  const rasmusson=rows.find(x=>x.id==='public-2025-rasmusson-trial')!;
  assert.equal(rasmusson.individuallyNamedSenatorSpeakers[0]?.name,'Jordan Rasmusson');
  assert.ok(rasmusson.observation.includes('Mitchell mentioned as subject only'));
  assert.ok(rows.filter(x=>x.currentPageDisplayedDates.length===2).length===4);
});
