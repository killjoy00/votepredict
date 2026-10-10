import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

function proof(name:string) {
  const raw=readFileSync(new URL('../docs/evaluation/source-proof/'+name,import.meta.url));
  const gitBlobSha=createHash('sha1').update('blob '+raw.byteLength+'\0').update(raw).digest('hex');
  return {data:JSON.parse(raw.toString('utf8')),gitBlobSha};
}
const {data:p,gitBlobSha}=proof('senate-committee-four-non-elections-original-source-run-provenance-ledger.json');
const {data:semantic}=proof('senate-committee-four-non-elections-motion-context-ledger.json');
const {data:queue,gitBlobSha:queueSha}=proof('senate-committee-19-tally-matched-provisional-roll-review-queue.json');

const hashPattern=/^[a-f0-9]{64}$/;
const cases=[
  {date:'2023-03-03',offset:3840,bill:'SF47',yea:2,nay:6,
   pdf:'99ee409f192fadd8c81c64b63a846fbb8e4b72d05044bac06609ba26e16567b6',
   text:'b9b313d37d8725eeec31773142f7d0d1a9205c29ae47bfdd8419bb1666073771',
   context:'0aa23bc8392d68e558e33d1e84d90faf94dbd6c789b25a3e7dd8940940df808b'},
  {date:'2024-02-15',offset:4729,bill:'SF610',yea:3,nay:5,
   pdf:'a033573c39a8a8b7415b71e8560d11fe2d3b12c6cf9a38822a3c6901b1813b02',
   text:'2f4be795f9f3084bb4fcfbe4f92aca06704af080790d8e810f1c45ec76a554ae',
   context:'14f3aa746658601148a23be4eed8ebd025c732633ca158236586ea7bd0a91be3'},
  {date:'2024-03-07',offset:2517,bill:'SF4483',yea:6,nay:4,
   pdf:'18d899dafd86387a9935052089545b4869bbf0a7f327e5c742a6a64cfe4b31e6',
   text:'a55940c32ba9079794075639dc96a317437be373ce004b70589b444feef51810',
   context:'585d2522cbbd67c64551020abb27347aed3c99bf9f5bb472d1879e166b3cfc11'},
  {date:'2024-03-14',offset:2250,bill:'SF4742',yea:4,nay:3,
   pdf:'22806c56aed9ea5d027c66e34353621bcded18a5ecfb6311ab4415f9e509ae61',
   text:'59177304793bdeb67320568026332d4efbe7c1b06449dda4caa4691045f19c7d',
   context:'46a84554862064c87e5305ec8403e4089cc3b5a7d09b2a9fd79831540f70c138'},
] as const;

test('actual original-source successful run ID and immutable Git blob are pinned',()=>{
  assert.equal(gitBlobSha,'d0239500d1d09a076abfcbe0a02ecd8248a7b87d');
  assert.equal(p.schemaVersion,'senate-four-non-elections-2023-24-original-pdf-hash-motion-provenance-v1');
  assert.equal(p.issue,864);
  assert.equal(p.sourceReviewPr,954);
  assert.equal(p.sourceReviewMergeSha,'ad2498d03920562de8b731cadf5c3cc8b273101f');
  assert.equal(p.actualOneTimeOriginalSourceRunId,38093480954);
  assert.equal(p.actualOneTimeOriginalSourceRunConclusion,'success');
  assert.equal(p.actualOneTimeOriginalSourceRunHeadSha,p.sourceReviewMergeSha);
  assert.equal(p.priorOriginalSourceShaManifestRunId,38075573031);
  assert.equal(p.priorSupplementalNamedTallyRunId,38079646647);
  assert.equal(p.priorNineteenSourceOffsetQueueGitBlobSha,queueSha);
  assert.equal(queueSha,'30f1c8ed6d2d2edcbbefadcf61f8019c1c435538');
});

