import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORIGINAL_SENATE_JUDICIARY_MARCH12_2025,
  verifySenateJudiciaryMarch2025NamedOriginal,
  originalSenateNamedChoicesDistinct,
} from '../src/evidence/senate-committee-2025-judiciary-ocr-roll-proof.js';

type Input = Parameters<typeof verifySenateJudiciaryMarch2025NamedOriginal>[0];
const expected=ORIGINAL_SENATE_JUDICIARY_MARCH12_2025;
const tokens='abcdefgh'.split('').map(x => x.repeat(64));
function valid(): Input {
  return {
    document: {
      year:expected.year,
      committeeName:expected.committeeName,
      meetingDate:expected.meetingDate,
      sourceUrl:expected.url,
      originalRawPdfSha256:expected.originalPdfSha256,
      extractedTextSha256:expected.ocrTextSha256,
      extractionMethod:'ocr_tesseract',
    },
    sourceParserTotals:{namedRollCalls:1,namedMemberChoicesInPdf:8},
    voteObservations:[{
      externalKey:expected.voteEventExternalKey,
      individualVotesAvailable:true,
      yeaCount:5,nayCount:3,namedMemberChoicesInPdf:8,
      choiceIdentitySha256:[...tokens],
      finalPassageStanceInferred:false,
    }],
    contextOnlyActions:[
      {individualVotesAvailable:false,finalPassageStanceInferred:false},
      {individualVotesAvailable:false,finalPassageStanceInferred:false},
    ],
    parserVersions:{recordedVotes:'mn-senate-committee-minutes-v2',contextActions:'mn-senate-committee-actions-v1'},
    sourceSignalHints:{rollCallPhrase:1},missingness:{completeVoteDenominatorCertified:false},
    timing:{sameDayEligible:false},
  } as unknown as Input;
}

test('the one authentic 2025 scanned Judiciary original is pinned by original PDF/OCR digests and exact external key',()=>{
  assert.equal(expected.meetingDate,'2025-03-12');
  assert.match(expected.originalPdfSha256,/^[a-f0-9]{64}$/);
  assert.match(expected.ocrTextSha256,/^[a-f0-9]{64}$/);
  assert.equal(expected.sourceNamedMemberChoices,8);
  assert.equal(expected.sourceNamedRollCandidates,1);
  assert.equal(expected.sourceContextOnlyMotionCandidates,2);
  const result=verifySenateJudiciaryMarch2025NamedOriginal(valid());
  assert.equal(result.originalRawPdfAndTextShaBothIndependentlyReverified,true);
  assert.equal(result.voteObservations.length,1);
  assert.equal(result.voteObservations[0]?.choiceIdentitySha256.length,8);
  assert.equal(result.contextOnlyActions.length,2);
  assert.equal(result.senatorIdentityMatchedToHistoricalMembership,false);
  assert.equal(result.sourceNamedRollAutomaticallyAddedToDb,false);
  assert.equal(result.sourceNamedRollEligibleForForecast,false);
  assert.equal(result.originalPdfOrExtractedOCRTextStored,false);
  assert.equal(result.originalSourceDoesNotProveOfficialHistoricalAllVoteDenominator,true);
});

test('changed original PDF, changed OCR text, wrong hearing year/committee or a different source are blocked',()=>{
  const edits=[
    (x:Input)=>{x.document.originalRawPdfSha256='f'.repeat(64);},
    (x:Input)=>{x.document.extractedTextSha256='f'.repeat(64);},
    (x:Input)=>{x.document.meetingDate='2025-03-13';},
    (x:Input)=>{x.document.committeeName='Finance';},
    (x:Input)=>{x.document.sourceUrl='https://example.org/fake.pdf';},
    (x:Input)=>{x.document.extractionMethod='embedded_text';},
  ];
  for(const edit of edits){
    const x=valid();edit(x);
    assert.throws(()=>verifySenateJudiciaryMarch2025NamedOriginal(x),/identity changed/);
  }
});

test('named Senator roll requires explicit 8 hashed choices, consistent yea/nay tally and no inferred floor stance',()=>{
  const edits=[
    (x:Input)=>{x.voteObservations[0]!.externalKey='senate-committee:incorrect:0';},
    (x:Input)=>{x.voteObservations[0]!.yeaCount=10;},
    (x:Input)=>{x.voteObservations[0]!.namedMemberChoicesInPdf=7;},
    (x:Input)=>{x.voteObservations[0]!.choiceIdentitySha256.pop();},
    (x:Input)=>{x.voteObservations[0]!.choiceIdentitySha256[0]='unhashed_member';},
    (x:Input)=>{x.voteObservations[0]!.choiceIdentitySha256[0]=tokens[1]!;},
    (x:Input)=>{x.voteObservations[0]!.individualVotesAvailable=false;},
    (x:Input)=>{x.voteObservations[0]!.finalPassageStanceInferred=true;},
    (x:Input)=>{x.contextOnlyActions[0]!.individualVotesAvailable=true;},
    (x:Input)=>{x.contextOnlyActions[0]!.finalPassageStanceInferred=true;},
    (x:Input)=>{x.contextOnlyActions.pop();},
  ];
  for(const edit of edits){
    const x=valid();edit(x);
    assert.throws(()=>verifySenateJudiciaryMarch2025NamedOriginal(x),/missing or unsafe|parser yield changed/);
  }
});

test('original named-senator OCR observation refuses duplicated senator surname on both YEA and NAY sides',()=>{
  const names=['Johnson','Marty','Eichorn','Limmer','Murphy','Rest','Pappas','Champion']
    .map((name,i)=>({normalizedName:name.toLowerCase(),choice:i<5?'yea':'nay'}));
  assert.equal(originalSenateNamedChoicesDistinct(names,8),true);
  assert.equal(originalSenateNamedChoicesDistinct(names.slice(0,7),8),false);
  const conflict=names.map(row=>({...row}));
  conflict[7]!.normalizedName=conflict[0]!.normalizedName;
  conflict[7]!.choice='nay';
  assert.equal(originalSenateNamedChoicesDistinct(conflict,8),false);
  const wrong=names.map(row=>({...row}));
  wrong[0]!.choice='abstain';
  assert.equal(originalSenateNamedChoicesDistinct(wrong,8),false);
});
