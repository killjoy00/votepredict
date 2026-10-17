/**
 * Research-only, source-first CFB financial relationship features.
 *
 * This deliberately does not classify individuals/employers by political
 * identity, infer that a contribution caused a vote, infer "industry" from an
 * organization's name, or convert an annual post-vote scorecard into a
 * historical pre-vote signal.
 *
 * No serving integration, model weights, or database mutations.
 */
export const CFB_ISSUE_FINANCE_SHADOW_VERSION='cfb-issue-financial-relationships-shadow-v1';
export const ISSUE_FINANCE_MODES=Object.freeze(['strict_public_as_of','retrospective_activity']);
const POSITIVE=/^(?:support|for|(?:bill (?:passed|failed),? )?chamber supported|a ['"\u201c]yes['"\u201d] vote supports the nfib position)\b/i;
const NEGATIVE=/^(?:oppose|against|(?:bill (?:passed|failed),? )?chamber opposed|a ['"\u201c]no['"\u201d] vote supports the nfib position)\b/i;
const HASH=/^[a-f0-9]{64}$/i;
const REG=/^[0-9]{3,8}$/;
const DATE=/^20\d{2}-\d{2}-\d{2}$/;
const HTTPS_URL=/^https:\/\/[^?#\s]+(?:[/?#][^\s]*)?$/i;

export function sourceDate(value){
 if(typeof value!=='string'||!DATE.test(value))return null;
 const t=new Date(value+'T00:00:00Z');
 return !Number.isNaN(t.valueOf())&&t.toISOString().slice(0,10)===value?value:null;
}

export function classifyLiteralPublisherBillPosition(value){
 if(typeof value!=='string')return null;
 const s=value.trim().replace(/\s+/g,' ');
 // Scorecards often mention amendments, procedural motions or a separate
 // "correct vote". Those may have a different stance from whole-bill passage.
 if(!s||/\bamendment\b|\bmotion\b|\bprocedural\b/i.test(s)||
  /\bcorrect vote\b/i.test(s)||s.length>240)return null;
 const explicit=/^(?:support|oppose|against|for|(?:bill (?:passed|failed),? )?chamber (?:supported|opposed)|a ['\"\u201c](?:yes|no)['\"\u201d] vote supports the nfib position)[.]?$/i;
 if(!explicit.test(s))return null;
 if(POSITIVE.test(s)&&!NEGATIVE.test(s))return 'support';
 if(NEGATIVE.test(s)&&!POSITIVE.test(s))return 'oppose';
 return null;
}
function officialCfbSourceUrl(url){
 if(!HTTPS_URL.test(url??''))return false;
 const hostname=new URL(url).hostname.toLowerCase();
 return ['cfb.mn.gov','register.cfb.mn.gov',
  'cfb.state.mn.us','register.cfb.state.mn.us'].includes(hostname);
}
export function validAffiliation(record){
 // Explicitly source-supported registry crosswalk only. A string match,
 // shared employer or donor name is never sufficient to join two legal entities.
 return Boolean(record&&typeof record==='object'&&
  record.relationship==='verified_organizational_affiliation'&&
  REG.test(record.contributorRegistrationNumber??'')&&
  typeof record.groupName==='string'&&record.groupName.trim().length>4&&
  officialCfbSourceUrl(record.officialCfbUrl)&&
  HTTPS_URL.test(record.firstPartyAffiliationUrl??'')&&
  HASH.test(record.officialCfbSha256??'')&&HASH.test(record.firstPartySha256??'')&&
  sourceDate(record.validatedOn)&&sourceDate(record.relationshipPublicByOn)&&
  sourceDate(record.affiliationEffectiveOn)&&
  record.relationshipOriginalProof===true);
}
const key=(...parts)=>parts.join('|');
const fixedCents=value=>{
 const n=Number(value);
 return Number.isFinite(n)&&n>0&&n<=10000000?Math.round(n*100):null;
};
function dedupeRecords(rows){
 const rowsByKey=new Map(),conflicts=new Set();
 for(const record of rows){
  if(!HASH.test(record.rowKey??''))continue;
  const id=key(record.kind,record.filerRegistrationNumber,record.rowKey);
  const prev=rowsByKey.get(id);
  if(!prev){rowsByKey.set(id,record);continue;}
  const fields=['kind','filerRegistrationNumber','contributorRegistrationNumber',
   'transactionDate','amount','direction','availableOn','availabilityProofKind'];
  if(fields.some(f=>String(record[f]??'')!==String(prev[f]??'')))conflicts.add(id);
 }
 for(const id of conflicts)rowsByKey.delete(id);
 return {rows:[...rowsByKey.values()],conflictingDuplicateRowKeys:conflicts.size};
}
function safeMemberMoney(record,mode,cutoff){
 const amount=fixedCents(record.amount);
 if(amount===null||!REG.test(record.filerRegistrationNumber??'')||
  !REG.test(record.contributorRegistrationNumber??'')||
  !sourceDate(record.transactionDate)||record.transactionDate>=cutoff)return null;
 if(mode==='strict_public_as_of'){
  // Hardest gate. Historical publication assertion alone is not enough if
  // original row-to-disclosure mapping is not independently demonstrated.
  if(record.rowSpecificDisclosureProof!==true||
   record.asOfEligible!==true||
   !['original_report_exact_row_public_by','independent_archive_capture_exact_row']
    .includes(record.rowSpecificProofKind)||
   !HASH.test(record.rowSpecificProofSha256??'')||
   !HTTPS_URL.test(record.rowSpecificProofUrl??'')||
   !sourceDate(record.availableOn)||record.availableOn>=cutoff||
   record.availableOn<record.transactionDate)return null;
 }
 return amount;
}
function eligibleGroupPosition(position,mode,cutoff){
 if(!position?.billId||!position?.groupName)return null;
 const stance=classifyLiteralPublisherBillPosition(position.groupPositionRaw);
 if(!stance)return null;
 if(!HASH.test(position.snapshotSha256??'')||
  !HTTPS_URL.test(position.sourceUrl??''))return null;
 const published=sourceDate(position.publishedOn);
 if(mode==='strict_public_as_of'){
  // Original issue position must have been publicly available before vote.
  // Fetched_at and the scorecard vote year NEVER substitute publication.
  if(!published||published>=cutoff||position.dateIsVerifiedPublication!==true)
   return null;
 }
 // Retrospective activity may use later-disclosed contributions, but NEVER
 // learn a group's issue position from a post-vote scorecard: that is direct
 // target leakage and is not defensible for prediction research.
 if(!published||published>=cutoff||position.dateIsVerifiedPublication!==true)
  return null;
 return stance;
}
export function issueFinancialRelationshipFeatures(input){
 const {billId,memberCommitteeRegistration,cutoffOn,
  mode,affiliations,groupBillPositions,financeRows}=input??{};
 if(!ISSUE_FINANCE_MODES.includes(mode))throw Error('Unknown issue-finance clock');
 const cutoff=sourceDate(cutoffOn);
 if(!cutoff||!billId||!REG.test(memberCommitteeRegistration??''))
  throw Error('Missing frozen bill, member finance committee or as-of cutoff');
 if(!Array.isArray(affiliations)||!Array.isArray(groupBillPositions)||
  !Array.isArray(financeRows))throw Error('Missing source arrays');
 const affiliationsByReg=new Map(),conflictedRegs=new Set();
 for(const x of affiliations){
  if(!validAffiliation(x))continue;
  // A retrospective analyst may confirm an entity identity later, but may
  // not retroject an undated or newly-established affiliation into the past.
  if(x.relationshipPublicByOn>=cutoff||x.affiliationEffectiveOn>=cutoff)continue;
  const reg=x.contributorRegistrationNumber,group=x.groupName.trim();
  if(affiliationsByReg.has(reg)&&affiliationsByReg.get(reg)!==group)
   conflictedRegs.add(reg);
  else affiliationsByReg.set(reg,group);
 }
 for(const reg of conflictedRegs)affiliationsByReg.delete(reg);
 const groupStances=new Map(),conflictedGroups=new Set();
 for(const position of groupBillPositions){
  if(String(position.billId)!==String(billId))continue;
  const stance=eligibleGroupPosition(position,mode,cutoff);
  if(!stance)continue;
  const group=position.groupName.trim();
  if(groupStances.has(group)&&groupStances.get(group)!==stance)
   conflictedGroups.add(group);
  else groupStances.set(group,stance);
 }
 for(const group of conflictedGroups)groupStances.delete(group);
 const {rows,conflictingDuplicateRowKeys}=dedupeRecords(financeRows);
 const byStance={support:{count:0,cents:0,groups:new Set()},
  oppose:{count:0,cents:0,groups:new Set()}};
 let unverifiedAffiliationRows=0,notAsOfRows=0,excludedIndependentExpenditures=0;
 let knownActivityRows=0;
 for(const row of rows){
  if(row.filerRegistrationNumber!==memberCommitteeRegistration)continue;
  // We can measure independent expenditure relationships separately later,
  // but those are spender actions FOR/AGAINST candidate, not money received
  // by the legislator. Never sum into actual campaign contributions.
  if(row.kind==='independent_expenditure'){
   excludedIndependentExpenditures++;
   continue;
  }
  if(row.kind!=='candidate_contribution')continue;
  knownActivityRows++;
  const cents=safeMemberMoney(row,mode,cutoff);
  if(cents===null){notAsOfRows++;continue;}
  const group=affiliationsByReg.get(row.contributorRegistrationNumber);
  if(!group){unverifiedAffiliationRows++;continue;}
  const stance=groupStances.get(group);
  if(!stance)continue;
  byStance[stance].count++;
  byStance[stance].cents+=cents;
  byStance[stance].groups.add(group);
 }
 const support=byStance.support,oppose=byStance.oppose;
 const observed=support.count+oppose.count;
 const exposure=observed?{
  contributingOrganizationsForBillSupport:support.groups.size,
  contributingOrganizationsForBillOpposition:oppose.groups.size,
  preCutoffContributionsFromSupportingGroups:support.count,
  preCutoffContributionsFromOpposingGroups:oppose.count,
  log1pSupportingGroupDollars:Math.log1p(support.cents/100),
  log1pOpposingGroupDollars:Math.log1p(oppose.cents/100)
 }:null;
 return {
  schema:CFB_ISSUE_FINANCE_SHADOW_VERSION,
  mode,featureStatus:observed?'source_qualified_relationships':'no_verified_issue_relationships',
  // null means "not evidenced" rather than "no such relationships exist".
  features:exposure,
  diagnostics:{
   knownActivityRows,unverifiedAffiliationRows,notAsOfRows,
   excludedIndependentExpenditures,
   conflictingDuplicateRowKeys,
   eligibleIssuePositionGroups:groupStances.size,
   verifiedCrosswalkRegistrations:affiliationsByReg.size,
   conflictingCrosswalkRegistrations:conflictedRegs.size,
   conflictingGroupBillPositions:conflictedGroups.size
  },
  directionalVoteInference:false,mechanicallyActionable:false,
  servingChanged:false
 };
}
