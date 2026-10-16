/**
 * #864 public campaign finance only. Eleven remaining 2023/2024 original
 * CFB amended-report viewer references for real 2022-serving MN senators.
 * Each report is tied to an independently authenticated YE original PDF
 * and two source-verified candidate-viewer snapshots, not filing duty.
 */
import {createHash} from 'node:crypto';
import {selectEightRecoveredSenators16OriginalYearends}
  from './cfb-2023-24-eight-recovered-16-yearend-originals.js';
import {
  auditAuthenticatedParentYeAmendment,sourceYeAmendmentReference,
  type SourceVerified2023to24YeAmendment,
  type CfbAmendedPdfSource,
} from './cfb-2023-24-sixteen-parent-authenticated-amendments.js';
import {cfbReportViewerUrl} from '../../src/evidence/cfb-current-report-acquisition.js';
export const ELEVEN_HISTORIC_YE_AMENDMENTS_VERSION=
  'cfb-2023-24-eight-2022-senators-eleven-parent-authenticated-ye-amendment-source-v1' as const;
export interface ElevenAmendmentEvidenceInputs{
  firstCePsv:string;secondCePsv:string;previousViewerPsv:string;
  sourceSnapshotPsv:string;source27VersionPsv:string;sourceCheckpointJson:string;
  original16SourcePsv:string;original16CheckpointJson:string;
}
const rows=(s:string)=>s.trimEnd().split('\n').filter(Boolean).map(x=>x.split('|'));
const blob=(s:string)=>createHash('sha1').update(
  'blob '+Buffer.byteLength(s,'utf8')+'\0').update(s,'utf8').digest('hex');
