import { extractSenateJournalText, listSenateJournalLinks, parseSenateJournalText } from '../src/sources/minnesota/senate-journals.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';

function argumentValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sessionKey = argumentValue(args, '--session') ?? '302';
  const requestedUrl = argumentValue(args, '--url');
  const session = getMinnesotaHouseSession(sessionKey);
  const links = requestedUrl ? [{ sourceUrl: requestedUrl, date: undefined }] : await listSenateJournalLinks(session.slug);
  const journal = requestedUrl ? links[0] : links[links.length - 1];
  if (!journal) throw new Error(`No Senate journal available for ${session.slug}`);

  const text = await extractSenateJournalText(journal.sourceUrl);
  const events = parseSenateJournalText({
    text,
    sessionKey,
    sourceUrl: journal.sourceUrl,
    occurredOn: journal.date,
  });

  console.log(JSON.stringify({
    session: session.slug,
    sourceUrl: journal.sourceUrl,
    textLength: text.length,
    recordedPassageVotes: events.length,
    events: events.map((event) => ({
      billIdentifier: event.billIdentifier,
      occurredOn: event.occurredOn,
      yeaCount: event.yeaCount,
      nayCount: event.nayCount,
      memberVotes: event.memberVotes.length,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
