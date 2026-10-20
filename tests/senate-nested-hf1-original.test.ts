import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSenateJournal} from '../src/sources/minnesota/senate-journals.js';
import {parseNestedSenateSourcePapers} from '../src/operations/senate-vote-paper-nested.js';
import {parseJournalPaperActions,stripInterposedSenateJournalRollHeader} from '../src/operations/senate-vote-paper-parser.js';
import {parseSenateJournalText} from '../src/sources/minnesota/senate-journals.js';

/**
 * A keyless primary-source proof in ordinary PR CI, not a protected production
 * action. It outputs only the government PDF digest and safe aggregate counts.
 * Offline development runs skip this canary; production original verification
 * independently pins the same bytes.
 */
test('HF1 nested papers are present in independently downloaded 2023 official Senate Journal',
 {skip:process.env.GITHUB_ACTIONS!=='true',timeout:150_000},async()=>{
  const journal=await fetchSenateJournal('https://www.senate.mn/journals/2023-2024/20230127014.pdf');
  const nested=parseNestedSenateSourcePapers(journal.text).filter(p=>p.billIdentifier==='HF1');
  console.log('SENATE_HF1_NESTED_ORIGINAL_KEYLESS='+JSON.stringify({
   source:'2023-2024/20230127014.pdf',pdfSha256:journal.pdfSha256,
   pdfBytes:journal.byteLength,nestedPapers:nested.length,
   rejected:nested.filter(p=>p.disposition==='rejected').length,
   adoptedToParent:nested.filter(p=>p.disposition==='adopted_to_parent').length,
   unresolved:nested.filter(p=>p.disposition==='unknown').length,
   acceptedEventLinks:0,assembledBillStates:0
  }));
  assert.ok(journal.byteLength>1000&&nested.length>=3,
   'Original Journal must contain at least three complete nested proposals');
  console.log('SENATE_HF1_NESTED_PROOF_CHECKS='+JSON.stringify({
   firstLuceroParentFound:nested.some(p=>p.parentMover==='Lucero'&&p.parentOrdinal==='first'),
   namedMayeQuadeParentAdoptionFound:nested.some(p=>p.mover==='Maye Quade'
    &&p.parentMover==='Lucero'&&p.disposition==='adopted_to_parent'),
   mayeQuadeSourcePapers:nested.filter(p=>p.mover==='Maye Quade').length,
   explicitParentAdoptions:nested.filter(p=>p.disposition==='adopted_to_parent').length
  }));
  assert.ok(nested.some(p=>p.parentMover==='Lucero'&&p.parentOrdinal==='first'));
  assert.ok(nested.every(p=>!p.appliesDirectlyToBill&&!p.acceptedVoteEventLinked&&!p.fullBillTextAssembled));
  assert.equal(journal.pdfSha256,'0604a308854471523dcd282769cfadb45ed403d1ad39383a3d20438393e3fd52',
   'Original HF1 journal PDF bytes differ from independent keyless source receipt');
  assert.equal(journal.byteLength,1_806_101);
  assert.ok(nested.some(p=>p.mover==='Maye Quade'&&p.parentMover==='Lucero'
   &&p.disposition==='adopted_to_parent'));
});


