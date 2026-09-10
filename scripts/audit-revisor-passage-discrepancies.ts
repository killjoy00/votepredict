import { auditRevisorSourceChamberPassage, fetchRevisorStatusXml } from '../src/sources/minnesota/revisor-actions.js';

const disputed = [
  { identifier: 'SF2774', url: 'https://api.revisor.mn.gov/bills/v1/92/2022/0/SF/2774/' },
  { identifier: 'SF3534', url: 'https://api.revisor.mn.gov/bills/v1/92/2022/0/SF/3534/' },
  { identifier: 'SF702', url: 'https://api.revisor.mn.gov/bills/v1/92/2021/0/SF/702/' },
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const rows = [];
  for (const item of disputed) {
    const xml = await fetchRevisorStatusXml(item.url);
    const audit = auditRevisorSourceChamberPassage({ xml, identifier: item.identifier });
    rows.push({
      identifier: item.identifier,
      sourceChamberPassed: audit.sourceChamberPassed,
      sourceChamberFailed: audit.sourceChamberFailed,
      classifiedActions: audit.classifiedActions,
      unclassifiedActions: audit.unclassifiedActions,
      passageActions: audit.passageActions.map((action) => ({
        occurredOn: action.occurredOn,
        description: action.description,
        fields: action.fields,
      })),
      sourceChamberActionTail: audit.actions
        .filter((action) => action.chamber === audit.sourceChamber)
        .slice(-12)
        .map((action) => ({ occurredOn: action.occurredOn, description: action.description, fields: action.fields })),
    });
    await sleep(350);
  }
  console.log(JSON.stringify({ disputedSenatePassageAudit: rows }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
