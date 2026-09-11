import {
  fetchRevisorSourceChamberActionSearch,
  fetchRevisorSourceChamberPassageSearch,
  REVISOR_SOURCE_REPASS_ACTIONS,
} from '../src/sources/minnesota/revisor-action-search.js';
import { auditRevisorSourceChamberPassage, fetchRevisorStatusXml } from '../src/sources/minnesota/revisor-actions.js';
import type { RevisorBillSearchBody } from '../src/sources/minnesota/revisor-bill-search.js';

type Scope = {
  sessionKey: '2021-2022' | '2023-2024' | '2025-2026';
  body: RevisorBillSearchBody;
  expectedPassageCount: number;
  knownPasses: string[];
  knownNonPasses: string[];
};

const scopes: Scope[] = [
  { sessionKey: '2021-2022', body: 'House', expectedPassageCount: 89, knownPasses: ['HF1064', 'HF109'], knownNonPasses: ['HF1051', 'HF2267'] },
  { sessionKey: '2021-2022', body: 'Senate', expectedPassageCount: 108, knownPasses: ['SF1', 'SF1018', 'SF2774', 'SF3534', 'SF702'], knownNonPasses: [] },
  { sessionKey: '2023-2024', body: 'House', expectedPassageCount: 160, knownPasses: ['HF1', 'HF100'], knownNonPasses: [] },
  { sessionKey: '2023-2024', body: 'Senate', expectedPassageCount: 45, knownPasses: ['SF10', 'SF13'], knownNonPasses: [] },
  { sessionKey: '2025-2026', body: 'House', expectedPassageCount: 174, knownPasses: ['HF1014', 'HF4591'], knownNonPasses: ['HF3422', 'HF4271'] },
  { sessionKey: '2025-2026', body: 'Senate', expectedPassageCount: 78, knownPasses: ['SF1075'], knownNonPasses: [] },
];

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const results = [];
  const failures: string[] = [];

  for (const scope of scopes) {
    const passage = await fetchRevisorSourceChamberPassageSearch(scope);
    const passageIds = new Set(passage.bills.map((bill) => bill.identifier));
    const repass = await fetchRevisorSourceChamberActionSearch({
      ...scope,
      actionIds: REVISOR_SOURCE_REPASS_ACTIONS[scope.body],
    });
    const repassIds = repass.bills.map((bill) => bill.identifier);
    const repassMissingInitialPass = repassIds.filter((identifier) => !passageIds.has(identifier));

    if (passage.bills.length !== scope.expectedPassageCount) {
      failures.push(`${scope.sessionKey}/${scope.body}: source-passage count ${passage.bills.length} != audited ${scope.expectedPassageCount}`);
    }
    for (const identifier of scope.knownPasses) {
      if (!passageIds.has(identifier)) failures.push(`${scope.sessionKey}/${scope.body}: expected ${identifier} in source-passage set`);
    }
    for (const identifier of scope.knownNonPasses) {
      if (passageIds.has(identifier)) failures.push(`${scope.sessionKey}/${scope.body}: expected ${identifier} outside source-passage set`);
    }
    if (repassMissingInitialPass.length > 0) {
      failures.push(`${scope.sessionKey}/${scope.body}: ${repassMissingInitialPass.length} repass bills lack an initial source-passage action`);
    }

    const detailedControls = [];
    for (const identifier of scope.knownPasses) {
      const bill = passage.bills.find((candidate) => candidate.identifier === identifier);
      if (!bill) continue;
      try {
        const xml = await fetchRevisorStatusXml(bill.statusXmlUrl);
        const audit = auditRevisorSourceChamberPassage({ xml, identifier });
        const verified = audit.sourceChamberPassed;
        if (!verified) failures.push(`${scope.sessionKey}/${scope.body}: ${identifier} action-search pass was not confirmed by detailed status XML`);
        detailedControls.push({
          identifier,
          statusXmlUrl: bill.statusXmlUrl,
          verified,
          sourcePassageDescriptions: audit.passageActions.map((action) => action.description),
          classifiedActions: audit.classifiedActions,
          unclassifiedActions: audit.unclassifiedActions,
        });
      } catch (error) {
        failures.push(`${scope.sessionKey}/${scope.body}: detailed verification failed for ${identifier}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(250);
    }

    results.push({
      session: scope.sessionKey,
      body: scope.body,
      expectedPassageCount: scope.expectedPassageCount,
      sourcePassageCount: passage.bills.length,
      sourceRepassCount: repass.bills.length,
      repassMissingInitialPass,
      knownPasses: scope.knownPasses.map((identifier) => ({ identifier, present: passageIds.has(identifier) })),
      knownNonPasses: scope.knownNonPasses.map((identifier) => ({ identifier, absent: !passageIds.has(identifier) })),
      detailedControls,
      passageDocuments: passage.documents.map((document) => ({
        actionId: document.actionId,
        allChamberResultCount: document.results.length,
        sourceChamberResultCount: document.results.filter((row) => row.fileType === (scope.body === 'House' ? 'HF' : 'SF')).length,
        contentSha256: document.contentSha256,
        sourceUrl: document.sourceUrl,
      })),
      repassDocuments: repass.documents.map((document) => ({
        actionId: document.actionId,
        allChamberResultCount: document.results.length,
        sourceChamberResultCount: document.results.filter((row) => row.fileType === (scope.body === 'House' ? 'HF' : 'SF')).length,
      })),
      sourcePassageSample: passage.bills.slice(0, 15).map((bill) => ({ identifier: bill.identifier, statusXmlUrl: bill.statusXmlUrl })),
    });
  }

  const totalSourcePassages = results.reduce((sum, row) => sum + row.sourcePassageCount, 0);
  if (totalSourcePassages !== 654) failures.push(`all scopes: source-passage total ${totalSourcePassages} != audited 654`);

  console.log(JSON.stringify({
    revisorSourcePassageAudit: {
      generatedAt: new Date().toISOString(),
      source: 'Minnesota Revisor Search by Action XML',
      semantics: 'A bill is positive only when its originating chamber records a verified final-passage action. Senate Consent Calendar third-reading passage is included. Repass actions are audited as a subset invariant.',
      totalSourcePassages,
      failures,
      scopes: results,
    },
  }, null, 2));

  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
