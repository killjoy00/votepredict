/**
 * #864 finance: eight independently verified actual 2022 senators with
 * no *sampled* 2024-segment candidate viewer response in the older 396-row
 * checkpoint. Missing source observation != no reports, no filing or
 * no legal duty. Never include unproved candidate identity in new records.
 */
import {createHash} from 'node:crypto';
import type {CfbReportViewerReference} from './cfb-report-pdf-proof.js';

export const CFB_EIGHT_2024_VIEWER_DISCOVERY_VERSION=
  'cfb-2024-eight-verified-2022-senators-not-in-earlier-396-row-sample-v1' as const;
export const CFB_EIGHT_2024_TARGETS=[
  {reg:'17994',district:16,senator:'Andrew R. Lang'},
  {reg:'17919',district:18,senator:'Nick A. Frentz'},
  {reg:'17964',district:19,senator:'John R. Jasinski'},
  {reg:'17404',district:21,senator:'Bill Weber'},
  {reg:'17910',district:22,senator:'Rich Draheim'},
  {reg:'17876',district:27,senator:'Andrew Mathews'},
  {reg:'18777',district:30,senator:'Eric Lucero'},
  {reg:'17868',district:35,senator:'Jim Abeler'},
] as const;
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const split=(body:string)=>body.trimEnd().split('\n').filter(Boolean).map(x=>x.split('|'));
export function selectEightPreviouslyUnobservedActualSenators(input:{
  firstCfbOriginalCePsv:string;secondCfbOriginalCePsv:string;
  priorSampledViewerPsv:string;
}){
  if(sha(input.firstCfbOriginalCePsv)!=='ff6c330378596c7efd224215908e9e4e70d0cc01b19598dde0f0fc36c57382a2'
    ||sha(input.secondCfbOriginalCePsv)!=='263c1b27b425f67332eacdf855e4ae7f7300d111b2330d0a259d239cfea9050c'
    ||sha(input.priorSampledViewerPsv)!=='6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9')
    throw Error('Original Senate member + original CFB viewer metadata SHA changed');
  const original=split(input.firstCfbOriginalCePsv).concat(split(input.secondCfbOriginalCePsv));
  const member=new Map<string,{senator:string;district:number;periods:Set<string>}>();
  for(const r of original){
    const id=r[0]!,reg=id.split(':')[0]!;
    const prior=member.get(reg)??{senator:r[1]!,district:Number(r[2]),periods:new Set<string>()};
    if(prior.senator!==r[1]||prior.district!==Number(r[2]))
      throw Error('Existing original PDF committee identity contradicts real senator');
    prior.periods.add(id.split(':')[3]!);
    member.set(reg,prior);
  }
  if(original.length!==44||member.size!==22
    ||[...member.values()].some(x=>x.periods.size!==2||
      !x.periods.has('C')||!x.periods.has('E')))
    throw Error('22 actual senators and 44 2022 C/E original PDFs must stay verified');
  const priorViewer=split(input.priorSampledViewerPsv);
  for(const target of CFB_EIGHT_2024_TARGETS){
    const found=member.get(target.reg);
    if(!found||found.senator!==target.senator||found.district!==target.district)
      throw Error('Unverified 2022 serving senator or wrong registered principal campaign committee');
    if(priorViewer.filter(r=>r[0]==='2022'&&r[1]===target.reg).length!==1)
      throw Error('Previously authenticated 2022-segment reports API evidence missing');
    if(priorViewer.some(r=>r[0]==='2024'&&r[1]===target.reg))
      throw Error('Senator no longer missing from scoped source sample');
  }
  if(new Set(CFB_EIGHT_2024_TARGETS.map(x=>x.reg)).size!==8)
    throw Error('Duplicated target candidate registration');
  return CFB_EIGHT_2024_TARGETS.map(x=>({...x}));
}
export interface EightRegCfbViewerSource {
  responseSha256:string;sourceUrl:string;fetchedAt:string;
  references:CfbReportViewerReference[];
}
export function auditPreviouslyUnobserved2024CfbViewer(
  target:typeof CFB_EIGHT_2024_TARGETS[number],
  source:EightRegCfbViewerSource|null,sourceError:string|null=null){
  const expectedUrl='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'
    +target.reg+'/2024/';
  const urlValid=!!source&&source.sourceUrl===expectedUrl
    &&/^[0-9a-f]{64}$/.test(source.responseSha256)
    &&Number.isFinite(Date.parse(source.fetchedAt));
  const versions=urlValid?source!.references.filter(x=>x.registrationNumber===target.reg
    &&['23','24'].includes(x.year)&&x.type==='pcc'
    &&['C','E','YE'].includes(x.period)&&['0','1'].includes(x.se)
    &&Number.isInteger(x.amendment)&&x.amendment>=0):[];
  const foreign=urlValid?source!.references.filter(x=>x.registrationNumber!==target.reg):[];
  const malformed=urlValid?source!.references.filter(x=>['23','24'].includes(x.year)&&x.type==='pcc'
    &&(!['C','E','YE'].includes(x.period)||!['0','1'].includes(x.se)
      ||!Number.isInteger(x.amendment)||x.amendment<0)):[];
  const ids=versions.map(x=>target.reg+':'+x.year+':pcc:'+x.period+':'+x.se+':'+x.amendment).sort();
  const safe=urlValid&&foreign.length===0&&malformed.length===0
    &&new Set(ids).size===ids.length&&!sourceError;
  return{
    independentlyVerified2022ActualSenator:target.senator,
    elected2022SenateDistrict:target.district,officialCfbRegistration:target.reg,
    originallyUnobservedIn2024CfbViewerSample:true,
    sourceViewerUrl:urlValid?source!.sourceUrl:expectedUrl,
    currentViewerResponseSha256:urlValid?source!.responseSha256:null,
    observedAtUtc:urlValid?source!.fetchedAt:null,
    observed2023OriginalRefs:safe?ids.filter(x=>x.startsWith(target.reg+':23:')&&x.endsWith(':0')).length:null,
    observed2023AmendedRefs:safe?ids.filter(x=>x.startsWith(target.reg+':23:')&&!x.endsWith(':0')).length:null,
    observed2024OriginalRefs:safe?ids.filter(x=>x.startsWith(target.reg+':24:')&&x.endsWith(':0')).length:null,
    observed2024AmendedRefs:safe?ids.filter(x=>x.startsWith(target.reg+':24:')&&!x.endsWith(':0')).length:null,
    originalCfbViewerReportVersionIds:safe?ids:[],
    reportPdfBinariesAuthenticatedHere:0,
    independentlyProvenHistoricalPublicBy:0,
    anyLegallyOwedFilingCount:null,
    missingFromEarlierViewerSampleDoesNotProveNonfiling:true,
    sourceErrorKind:sourceError,
    status:sourceError?'original_cfb_viewer_fetch_failed'
      :!urlValid?'source_response_untrusted_or_missing'
      :!safe?'original_cfb_viewer_report_identity_conflict'
      :ids.length?'original_source_viewer_references_discovered'
      :'official_viewer_response_received_with_no_2023_24_pcc_report_refs',
  };
}
