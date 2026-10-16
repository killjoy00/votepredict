/**
 * Election-outcome SCOPE ONLY for RAW Minnesota Senate questionnaires.
 *
 * 2026 is uncalled: retain all 2026 candidate Q&A, including challengers.
 * Earlier campaigns are useful here only if the person won the specific
 * Senate election covered by their questionnaire. No poll, prediction,
 * primary win, incumbency guess, or same-district inference can substitute.
 *
 * This allowlist covers respondents in the bounded 2022, 2024 and 2025
 * original-publisher catalogs. Extend only with the Secretary of State's
 * actual *general/special* election results when another winner is found.
 * Dates and results source URLs remain separate from questionnaire dates.
 */
export interface HistoricalSenateWinner {
  cycle:2022|2024|2025;
  district:string;
  candidate:string;
  electionDate:string;
  resultUrl:string;
}
const SOS_2022='https://electionresults.sos.mn.gov/Results/Index?ersElectionId=149&scenario=StateSenate';
const SOS_2024='https://electionresults.sos.mn.gov/Results/Index?ersElectionId=170&scenario=StateSenate';
const SOS_2025='https://electionresults.sos.mn.gov/results/Index?DistrictId=548&ErsElectionId=178&scenario=StateSenate&show=Go';
export const HISTORICAL_QUESTIONNAIRE_WINNERS:readonly HistoricalSenateWinner[]=[
  {cycle:2022,district:'3',candidate:'Grant Hauschild',electionDate:'2022-11-08',resultUrl:SOS_2022},
  {cycle:2022,district:'8',candidate:'Jen McEwen',electionDate:'2022-11-08',resultUrl:SOS_2022},
  {cycle:2022,district:'21',candidate:'Bill Weber',electionDate:'2022-11-08',resultUrl:SOS_2022},
  {cycle:2022,district:'23',candidate:'Gene Dornink',electionDate:'2022-11-08',resultUrl:SOS_2022},
  {cycle:2022,district:'49',candidate:'Steve Cwodzinski',electionDate:'2022-11-08',resultUrl:SOS_2022},
  {cycle:2024,district:'45',candidate:'Ann Johnson Stewart',electionDate:'2024-11-05',resultUrl:SOS_2024},
  {cycle:2025,district:'60',candidate:'Doron Clark',electionDate:'2025-01-28',resultUrl:SOS_2025},
];

/**
 * The 2022 original Bio-Fuels *heading* prints "Billl Weber", while its
 * introductory copy prints "Bill Weber" and the Secretary of State reports
 * Bill Weber as SD21's 2022 winner. Preserve the literal heading in raw
 * captures; use the canonical name only for verified scope and ID joins.
 * This spelling exception is NOT a fuzzy match and is source-URL specific.
 */
const PRINTED_WINNER_ALIASES=[{
  cycle:2022,district:'21',printedName:'Billl Weber',canonicalName:'Bill Weber',
  sourceUrl:'https://mnbiofuels.org/candidates-biofuels-weber-dornink',
}] as const;

function normalizeName(s:string):string{
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function normalizeDistrict(raw:string|null|undefined):string|null{
  if(!raw)return null;
  const m=/^(?:district\s*)?0*([1-9]|[1-5]\d|6[0-7])$/i.exec(raw.trim());
  return m?String(Number(m[1])):null;
}
/** Canonicalize only a documented publisher typo, without changing raw text. */
export function historicalWinnerCanonicalName(
  cycle:number,candidate:string,district:string|null|undefined,sourceUrl?:string|null,
):string{
  const districtKey=normalizeDistrict(district),nameKey=normalizeName(candidate);
  const alias=PRINTED_WINNER_ALIASES.find(a=>a.cycle===cycle && a.district===districtKey
    && normalizeName(a.printedName)===nameKey && a.sourceUrl===sourceUrl);
  return alias?.canonicalName??candidate;
}
/** Fail closed for historical unknowns, not for the unfinished 2026 election. */
export function eligibleSenateQuestionnaireCandidate(
  cycle:number,candidate:string,district:string|null|undefined,sourceUrl?:string|null,
):boolean{
  if(!candidate.trim())return false;
  if(cycle===2026)return true;
  const districtKey=normalizeDistrict(district);
  if(!districtKey)return false;
  const nameKey=normalizeName(historicalWinnerCanonicalName(cycle,candidate,district,sourceUrl));
  return HISTORICAL_QUESTIONNAIRE_WINNERS.some(w=>
    w.cycle===cycle && w.district===districtKey && normalizeName(w.candidate)===nameKey);
}
