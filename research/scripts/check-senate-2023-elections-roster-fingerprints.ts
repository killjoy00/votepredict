/**
 * #864 one-time source-only re-read prior SHA-verified 2023 Elections roll
 * metadata (no PDFs, media, production DB or public HTTP fetch).
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {audit2023ElectionsOriginalNamedRollArtifact} from '../../src/evidence/senate-committee-2023-elections-roll-roster-audit.js';
function main(){
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--source-json'||args[2]!=='--output')
  throw Error('Exact --source-json PATH --output PATH required');
 const source=readFileSync(resolve(args[1]!),'utf8');
 const report=audit2023ElectionsOriginalNamedRollArtifact(source);
 const destination=resolve(args[3]!);
 mkdirSync(dirname(destination),{recursive:true});
 writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
  sourceYear:report.sourceYear,originalPdfs:report.sevenOfficialPdfOriginalsReconciledToPublishedFourteenSurnameRoster,
  provisionalBlocks:report.provisionalNamedRollBlocksWithExactRosterSurnameCoverage,
  namedChoices:report.explicitYeaNayChoiceEntriesChecked,
  sourceNonvoters:report.explicitNonvotingEntriesChecked,
  officialRosterSurnames:report.knownPublicCommitteeSurnames,
  noPrivateDbOrModels:true,
 },null,2));
}
try{main()}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1}