test('source artifacts and their ZIP+JSON payload SHA are separately pinned per original year',()=>{
  assert.deepEqual(p.yearRuns.map((x:any)=>x.year),[2023,2024]);
  const expected=[
    {year:2023,orig:1,offsets:1,inputId:11678374068,inputZip:'8c009aaefdc2109072ffc8b3962eb9325eb8b9a0f256de4fa4133d3f74a30827',
      inputJson:'71d0395d9957fc37705c0195b87ff8634d9dc572483d549419b812b58ad2931e',
      outputId:11684629342,outputZip:'c69d53e6209e3803b23d696f15924600acb572e9921e1431ae28b1a3cd4e9188',
      outputJson:'be462efdc63c46c9d7e93052693fdb67e661405490f99edfa262c9d57ebe5e64'},
    {year:2024,orig:3,offsets:3,inputId:11677594594,inputZip:'9e36a461d385087a73c76b4b2c172fbb0f8f004aef018ccf0c66e4d6dfc73b4e',
      inputJson:'40ef74819433727e6440375bc14159e5ccf3d94eb3306db8d3a7b279ddb1639d',
      outputId:11684279938,outputZip:'164d256d5e5bbfa953199ab85ff403b6fe5c04a5a812122bd764d02513a9554e',
      outputJson:'6b2419426b1c0b26bc8a2f6f7ab3cab5a2e8bee4b7cadc31fde20a31127065db'},
  ];
  for(let i=0;i<expected.length;i++){
    const a=p.yearRuns[i],e=expected[i]!;
    assert.deepEqual([a.year,a.sourcePdfs,a.sourceOffsets,a.yearOriginalReverified,a.yearOffsetsReverified,a.sourceFailures],
      [e.year,e.orig,e.offsets,e.orig,e.offsets,0]);
    assert.deepEqual([a.immutableInputOriginalMetadataArtifactId,a.actualOneTimeSourceOutputArtifactId],
      [e.inputId,e.outputId]);
    assert.deepEqual([a.immutableInputOriginalMetadataArtifactZipSha256,a.immutableInputOriginalMetadataJsonSha256,
      a.actualOneTimeSourceArtifactZipSha256,a.actualOneTimeSourceJsonSha256],
      [e.inputZip,e.inputJson,e.outputZip,e.outputJson]);
    for(const v of [a.immutableInputOriginalMetadataArtifactZipSha256,a.immutableInputOriginalMetadataJsonSha256,
      a.actualOneTimeSourceArtifactZipSha256,a.actualOneTimeSourceJsonSha256]) assert.match(v,hashPattern);
  }
});

test('all four original SHA-pinned PDF/text/context offsets match original 19-source queue and semantic review',()=>{
  assert.equal(queue.records.length,19);
  assert.equal(semantic.records.length,4);
  assert.equal(p.verifiedOriginals.length,4);
  assert.deepEqual(p.verifiedOriginals.map((r:any)=>r.hearingDate),cases.map(r=>r.date));
  const keys=new Set<string>();
  for(let i=0;i<cases.length;i++){
    const r=p.verifiedOriginals[i],e=cases[i]!;
    assert.equal(r.hearingDate,e.date);
    assert.equal(r.sourceTextOffset,e.offset);
    assert.equal(r.billIdentifier,e.bill);
    assert.equal(r.originalPdfSha256,e.pdf);
    assert.equal(r.originalExtractedTextSha256,e.text);
    assert.equal(r.sourceNearTextSha256,e.context);
    assert.deepEqual([r.explicitlyNamedYea,r.explicitlyNamedNay],[e.yea,e.nay]);
    assert.ok(Number.isInteger(r.pdfByteSize)&&r.pdfByteSize>300);
    assert.ok(!keys.has(r.originalSourcePdfUrl+'|'+r.sourceTextOffset));
    keys.add(r.originalSourcePdfUrl+'|'+r.sourceTextOffset);
    const url=new URL(r.originalSourcePdfUrl);
    assert.equal(url.protocol,'https:');
    assert.equal(url.hostname,'www.lrl.mn.gov');
    assert.ok(url.pathname.startsWith('/archive/minutes/senate/'+r.year+'/'));
    assert.ok(url.pathname.includes('/'+r.hearingDate.replaceAll('-','')+'/'));
    for(const digest of [r.originalPdfSha256,r.originalExtractedTextSha256,r.sourceNearTextSha256])
      assert.match(digest,hashPattern);
    const source=queue.records.filter((x:any)=>x.officialSourcePdfUrl===r.originalSourcePdfUrl && x.sourceTextOffset===r.sourceTextOffset);
    assert.equal(source.length,1);
    assert.deepEqual([source[0].year,source[0].hearingDate,source[0].committeeName,source[0].yeaNamed,source[0].nayNamed],
      [r.year,r.hearingDate,r.committeeName,e.yea,e.nay]);
    const semanticRecord=semantic.records.find((x:any)=>x.officialSourcePdfUrl===r.originalSourcePdfUrl && x.sourceTextOffset===r.sourceTextOffset);
    assert.ok(semanticRecord);
    assert.equal(semanticRecord.motionIdentity.billIdentifier,e.bill);
    assert.equal(semanticRecord.eligibleForPersistedIndividualMemberVote,false);
    assert.equal(semanticRecord.independentHistoricalCommitteeMembershipVerified,false);
    assert.equal(r.sourceCountMatchesNamedSides,true);
    assert.equal(r.indexedDateEqualsPrintedDate,true);
    assert.equal(r.originalWeekdayConsistent,true);
    assert.equal(r.machineDetectedOpeningAbsentAssignedVote,0);
    assert.equal(r.independentSourceVerifiesThisSpecificAmendmentNamedSides,false);
    assert.equal(r.sourceMotionContextDoesNotEstablishFinalBillStance,true);
  }
});

