import { fetchHouseVoteDetail, parseHouseVoteDetailHtml } from '../src/sources/minnesota/house-votes';

const [sessionKey, billIdentifier] = process.argv.slice(2);
if (!sessionKey || !billIdentifier) {
  throw new Error('Usage: npm run data:house:inspect -- <SessionKey> <HF123|SF123>');
}

const { html, sourceUrl } = await fetchHouseVoteDetail(sessionKey, billIdentifier);
const events = parseHouseVoteDetailHtml({ html, sessionKey, sourceUrl });
process.stdout.write(`${JSON.stringify({ sourceUrl, events }, null, 2)}\n`);