const SHA=/^[a-f0-9]{64}$/;
export function selectElevenIndependentlyParentAuthenticatedAmendments(
  evidence:ElevenAmendmentEvidenceInputs,
):SourceVerified2023to24YeAmendment[]{
  const people=selectEightRecoveredSenators16OriginalYearends(evidence);
  const byParent=new Map(people.map(x=>[x.id,x]));
  const snapshot=JSON.parse(evidence.original16CheckpointJson);
  if(snapshot.schemaVersion!=='cfb-2023-24-eight-verified-2022-senators-16-ye-source-15-auth-one-hold-v1'
    ||snapshot.issueNumber!==864||snapshot.results.authenticDistinctOriginalPdfForms!==15
    ||snapshot.results.unverifiedSourceIdentityHolds!==1
    ||snapshot.crossRunReconciliation.all16OfficialPdfSha256!==true
    ||snapshot.crossRunReconciliation.all8ViewerResponsesSameSha256!==true
    ||snapshot.ledger.gitBlobSha!=='25dd711af3e8fcc5647a5f28473c3b0804cc58a7'
    ||blob(evidence.original16SourcePsv)!==snapshot.ledger.gitBlobSha)
    throw Error('Independently SHA-authenticated exact parent PDF source ledger changed');
  const original=new Map(rows(evidence.original16SourcePsv).map(x=>[x[0],x]));
  if(original.size!==16)throw Error('Sixteen previously retrieved original CFB report-version PDFs changed');
  for(const [key,r] of original){
    const person=byParent.get(key!);
    if(!person||r.length!==12||r[1]!==person.actualSenator
      ||r[2]!==String(person.district2022)||r[3]!==person.reg
      ||r[4]!==person.originalViewerApiSha256
      ||r[7]!==person.reportYear+'-01-01'
      ||r[8]!==person.reportYear+'-12-31'
      ||!SHA.test(r[5]!)||Number(r[6])<300)
      throw Error('Original source report PDF metadata or 2022 serving-senator identity contradicted');
  }
  const newlyDiscovered=rows(evidence.source27VersionPsv)
    .filter(r=>r[6]==='amendment_viewer_reference_not_yet_pdf_authenticated');
  if(newlyDiscovered.length!==11||new Set(newlyDiscovered.map(r=>r[0])).size!==11)
    throw Error('There must be exactly eleven source-version amendment references');
  const result:SourceVerified2023to24YeAmendment[]=newlyDiscovered.map(r=>{
    const match=/^(\d+):(23|24):pcc:YE:0:([1-9]\d*)$/.exec(r[0]??'');
    const parent=r[0]!.replace(/:\d+$/,':0');
    const originalRecord=original.get(parent),person=byParent.get(parent);
    if(!match||match[1]!==r[3]||!originalRecord||!person||r.length!==7
      ||r[1]!==person.actualSenator||r[2]!==String(person.district2022)
      ||r[4]!==person.originalViewerApiSha256
      ||originalRecord[10]!=='authentic_pdf_report_first_page'
      ||originalRecord[11]!=='verified'
      ||originalRecord[4]!==r[4]
      ||originalRecord[9]!<originalRecord[8]!)
      throw Error('Requested historical amendment does not have independently verified original PDF parent');
    return{
      id:r[0]!,parentOriginalId:parent,
      year:match[2]==='23'?2023 as const:2024 as const,
      registrationNumber:r[3]!,
      senatorVerifiedServedIn2022:r[1]!,
      senateDistrict2022:person.district2022,
      amendmentIndex:Number(match[3]),
      viewerApiSha256:r[4]!,
      originalPdfSha256:originalRecord[5]!,
      originalPdfBytes:Number(originalRecord[6]),
      originalPeriodStart:originalRecord[7]!,
      originalPeriodEnd:originalRecord[8]!,
      originalBoardReceipt:originalRecord[9]!,
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(result.map(x=>x.registrationNumber)).size!==6
    ||new Set(result.map(x=>x.parentOriginalId)).size!==8
    ||result.filter(x=>x.year===2023).length!==4
    ||result.filter(x=>x.year===2024).length!==7)
    throw Error('Previously sourced 6 committee / 8 parent / 11 version cohort changed');
  for(const parent of new Set(result.map(x=>x.parentOriginalId))){
    const indices=result.filter(x=>x.parentOriginalId===parent)
      .map(x=>x.amendmentIndex).sort((a,b)=>a-b);
    if(indices.some((v,i)=>v!==i+1))
      throw Error('Official amended index chain has missing version reference');
  }
  return result;
}
export function auditElevenAmendedPdfs(
  selected:SourceVerified2023to24YeAmendment[],
  downloads:Map<string,CfbAmendedPdfSource>,
  sourceErrors:Map<string,string>,
){
  const reports=selected.map(t=>auditAuthenticatedParentYeAmendment(t,
    downloads.get(t.id)??null,sourceErrors.get(t.id)??null));
  const verified=reports.filter(x=>x.status==='amended_pdf_and_parent_identity_authenticated');
  const holds=reports.filter(x=>x.status!=='amended_pdf_and_parent_identity_authenticated');
  const hashes=new Map<string,typeof verified>();
  for(const row of verified){
    const existing=hashes.get(row.pdfSha256!)??[];
    existing.push(row);
    hashes.set(row.pdfSha256!,existing);
  }
  const aliases=[...hashes.entries()]
    .filter(([,items])=>items.length>1)
    .flatMap(([sha,items])=>{
      const sorted=[...items].sort((a,b)=>a.amendmentViewerIndex-b.amendmentViewerIndex);
      return sorted.slice(1).map(row=>({
        id:row.id,canonicalId:sorted[0]!.id,
        sha256:sha,pdfBytes:row.pdfBytes,
      }));
    });
  const originalParentAliases=holds.filter(x=>x.status==='official_version_binary_identical_to_original_parent');
  const authenticatedHashes=[...hashes.keys()];
  const complete=reports.length===11&&holds.length===0&&aliases.length===0
    &&hashes.size===11&&new Set(reports.map(x=>x.id)).size===11;
  return{
    reports,
    summary:{
      exactOfficialViewerVersions:reports.length,
      authenticFirstPageAmendmentVersionReferences:verified.length,
      uniqueAuthenticatedAmendedPdfs:hashes.size,
      documentedOrUnexpectedDuplicateVersionAliases:aliases,
      identicalOriginalParentBinaryReferences:originalParentAliases.map(r=>r.id),
      unverifiedSourceReferences:holds.map(r=>({id:r.id,status:r.status})),
      allElevenPdfsDistinctAndAuthenticated:complete,
      exactOriginalParentsInScope:8,
      actual2022ServingSenatorCommitteesInScope:6,
      historicalActualPublicByProvenCount:0,
      statutoryFilingDutyDenominator:null,
    },
  };
}