test('motion-specific absences, source-copy limitation and missing HHS header are fail-closed',()=>{
  assert.equal(p.actualSourceRecheck.uniqueOriginalPdfsReverified,4);
  assert.equal(p.actualSourceRecheck.independentOriginalPdfAndExtractedTextShaMatches,4);
  assert.equal(p.actualSourceRecheck.exactSourceTextOffsetsReproduced,4);
  assert.equal(p.actualSourceRecheck.sourceNamedYeaTokens,15);
  assert.equal(p.actualSourceRecheck.sourceNamedNayTokens,18);
  assert.equal(p.actualSourceRecheck.totalExplicitNamedYeaNayTokens,33);
  assert.equal(p.actualSourceRecheck.downloadOrHashOrParserFailures,0);
  assert.equal(p.actualSourceRecheck.sameSourceHeaderDateMismatch,0);
  assert.equal(p.actualSourceRecheck.sameSourceHeaderWeekdayMismatch,0);
  assert.equal(p.actualSourceRecheck.absentHeaderParserUnableToLocateSection,1);
  assert.equal(p.actualSourceRecheck.candidatesEligibleForPrivateMemberVoteImport,0);
  const hhs=p.verifiedOriginals[1],labor7=p.verifiedOriginals[2],labor14=p.verifiedOriginals[3];
  assert.deepEqual(hhs.sourceFlags,['attendance_absence_section_not_located']);
  assert.equal(hhs.attendanceAbsenceSectionLocatedByMachine,false);
  assert.equal(hhs.sourceAbsenceNotMachineCertified,true);
  assert.equal(hhs.sourceRollListsOneAbsentMemberExplicitly,true);
  assert.deepEqual(labor7.sourceFlags,[]);
  assert.equal(labor7.originalLrlSourceExcerptMatchesPublisherMotionBillTallyAndNamedSides,true);
  assert.equal(labor7.officialPublisherIsRepublishingSameMinutesNotIndependentMotionEvidence,true);
  assert.equal(labor14.sourceRollShowsTwoInitiallyPresentMembersMarkedAbsentAtMotion,true);
  assert.equal(labor14.duplicateRecommendationNarrativeDoesNotCountAsSecondNamedRoll,true);
  assert.equal(p.methodology.independentBillLogsConfirmBillHandlingDatesButNotVoteChoices,true);
  assert.equal(p.methodology.publicationOfSameMinutesNotIndependentSecondSource,true);
  assert.equal(p.methodology.evidenceNotCertifiedForProductionOrDBCorrection,true);
  assert.equal(p.methodology.noPrivateDatabaseReadOrWritePerformed,true);
  assert.equal(p.methodology.noForecastModelTrainingServingScheduler2027OrFloorVotePipelineChanges,true);
  assert.equal(p.methodology.year2021PrintAnd2022MixedOfficialDenominatorsRemainUnknown,true);
  assert.equal(p.methodology.issue864MustStayOpen,true);
});
