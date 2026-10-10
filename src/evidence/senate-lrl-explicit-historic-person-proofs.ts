/**
 * #864: ONLY three tightly identified, directly dated Minnesota Legislative
 * Reference Library legislator biographies may resolve historic person names
 * or another Senate district. This is NOT a candidate name fuzzy join.
 *
 * All three are official PUBLIC 2026 observations, not historic campaign
 * issue statements and not proof of when biographies were first published.
 */
import {createHash} from 'node:crypto';
import {originalCampaignVisibleText} from './senate-authenticated-campaign-excerpt-audit.js';
import {
  type AuditedOfficialSenateDirectory,validateActualSenateServiceForElection,
} from './senate-official-ever-served-directory.js';
import {strictCandidateKey} from './sos-senate-historical-candidate-inventory.js';

export const LRL_EXACT_SENATE_HISTORIC_IDENTITY_PROOFS_VERSION=
  'mn-lrl-explicit-former-name-and-cross-district-election-proofs-v1';
export const SOURCE_TARGETS=[
 {id:'mary-former-name',lrlId:'15466',candidateName:'Mary Kunesh-Podein',
  electionYear:2020,district:'41',officialName:'Mary K. Kunesh',
  fact:'2020-election-former-name-then-served-2021-senate-41',
  requiredPhrase:'former name kunesh podein',
  requiredPhraseTwo:'senate 2021 2022 district 41'},
 {id:'bonnie-prior-loss',lrlId:'15585',candidateName:'Bonnie Westlin',
  electionYear:2020,district:'34',officialName:'Bonnie Westlin',
  fact:'2020-election-loss-sd34-then-served-2023-senate-42',
  requiredPhrase:'unsuccessful candidate for district 34 of the minnesota senate in 2016 and 2020',
  requiredPhraseTwo:'senate 2023 present district 42'},
 {id:'roger-redistrict-loss',lrlId:'15325',candidateName:'Roger Chamberlain',
  electionYear:2022,district:'36',officialName:'Roger C. Chamberlain',
  fact:'2022-election-loss-sd36-previous-senate-service-sd38',
  requiredPhrase:'ran in the senate district 36 election in 2022 but was defeated',
  requiredPhraseTwo:'senate 2013 2022 district 38'},
] as const;
export type OfficialSenateExceptionalId=typeof SOURCE_TARGETS[number]['id'];
export type VerifiedSenateExceptionalProof={
  id:OfficialSenateExceptionalId;
  candidateName:string;electionYear:number;district:string;
  officialName:string;fact:string;
  sourceUrl:string;observedAt:string;sourceBodySha256:string;
  sourceBodyBytes:number;
  officialOriginalTextContainsBothRequiredFacts:true;
  pageOriginallyPublishedOnKnown:false;
  originalCandidatePolicySourceTextVerified:false;
  usableForForecastTimeSeries:false;
};
export type VerifiedSenateExceptionalPersonSources={
  schema:typeof LRL_EXACT_SENATE_HISTORIC_IDENTITY_PROOFS_VERSION;
  proofs:VerifiedSenateExceptionalProof[];
};
function normalizedText(bytes:Uint8Array){
 return originalCampaignVisibleText(bytes).normalize('NFKC')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function utcObserved(observedAt:string){
 const d=new Date(observedAt);
 if(!Number.isFinite(d.getTime())||d.toISOString()!==observedAt
  ||d.getTime()<Date.parse('2026-10-10T00:00:00.000Z')
  ||d.getTime()>Date.now()+60_000)throw Error('Official biography observed timestamp cannot be fabricated/backdated');
}
export function verifyOfficialSenatorExceptionalSource(
 id:OfficialSenateExceptionalId,html:Uint8Array,observedAt:string,
):VerifiedSenateExceptionalProof {
 const expected=SOURCE_TARGETS.find(t=>t.id===id);
 if(!expected)throw Error('Unknown official senator identity source');
 utcObserved(observedAt);
 if(html.byteLength<4500||html.byteLength>2*1024*1024)
  throw Error('Historic LRL senator source HTML unavailable/oversized');
 const visible=normalizedText(html);
 if(!visible.includes(normalizedText(Buffer.from(expected.officialName)))
   ||!visible.includes(expected.requiredPhrase)
   ||!visible.includes(expected.requiredPhraseTwo))
  throw Error('Official LRL senator source biography lacks exact ID/name/district/election corroboration '+id);
 return {
  id:expected.id,candidateName:expected.candidateName,
  electionYear:expected.electionYear,district:expected.district,
  officialName:expected.officialName,fact:expected.fact,
  sourceUrl:'https://www.lrl.mn.gov/legdb/fulldetail?id='+expected.lrlId,
  observedAt,sourceBodySha256:createHash('sha256').update(html).digest('hex'),
  sourceBodyBytes:html.byteLength,
  officialOriginalTextContainsBothRequiredFacts:true,
  pageOriginallyPublishedOnKnown:false,
  originalCandidatePolicySourceTextVerified:false,
  usableForForecastTimeSeries:false,
 };
}
export function validateVerifiedExceptionalProofs(
 proof:VerifiedSenateExceptionalPersonSources,
) {
 if(proof.schema!==LRL_EXACT_SENATE_HISTORIC_IDENTITY_PROOFS_VERSION
   ||proof.proofs.length!==SOURCE_TARGETS.length)throw Error('Expected all 3 exact LRL biography sources');
 const observed=new Set<string>();
 for(const row of proof.proofs){
  const expected=SOURCE_TARGETS.find(s=>s.id===row.id);
  if(!expected||observed.has(row.id)
   ||row.candidateName!==expected.candidateName
   ||row.electionYear!==expected.electionYear
   ||row.district!==expected.district
   ||row.officialName!==expected.officialName
   ||row.fact!==expected.fact
   ||row.sourceUrl!=='https://www.lrl.mn.gov/legdb/fulldetail?id='+expected.lrlId
   ||!/^[0-9a-f]{64}$/.test(row.sourceBodySha256)
   ||row.sourceBodyBytes<4500||row.sourceBodyBytes>2*1024*1024
   ||row.officialOriginalTextContainsBothRequiredFacts!==true
   ||row.pageOriginallyPublishedOnKnown!==false
   ||row.originalCandidatePolicySourceTextVerified!==false
   ||row.usableForForecastTimeSeries!==false)
   throw Error('Unverified LRL exact name or cross-district former/later Senator proof');
  utcObserved(row.observedAt);
  observed.add(row.id);
 }
}
export function exceptionalFormerOrLaterSenatorMatch(
 official:AuditedOfficialSenateDirectory,
 exception:VerifiedSenateExceptionalPersonSources|undefined,
 candidateName:string,district:string,year:number,
){
 if(!exception)return null;
 validateVerifiedExceptionalProofs(exception);
 const canonical=SOURCE_TARGETS.find(x=>
  x.candidateName===candidateName&&x.district===district&&x.electionYear===year);
 if(!canonical)return null;
 const source=exception.proofs.find(x=>x.id===canonical.id)!;
 // Strict role is Senate, not merely a person on an old House candidacy page.
 // Check official directory has exactly one person matching the BIOGRAPHY's
 // senator display name (first + surname, including suffix semantics).
 const target=strictCandidateKey(canonical.officialName).split(' ');
 const matches=official.senators.filter(row=>{
  const parts=strictCandidateKey(row.officialName).split(' ');
  return parts[0]===target[0]&&parts.at(-1)===target.at(-1)
   &&row.senateServiceTerms.length>0;
 });
 if(matches.length!==1)return null;
 const row=matches[0];
 const term=canonical.id==='mary-former-name'
   ?row.senateServiceTerms.find(t=>t.district==='41'&&t.startsYear<=2021
     &&(t.endsYear===null||t.endsYear>=2021))
   :canonical.id==='bonnie-prior-loss'
   ?row.senateServiceTerms.find(t=>t.district==='42'&&t.startsYear<=2023
     &&(t.endsYear===null||t.endsYear>=2023))
   :row.senateServiceTerms.find(t=>t.district==='38'&&t.startsYear<=2022
     &&(t.endsYear===null||t.endsYear>=2022));
 if(!term)return null;
 return {
  status:'verified_senate_service' as const,officialName:row.officialName,
  term:term.startsYear+'-'+(term.endsYear??'Present')+' SD'+term.district,
  serviceForThisElectionFollowingYearVerified:
   canonical.id==='mary-former-name',
  officialServiceSource:row.officialSourceUrl,
  officialIdentityProofSourceUrl:source.sourceUrl,
  officialIdentityProofObservedAt:source.observedAt,
  officialIdentityProofSourceSha256:source.sourceBodySha256,
  crossDistrictOrNameIdentityProofReason:canonical.fact,
 };
}
