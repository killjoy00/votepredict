/** #864. Strict source identity and conservative TERMINATION vs form-text distinctions. */
import type {ActualSenatorCfbCommittee} from './cfb-2023-24-official-committee-status-proof.js';
const EXACT=[
 {registrationNumber:'18763',senator:'Steve Drazkowski',district2022:20},
 {registrationNumber:'17362',senator:'Bruce Douglas Anderson',district2022:29},
] as const;
export function selectTwoTerminatedSenators(original22:ActualSenatorCfbCommittee[]){
 if(original22.length!==22||new Set(original22.map(s=>s.registrationNumber)).size!==22)
  throw Error('Original Minnesota 22-serving senator registration cohort changed');
 for(const s of EXACT){
  if(!original22.some(x=>x.registrationNumber===s.registrationNumber
     &&x.senator===s.senator&&x.district2022===s.district2022))
   throw Error('Terminated-as-of-current exact senator/registration identity not source authenticated');
 }
 return EXACT.map(x=>({...x}));
}
export function inspectPossibleOriginalCfbTerminationReportText(input:{
 reportText:string;registrationNumber:string;expectedSurname:string;
 versionKey:string;reportName:string;
}){
 const t=input.reportText.replace(/\u0000/g,'').replace(/\s+/g,' ').trim();
 const first=t.slice(0,7000);
 const reg=new RegExp('(?:^|\\D)'+input.registrationNumber+'(?:\\D|$)');
 const surname=new RegExp('\\b'+input.expectedSurname+'\\b','i');
 if(t.length<1000||!/^(\d{5}):(?:25|26):pcc:[A-Z]+:\d+:\d+$/.test(input.versionKey)
   ||!input.versionKey.startsWith(input.registrationNumber+':')
   ||!reg.test(first)||!surname.test(first))
  throw Error('Original CFB PDF does not authenticate expected principal registration and senator');
 // A form may print instructions / an UNCHECKED box with these words.
 // The presence/absence of this literal is deliberately not interpreted
 // as a filing of a final termination report or Board acceptance.
 const formMentionsTermination=/\bterminat(?:ion|e|ed|ing)\b/i.test(first);
 const formMentionsFinal=/\bfinal\s+(?:campaign\s+finance\s+)?report\b/i.test(first);
 const boardReceipt=t.match(/Received by the Board\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
 const period=t.match(/Period Covered:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+through\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
 return{
  pdfContainsExactFirstPageRegAndSurname:true,
  formMentionsTermination,
  formMentionsFinal,
  boardPrintedReceiptText:boardReceipt?.[1]??null,
  originalPrintedCoverageStart:period?.[1]??null,
  originalPrintedCoverageEnd:period?.[2]??null,
  originalPdfOriginalReportName:input.reportName,
  candidateTerminationFormCheckboxChecked:null,
  actualTerminationAcceptanceOrDate:null,
  actualCommitteeActiveIn2023or2024:null,
  originalPublicByDate:null,
  sourceLimit:'printed_header_or_unchecked_checkbox_not_historical_termination',
 } as const;
}

/** The Board's *current* recent-termination register is a source-specific
 * record with a listed date, but not the signed filing or evidence of its
 * voluntary/admin path. Missing recent-list rows never mean not terminated. */
export function classifyTwoSenatorsInPublicCfbCurrentLists(
 allRegisteredRows:readonly {registrationNumber:string;office:string|null;district:string|null;registrationDate:string|null;terminationDate:string|null}[],
 recentlyTerminatedRows:readonly {registrationNumber:string;office:string|null;district:string|null;registrationDate:string|null;terminationDate:string|null}[],
){
 const targets=EXACT.map(x=>x.registrationNumber);
 return targets.map(reg=>{
  const all=allRegisteredRows.filter(x=>x.registrationNumber===reg);
  const recent=recentlyTerminatedRows.filter(x=>x.registrationNumber===reg);
  if(all.length>1||recent.length>1)
   throw Error('Official current Board list contains multiple rows for one exact target registration');
  const selected=recent[0]??all[0]??null;
  if(selected&&(selected.office!=='Senate'||selected.registrationDate===null||
    (selected.terminationDate!==null&&selected.terminationDate<selected.registrationDate)))
   throw Error('CFB source current committee row office, registration or termination chronology contradiction');
  if(recent.length===1 && !recent[0]!.terminationDate)
   throw Error('CFB current recent-terminated source row has no exact termination date');
  return{
   registrationNumber:reg,
   observedInAllRegisteredCandidatesCurrent2026:all.length===1,
   observedInRecentlyTerminatedCandidatesCurrent2026:recent.length===1,
   registrationDateListedIn2026Snapshot:selected?.registrationDate??null,
   terminationDateListedIn2026RecentTerminationSnapshot:recent[0]?.terminationDate??null,
   status:recent.length===1?'dated_official_recent_termination_registry_row'
     :all.length===1?'present_in_current_registered_registry_but_no_recent_termination_date'
      :'not_observed_in_these_current_snapshot_lists',
   historical2023Or2024CommitteeTermination:null,
   legalVoluntaryOrAdministrativeTerminationMechanism:null,
   verifiedOriginalTerminationReportPdf:null,
   proofIsNotBoardSignedFinalReport:true,
  };
 });
}
