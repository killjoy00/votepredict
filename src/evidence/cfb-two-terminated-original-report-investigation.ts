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