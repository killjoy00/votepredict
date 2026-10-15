/**
 * #864 January 24, 2023 Rules SF1:
 * Privacy-safe, DIAGNOSTIC ONLY original named-choice/roster reconciliation.
 * No name, alias, legislator id, membership id, candidate id, original
 * text fragment or edit-distance "identity guess" is exposed in a receipt.
 * Even a uniquely plausible alternate name formatting is NOT a verified
 * hearing-day legislator identity and does not authorize a stored vote.
 */
import {normalizeMemberName} from '../sources/minnesota/house-votes.js';
import {reconcileHouseMemberName,type MembershipCandidate} from
 '../sources/minnesota/member-reconciliation.js';

const words=(s:string)=>normalizeMemberName(s).split(' ').filter(Boolean);
const sortedWords=(s:string)=>words(s).sort().join('|');
const substantiveWords=(s:string)=>words(s).filter(t=>t.length>1).sort().join('|');
const aliases=(c:MembershipCandidate)=>[
 c.name,...(c.normalizedName?[c.normalizedName]:[]),...(c.aliases??[])
].filter(Boolean);
const uniqueCandidateMatches=(source:string,active:MembershipCandidate[],
 match:(source:string,candidate:string)=>boolean):number=>{
 const ids=new Set(active.filter(c=>aliases(c).some(a=>match(source,a)))
  .map(c=>c.membershipId));
 return Math.min(2,ids.size);
};
const stripSenateTitles=(source:string)=>source.trim().replace(
 /^(?:(?:senator|sen\.|chair|vice\s+chair|minority\s+lead|ranking\s+member)\s+)+/gi,'').trim();
export type UnmatchedRulesNameHypothesis={
 sourcePosition:number;
 words:number;
 hasComma:boolean;
 dottedInitial:boolean;
 hasHonorific:boolean;
 hasCompoundPunctuation:boolean;
 exactTokenBagCandidatesCapped2:number;
 withoutInitialsCandidatesCapped2:number;
 honorificStrictMatch:boolean;
 inactiveStrictMatch:boolean;
 hypothesisOnly:true;
};
export function diagnoseUnmatchedRulesSenatorName(
 sourceName:string,position:number,active:MembershipCandidate[],
 fullRoster:MembershipCandidate[]):UnmatchedRulesNameHypothesis{
 if(!Number.isSafeInteger(position)||position<0||position>9||
  sourceName.length>120||active.length>150||fullRoster.length>150)
  throw Error('Bounded original unresolved public senator-name diagnostics required');
 const normalized=stripSenateTitles(sourceName);
 const allMatches=reconcileHouseMemberName(sourceName,fullRoster);
 const activeMatches=reconcileHouseMemberName(sourceName,active);
 const strippedMatches=reconcileHouseMemberName(normalized,active);
 const tokenBag=sortedWords(normalized),nonInitial=substantiveWords(normalized);
 return {
  sourcePosition:position,
  words:Math.min(8,words(sourceName).length),
  hasComma:sourceName.includes(','),
  dottedInitial:/\b[A-Z]\./i.test(sourceName),
  hasHonorific:/^(?:Senator|Sen\.|Chair|Vice\s+Chair)\s+/i.test(sourceName),
  hasCompoundPunctuation:/[-']/u.test(sourceName),
  exactTokenBagCandidatesCapped2:tokenBag?
   uniqueCandidateMatches(normalized,active,(a,b)=>sortedWords(a)===sortedWords(b)):0,
  withoutInitialsCandidatesCapped2:nonInitial&&
    words(normalized).filter(w=>w.length>1).length>=2?
   uniqueCandidateMatches(normalized,active,(a,b)=>substantiveWords(a)===substantiveWords(b)):0,
  honorificStrictMatch:activeMatches.status!=='matched'&&
    strippedMatches.status==='matched',
  inactiveStrictMatch:activeMatches.status!=='matched'&&
    allMatches.status==='matched',
  hypothesisOnly:true
 };
}