test('HF100 original paper verifier replay has complete named rolls and explicit parent version',
 {skip:process.env.GITHUB_ACTIONS!=='true',timeout:150_000},async()=>{
  const original=await fetchSenateJournal('https://www.senate.mn/journals/2023-2024/20230428059.pdf');
  const names=original.text.slice(0,original.text.indexOf('The President declared')).split('\n')
   .map(x=>x.trim()).filter(x=>/^[A-Z][A-Za-z ]+$/.test(x));
  const actions=parseJournalPaperActions(original.text,names).filter(x=>x.billIdentifier==='HF100');
  const procedural=actions.filter(a=>a.kind==='procedural'&&a.yeas===33&&a.nays===34);
  const state={
   sha256:original.pdfSha256,byteLength:original.byteLength,
   names:names.length,actions:actions.length,proposedPapers:actions.filter(a=>a.proposedText).length,
   amendmentsAdopted:actions.filter(a=>a.kind==='amendment'&&a.outcome==='adopted').length,
   amendmentsRejected:actions.filter(a=>a.kind==='amendment'&&a.outcome==='rejected').length,
   explicitUnofficialBase:actions.filter(a=>a.kind==='amendment'&&a.baseLocator==='versions/ue/1/').length,
   namedDivisionActions:actions.filter(a=>a.ballotSignature!==null).length,
   proceduralCount:procedural.length,
   proceduralCompleteBallots:procedural.filter(a=>a.ballotSignature!==null).length,
   lastKind:actions.at(-1)?.kind??null,
   priorAdoptionsOnLast:actions.at(-1)?.priorAdoptedKeys.length??null
  };
  console.log('SENATE_HF100_MAIN_ORIGINAL_CANARY_DIAGNOSTIC='+JSON.stringify(state));

  const unresolved=procedural.find(a=>a.ballotSignature===null);
  if(unresolved?.rollStart!==null&&unresolved?.rollStart!==undefined){
   const begin=Math.max(0,unresolved.rollStart-500);
   const next=original.text.indexOf('The roll was called,',unresolved.rollStart+40);
   const block=original.text.slice(begin,next>begin?next:unresolved.rollStart+8_000);
   const stripped=stripInterposedSenateJournalRollHeader(block);
   let parseFailure:null|string=null;
   let ballots:ReturnType<typeof parseSenateJournalText>=[];
   try{
    ballots=parseSenateJournalText({text:stripped,sessionKey:'source-only',
     sourceUrl:'https://example.test/HF100-pratt-diagnostic',knownMemberNames:names,
     allowRosterMismatch:true});
   }catch(error){parseFailure=error instanceof Error?error.name:'unknown'}

   const dayMarker=block.indexOf('59TH DAY]');
   const asFollows=dayMarker>=0?block.lastIndexOf('as follows:',dayMarker):-1;
   const namedHeading=dayMarker>=0?block.indexOf('Those who voted in the affirmative were:',dayMarker):-1;
   const between=asFollows>=0&&namedHeading>asFollows
    ?block.slice(asFollows+'as follows:'.length,namedHeading):'';
   const structural={
    boundaryIdentified:asFollows>=0&&namedHeading>asFollows,
    gapCharacters:between.length,whitespaceCharacters:(between.match(/\s/g)||[]).length,
    redactedHeaderLayout:between.replace(/[A-Za-z]/g,'A').replace(/[0-9]/g,'0').replace(/\s+/g,' ').slice(0,120),
    alphaRuns:[...between.matchAll(/[A-Za-z]+/g)].map(m=>m[0].length),digitRuns:[...between.matchAll(/\d+/g)].map(m=>m[0].length),
    nonAsciiCharacters:[...between].filter(ch=>ch.charCodeAt(0)>127).length,
    hasDayMarker:between.includes('59TH DAY]'),
    hasWeekday:/\bFRIDAY\b/i.test(between),
    hasMonth:/\bAPRIL\b/i.test(between),
    hasYear:between.includes('2023'),
    hasFolio:between.includes('6889'),
    hasDocumentTitle:/JOURNAL OF THE SENATE/i.test(between),
    startsWithBracket:/^\s*\[/i.test(between),
    endsWithDigits:/\d+\s*$/.test(between),
    numberOfYearStrings:(between.match(/2023/g)||[]).length,
    numberOfDayStrings:(between.match(/59TH\s+DAY/g)||[]).length,
    numberOfNamedHeaders:(between.match(/Those who voted/gi)||[]).length,
    charClassSignature:[...between].slice(0,140).map(ch=>/[\d]/.test(ch)?'D':/[A-Za-z]/.test(ch)?'L':/\s/.test(ch)?'S':'P').join('').replace(/(.)\1+/g,(_x,c)=>c)
   };
   console.log('SENATE_HF100_PAGE_BOUNDARY_DIAGNOSTIC='+JSON.stringify(structural));

   console.log('SENATE_HF100_MISSING_BALLOT_DIAGNOSTIC='+JSON.stringify({
    hasRollStart:true,headerStripped:stripped!==block,
    sourceMarkerPresent:block.includes('59TH DAY]'),
    strictRollHeaderRecognized:/The roll was called,\s*and there were yeas\s+33\s+and nays\s+34, as follows:\s*Those who voted in the affirmative were:/i.test(stripped),
    parsedBallots:ballots.length,parsedYeaCounts:ballots.map(x=>x.yeaCount),
    parsedNayCounts:ballots.map(x=>x.nayCount),
    parsedYeaNames:ballots.map(x=>x.memberVotes.filter(v=>v.choice==='yea').length),
    parsedNayNames:ballots.map(x=>x.memberVotes.filter(v=>v.choice==='nay').length),
    parseFailure
   }));
  }

  assert.equal(original.pdfSha256,'9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3');
  assert.equal(actions.length,8);assert.equal(procedural.length,2);
  assert.equal(state.namedDivisionActions,7);
  assert.equal(state.proceduralCompleteBallots,2);
});
