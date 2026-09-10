import {
  fetchRevisorActionSearchDocument,
  filterRevisorSourceChamberBills,
} from '../src/sources/minnesota/revisor-action-search.js';
import { auditRevisorSourceChamberPassage, fetchRevisorStatusXml } from '../src/sources/minnesota/revisor-actions.js';

const probes = [
  { sessionKey: '2021-2022', body: 'Senate' as const, actionId: '2137', label: 'Consent Calendar: Third reading Passed' },
  { sessionKey: '2023-2024', body: 'Senate' as const, actionId: '2289', label: 'Bill passed' },
  { sessionKey: '2025-2026', body: 'Senate' as const, actionId: '2071', label: 'Bill repassed' },
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const output = [];
  for (const probe of probes) {
    const document = await fetchRevisorActionSearchDocument(probe);
    const sourceBills = filterRevisorSourceChamberBills(probe.body, document.results);
    const details = [];
    for (const bill of sourceBills) {
      const xml = await fetchRevisorStatusXml(bill.statusXmlUrl);
      const audit = auditRevisorSourceChamberPassage({ xml, identifier: bill.identifier });
      details.push({
        identifier: bill.identifier,
        statusXmlUrl: bill.statusXmlUrl,
        sourceChamberPassed: audit.sourceChamberPassed,
        passageActions: audit.passageActions.map((action) => ({
          occurredOn: action.occurredOn,
          description: action.description,
          rollCall: action.fields.ROLL_CALL ?? null,
        })),
        sourceActionTail: audit.actions
          .filter((action) => action.chamber === audit.sourceChamber)
          .slice(-8)
          .map((action) => ({
            occurredOn: action.occurredOn,
            description: action.description,
            rollCall: action.fields.ROLL_CALL ?? null,
          })),
      });
      await sleep(250);
    }
    output.push({
      ...probe,
      allResults: document.results.length,
      sourceBillCount: sourceBills.length,
      sourceBills: sourceBills.map((bill) => bill.identifier),
      details,
    });
  }
  console.log(JSON.stringify({ revisorAlternatePassageActionAudit: output }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
