/** Bind independently reverified retained-source receipt to the unchanged old plan. */
import {createHash} from 'node:crypto';
import {expansionInputs} from './senate-864-website-expansion.mjs';
export const RECOVERED_APPEND_MARKER='SENATE864_WEBSITE_526_RETAINED_METADATA_APPEND_V1';
export const recoverySha=b=>createHash('sha256').update(b).digest('hex');
export function bindRecoveredPlan(receipt,expectedCommit){
 const old=expansionInputs(),rows=receipt?.verified;
 if(receipt?.schema!=='senate864-website-metadata-recovery-v1'||receipt.reviewedCommit!==expectedCommit||
  receipt.existingStoredExcerpts!==668||receipt.newOriginalVerifiedExcerpts!==526||
  receipt.remainingSourceHolds!==0||receipt.unknownPeople!==0||receipt.knownScopeExclusions!==3||
  !Array.isArray(rows)||rows.length!==526||receipt.held?.length!==0)throw Error('Fixed verified source receipt required');
 const holds=new Map(old.current.holds.map(r=>[r.id,r])),seen=new Set();
 for(const row of rows){
  const hold=holds.get(row.id);
  if(!hold||hold.reason==='outside_served_senate_cohort'||hold.ordinal!==row.ordinal||seen.has(row.id))throw Error('Addition outside exact 526 source holds');
  const expected=recoverySha('senate-864-website-literal-asof-v1|'+row.id+'|'+row.literal+'|'+[row.sourceUrl,row.sourceSha,row.archiveCapturedAt].join('|'));
  if(row.ingestionIdentityKey!==expected||!receipt.sourceReceipts.some(p=>p.originalHtmlSha256===row.sourceSha&&p.originalUrl===row.sourceUrl&&p.originalArchiveCapturedAtUtc===row.archiveCapturedAt&&p.originalArchiveCdxSha1Base32===row.originalCdxSha1))throw Error('Source proof/key mismatch');
  seen.add(row.id);
 }
 const ready=[...old.current.ready,...rows],remaining=old.current.holds.filter(r=>!seen.has(r.id));
 if(remaining.length!==3||remaining.some(r=>r.reason!=='outside_served_senate_cohort')||new Set(ready.map(r=>r.ingestionIdentityKey)).size!==1194)throw Error('Reconciliation drift');
 return {...old,added:rows,oldKeys:new Set(old.current.ready.map(r=>r.ingestionIdentityKey)),
  current:{...old.current,ready,holds:remaining,holdCounts:{ready:1194,outside_served_senate_cohort:3}},
  sourcePlanSha256:recoverySha(JSON.stringify(ready)),
  accounting:{evidenceCopies:1194,people:new Set(ready.map(r=>r.ordinal)).size,uniqueOriginalBodies:new Set(ready.map(r=>r.sourceSha)).size,
   uniquePersonLiteralPairs:new Set(ready.map(r=>rowLiteralKey(r))).size,
   byArchiveObservationYear:Object.fromEntries([...new Set(ready.map(r=>r.archiveCapturedAt.slice(0,4)))].sort().map(y=>[y,ready.filter(r=>r.archiveCapturedAt.startsWith(y)).length]))}};
}
const rowLiteralKey=r=>r.ordinal+'|'+r.literal.normalize('NFC').replace(/\s+/g,' ').trim();
