/**
 * #864 / finance only. Source-first, read-only, independently reconciled
 * committee-year candidate-viewer coverage. This is NOT a statewide legal
 * filing-obligation or historical prediction-availability denominator.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const P='docs/evaluation/source-proof/';
const cp=JSON.parse(readFileSync(P+
  'cfb-2021-25-served-senator-committee-year-coverage-source-checkpoint.json','utf8'));
const digest=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const lines=(s:string)=>{assert.ok(s.length>0);return (s.endsWith('\n')?s.slice(0,-1):s).split('\n');};
const textMatrix=readFileSync(cp.matrix.path,'utf8');
const textQueue=readFileSync(cp.acquisitionQueue.path,'utf8');
const fields=(body:string,keys:string[])=>lines(body).map(line=>{
  const parts=line.split('|');
  assert.equal(parts.length,keys.length,'Strict metadata-only PSV column count');
  return Object.fromEntries(keys.map((key,i)=>[key,parts[i]!])) as Record<string,string>;
});
const matrix=fields(textMatrix,cp.matrix.columns);
const queue=fields(textQueue,cp.acquisitionQueue.columns);
const src=Object.fromEntries(Object.entries(cp.evidenceReferences).map(([key,value])=>{
  const path=typeof value==='string'?value:(value as {path:string}).path;
  return [key,readFileSync(path,'utf8')];
})) as Record<string,string>;
const originals=[...fields(src.first2022Ce,
  ['id','senator','district','printed','sha','bytes','coveredFrom','coveredThrough','received','due','notBefore']),
  ...fields(src.first2021_22Ye,
    ['id','senator','district','printed','sha','bytes','observed','coveredFrom','coveredThrough','received','due','notBefore']),
  ...fields(src.second2022Ce,
    ['id','senator','district','printed','sha','bytes','coveredFrom','coveredThrough','received','due','notBefore','observed']),
  ...fields(src.second2021_22Ye,
    ['id','senator','district','printed','sha','bytes','observed','coveredFrom','coveredThrough','received','due','notBefore'])];
const originalsById=new Map(originals.map(r=>[r.id,r]));
const olderAmend=fields(src.firstAmendment26,
  ['id','parent','sha','bytes','received','printed','observed','notBefore','status']);
const newerAmend=fields(src.secondAmendment30,
  ['id','senator','district','oldDistrict','printed','parent','parentSha',
    'apiSha','sha','bytes','observed','start','end','received','due',
    'notBefore','classification','aliasOf']);
const statuses=new Map<string,'authenticated'|'held'|'alias'>();
for(const r of olderAmend){
  assert.ok(originalsById.has(r.parent));
  assert.ok(['AUTH','HOLD_HEADER'].includes(r.status));
  statuses.set(r.id,r.status==='AUTH'?'authenticated':'held');
}
for(const r of newerAmend){
  assert.ok(originalsById.has(r.parent));
  assert.equal(r.senator,originalsById.get(r.parent)!.senator);
  assert.equal(r.parentSha,originalsById.get(r.parent)!.sha);
  assert.ok(!statuses.has(r.id));
  assert.ok(['distinct_authenticated_amended_pdf',
    'official_amendment_version_reference_alias_of_identical_pdf'].includes(r.classification));
  statuses.set(r.id,r.classification==='distinct_authenticated_amended_pdf'?'authenticated':'alias');
}
const members=new Map<string,{senator:string;district:number}>();
for(const r of originals){
  const reg=r.id.split(':')[0]!;
  const existing=members.get(reg);
  assert.ok(!existing||(existing.senator===r.senator&&existing.district===Number(r.district)));
  members.set(reg,{senator:r.senator,district:Number(r.district)});
}
const observations=fields(src.reportsViewer396,['segment','reg','bodySha','versionKeys']);
const viewer2022=new Map(observations.filter(r=>r.segment==='2022')
  .map(r=>[r.reg,r]));
const viewer2024=new Map(observations.filter(r=>r.segment==='2024')
  .map(r=>[r.reg,r]));
const specialMembers=new Map([
  ['19229',{senator:'Michael Holmstrom Jr',district:29}],
  ['19233',{senator:'Amanda Hemmingsen-Jaeger',district:47}],
]);
const specialViewer=new Map(fields(src.viewer2025,['reg','bodySha','tokens'])
  .filter(r=>specialMembers.has(r.reg)).map(r=>[r.reg,r]));
const specialProofs=[
  ...fields(src.ce2025,['id','district','sha','bytes','from','through','received','due','notBefore'])
    .filter(r=>specialMembers.has(r.id.split(':')[0]!)),
  ...fields(src.final2025,['id','district','sha','bytes','from','through','received','due','notBefore','observed']),
  ...fields(src.ye2025,['id','district','sha','bytes','from','through','received','due','notBefore','observed','specialParent']),
];
const specialOriginals=new Map(specialProofs.map(r=>[r.id,r]));
const comma=(x:string)=>x==='-'?[]:x.split(',');
const sort=(a:string[])=>a.slice().sort((x,y)=>x.localeCompare(y));
function observedIds(row:Record<string,string>):string[]{
  if(row.viewerSource==='not_observed_in_2024_scoped_viewer')return [];
  const year=row.reportYear,reg=row.committeeRegistration;
  if(year==='2025'){
    const source=specialViewer.get(reg);
    assert.ok(source);
    return source.tokens.split(',').map(token=>{
      const match=/^(C|E|YE)([01])\.(\d+)$/.exec(token);
      assert.ok(match);
      return reg+':25:pcc:'+match[1]+':'+match[2]+':'+match[3];
    });
  }
  const s=Number(year)<2023?viewer2022.get(reg):viewer2024.get(reg);
  assert.ok(s);
  return s.versionKeys.split(',').filter(k=>
    k.startsWith(year.slice(2)+':pcc:')).map(k=>reg+':'+k);
}
test('all permanent original sources and the two generated tables are SHA-pinned, without donor rows',()=>{
  assert.equal(textMatrix.endsWith('\n'),true);
  assert.equal(textQueue.endsWith('\n'),true);
  assert.equal(cp.schemaVersion,
    'cfb-served-senator-2021-25-committee-year-coverage-source-v1');
  assert.equal(cp.issueNumber,864);
  for(const [key,e] of Object.entries(cp.evidenceReferences)){
    const spec=e as {sha256?:string;sha256WithoutFinalNewline?:string};
    if(spec.sha256)assert.equal(digest(src[key]!),spec.sha256,'Original source changed: '+key);
    if(spec.sha256WithoutFinalNewline)
      assert.equal(digest(src[key]!.replace(/\n$/,'')),spec.sha256WithoutFinalNewline);
  }
  assert.equal(digest(textMatrix),cp.matrix.sha256);
  assert.equal(digest(textQueue),cp.acquisitionQueue.sha256);
  assert.equal(Buffer.byteLength(textMatrix,'utf8'),17484);
  assert.equal(Buffer.byteLength(textQueue,'utf8'),9071);
  assert.equal(matrix.length,90);
  assert.equal(queue.length,51);
  assert.equal(originalsById.size,82);
  assert.equal(members.size,22);
  assert.equal(olderAmend.length,26);
  assert.equal(newerAmend.length,30);
  assert.equal(specialOriginals.size,8);
  assert.equal(specialViewer.size,2);
  assert.equal(statuses.size,56);
  assert.equal([...statuses.values()].filter(x=>x==='authenticated').length,54);
  assert.equal([...statuses.values()].filter(x=>x==='held').length,1);
  assert.equal([...statuses.values()].filter(x=>x==='alias').length,1);
  assert.equal(new Set([...originals.map(r=>r.sha),
    ...olderAmend.filter(r=>r.status==='AUTH').map(r=>r.sha),
    ...newerAmend.filter(r=>r.classification==='distinct_authenticated_amended_pdf').map(r=>r.sha)]).size,136);
  assert.equal(cp.safeguards.noProductionDatabaseReadOrWrite,true);
  assert.equal(cp.safeguards.noOriginalPdfBodiesOrDonorRows,true);
  assert.equal(cp.safeguards.noLegalNonfilerClaimsFromViewerAbsence,true);
  assert.equal(cp.safeguards.keepIssue864Open,true);
});
test('90 actual-senator committee-year matrix rows are exactly joined to original CFB version references',()=>{
  assert.equal(new Set(matrix.map(r=>r.cohort+':'+r.reportYear+':'+r.committeeRegistration)).size,90);
  const counts:Record<string,{rows:number;viewed:number;unseen:number;orig:number;verifiedOrig:number;
    amend:number;verifiedAmend:number;held:number;alias:number;pendingOriginal:number;pendingAmend:number}>={};
  for(const row of matrix){
    const year=row.reportYear,reg=row.committeeRegistration;
    assert.ok(['2021','2022','2023','2024','2025'].includes(year));
    const validMember=year==='2025'?specialMembers.get(reg):members.get(reg);
    assert.ok(validMember,'Never-served candidates must not be in the permanent matrix');
    assert.equal(row.actualSenator,validMember.senator);
    assert.equal(Number(row.district),validMember.district);
    assert.equal(row.cohort,year==='2025'?'2025_special_served':'2022_verified_served_22');
    const x=counts[year]??={rows:0,viewed:0,unseen:0,orig:0,verifiedOrig:0,
      amend:0,verifiedAmend:0,held:0,alias:0,pendingOriginal:0,pendingAmend:0};
    x.rows++;
    if(row.viewerSource==='not_observed_in_2024_scoped_viewer'){
      assert.ok(Number(year)>=2023&&Number(year)<=2024);
      assert.equal(viewer2024.has(reg),false);
      assert.equal(row.viewerApiSha256,'-');
      assert.equal(row.observedOriginalRefs,'-');
      assert.equal(row.observedAmendmentRefs,'-');
      assert.equal(row.nextAction,'RESEARCH_SCOPED_VIEWER_ABSENCE');
      assert.equal(row.unverifiedOriginalVersionIds,'-');
      assert.equal(row.unverifiedAmendmentVersionIds,'-');
      x.unseen++;
      continue;
    }
    x.viewed++;
    const source=year==='2025'?specialViewer.get(reg)!:
      Number(year)<=2022?viewer2022.get(reg)!:viewer2024.get(reg)!;
    assert.ok(source);
    assert.equal(row.viewerApiSha256,source.bodySha);
    assert.equal(row.viewerSource,'candidate_viewer_'+(year==='2025'?'2026':
      Number(year)<=2022?'2022':'2024'));
    const ids=observedIds(row);
    assert.equal(new Set(ids).size,ids.length);
    const orig=ids.filter(id=>id.endsWith(':0'));
    const amend=ids.filter(id=>!id.endsWith(':0'));
    const sourceOrig=year==='2025'?specialOriginals:originalsById;
    const authenticated=orig.filter(id=>sourceOrig.has(id));
    const distinct=amend.filter(id=>statuses.get(id)==='authenticated');
    const hold=amend.filter(id=>statuses.get(id)==='held');
    const alias=amend.filter(id=>statuses.get(id)==='alias');
    const nextOrig=orig.filter(id=>!sourceOrig.has(id));
    const nextAmend=amend.filter(id=>!statuses.has(id));
    assert.equal(Number(row.observedOriginalRefs),orig.length);
    assert.equal(Number(row.authenticatedOriginalPdfs),authenticated.length);
    assert.equal(Number(row.observedAmendmentRefs),amend.length);
    assert.equal(Number(row.authenticatedDistinctAmendedPdfs),distinct.length);
    assert.equal(Number(row.sourceIdentityHolds),hold.length);
    assert.equal(Number(row.documentedPdfAliases),alias.length);
    assert.deepEqual(sort(comma(row.unverifiedOriginalVersionIds)),sort(nextOrig));
    assert.deepEqual(sort(comma(row.unverifiedAmendmentVersionIds)),sort(nextAmend));
    assert.deepEqual(sort(comma(row.sourceHoldVersionIds)),sort(hold));
    const expectedAlias=alias.map(id=>id+'>17319:22:pcc:YE:0:1');
    assert.deepEqual(sort(comma(row.aliasVersionMapping)),sort(expectedAlias));
    if(hold.length)assert.equal(row.nextAction,'REVIEW_ATYPICAL_SOURCE_PDF');
    else if(nextOrig.length)assert.equal(row.nextAction,'ACQUIRE_ORIGINALS_THEN_AMENDMENTS');
    else if(nextAmend.length)assert.equal(row.nextAction,
      year==='2025'?'ACQUIRE_AMENDMENTS_AUTHENTICATED_PARENTS':'ACQUIRE_AMENDMENTS_AFTER_ORIGINALS');
    else assert.equal(row.nextAction,'OBSERVED_REPORTS_ACCOUNTED_FOR');
    x.orig+=orig.length;x.verifiedOrig+=authenticated.length;
    x.amend+=amend.length;x.verifiedAmend+=distinct.length;
    x.held+=hold.length;x.alias+=alias.length;
    x.pendingOriginal+=nextOrig.length;x.pendingAmend+=nextAmend.length;
  }
  for(const expected of cp.byYear){
    const v=counts[String(expected.year)]!;
    assert.deepEqual(v,{
      rows:expected.rows,viewed:expected.viewerEntries,unseen:expected.noViewerEntry,
      orig:expected.observedOriginals,verifiedOrig:expected.authenticatedOriginals,
      amend:expected.observedAmendments,verifiedAmend:expected.authenticatedDistinctAmendments,
      held:expected.sourceOnlyHolds,alias:expected.documentedAliases,
      pendingOriginal:expected.pendingOriginals,pendingAmend:expected.pendingAmendments});
  }
  assert.equal(cp.sourcePanels.cohort2022RegistrationNotInSampled2024Segment,8);
  assert.equal(cp.sourcePanels.legalFilingDutyDenominator,null);
});
test('all 51 source-first queue records are exact observed versions with parent-aware acquisition order',()=>{
  const targets=new Set<string>();
  for(const row of matrix)
    for(const id of [...comma(row.unverifiedOriginalVersionIds),
      ...comma(row.unverifiedAmendmentVersionIds)])targets.add(id);
  assert.equal(targets.size,51);
  assert.equal(new Set(queue.map(r=>r.reportVersionId)).size,51);
  assert.deepEqual(sort([...targets]),sort(queue.map(r=>r.reportVersionId)));
  const counts:Record<string,number>={};
  let lastTier=0;
  const tierOrder:Record<string,number>={
    P1_PARENT_VERIFIED_AMENDMENT:1,
    P2_AUTHENTICATE_ORIGINAL_FIRST:2,
    P3_AMEND_AFTER_PARENT:3,
  };
  for(const target of queue){
    assert.ok(targets.has(target.reportVersionId));
    const parent=target.reportVersionId.split(':').slice(0,5).join(':')+':0';
    const reg=target.reportVersionId.split(':')[0]!;
    const isOriginal=target.reportVersionId.endsWith(':0');
    assert.equal(target.originalParentReportId,parent);
    assert.equal(target.committeeRegistration,reg);
    assert.equal(target.reportYear,'20'+target.reportVersionId.split(':')[1]);
    assert.equal(target.officialViewerSegment,target.reportYear==='2025'?'2026':'2024');
    const matchingMatrix=matrix.find(r=>r.reportYear===target.reportYear&&
      r.committeeRegistration===reg);
    assert.ok(matchingMatrix);
    assert.equal(target.officialViewerApiSha256,matchingMatrix.viewerApiSha256);
    assert.equal(target.actualSenator,matchingMatrix.actualSenator);
    assert.equal(target.district,matchingMatrix.district);
    const verifiedParent=specialOriginals.get(parent);
    if(target.reportYear==='2025'){
      assert.equal(isOriginal,false);
      assert.ok(verifiedParent);
      assert.equal(target.priority,'P1_PARENT_VERIFIED_AMENDMENT');
      assert.equal(target.authenticatedOriginalParentSha256,verifiedParent.sha);
    }else if(isOriginal){
      assert.equal(target.priority,'P2_AUTHENTICATE_ORIGINAL_FIRST');
      assert.equal(target.authenticatedOriginalParentSha256,'-');
    }else{
      assert.equal(target.priority,'P3_AMEND_AFTER_PARENT');
      assert.equal(target.authenticatedOriginalParentSha256,'-');
      assert.ok(targets.has(parent),'No synthetic amendment parent');
    }
    assert.ok(tierOrder[target.priority]>=lastTier);
    lastTier=tierOrder[target.priority];
    counts[target.priority]=(counts[target.priority]??0)+1;
  }
  assert.deepEqual(counts,cp.queue);
  assert.ok(queue.slice(0,7).every(x=>x.committeeRegistration==='19229'));
  assert.ok(!queue.some(x=>x.committeeRegistration==='19233'));
});
test('explicit hard boundaries: single Putnam hold, Hoffman duplicate-reference alias, no invented nonfilers',()=>{
  const putnam=matrix.find(x=>x.reportYear==='2021'&&x.committeeRegistration==='18430')!;
  const hoffman=matrix.find(x=>x.reportYear==='2022'&&x.committeeRegistration==='17319')!;
  assert.equal(putnam.sourceHoldVersionIds,'18430:21:pcc:YE:0:1');
  assert.equal(putnam.sourceIdentityHolds,'1');
  assert.equal(hoffman.aliasVersionMapping,'17319:22:pcc:YE:0:2>17319:22:pcc:YE:0:1');
  assert.equal(hoffman.documentedPdfAliases,'1');
  assert.equal(cp.documentedAnomalies.district31HistoricalRegistrationMatchUnresolved,true);
  assert.equal(matrix.filter(r=>r.viewerSource==='not_observed_in_2024_scoped_viewer').length,16);
  assert.ok(matrix.every(r=>!r.nextAction.includes('NONFILER')));
  assert.equal(cp.safeguards.noLegalNonfilerClaimsFromViewerAbsence,true);
  assert.equal(cp.safeguards.noRetroactivePredictionEligibility,true);
  assert.equal(cp.safeguards.no2027SchedulerOrTrainingChanges,true);
});
