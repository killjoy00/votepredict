import { fetchRevisorStatusXml, parseRevisorOfficialActions } from '../src/sources/minnesota/revisor-actions.js';
import { buildRevisorRegularSessionStatusXmlUrls, parseRevisorIntroductionMetadata } from '../src/sources/minnesota/revisor-introduction.js';

const samples = [
  { session: '2021-2022', identifier: 'HF11' },
  { session: '2021-2022', identifier: 'HF2632' },
  { session: '2023-2024', identifier: 'HF4277' },
  { session: '2025-2026', identifier: 'SF3587' },
] as const;

for (const sample of samples) {
  for (const url of buildRevisorRegularSessionStatusXmlUrls(sample.session, sample.identifier)) {
    try {
      const xml = await fetchRevisorStatusXml(url);
      const intro = parseRevisorIntroductionMetadata({ xml, identifier: sample.identifier });
      const actions = parseRevisorOfficialActions(xml);
      const dated = actions.filter((a) => a.occurredOn).map((a) => a.occurredOn as string).sort();
      console.log(JSON.stringify({
        sample,
        url,
        introducedOn: intro.introducedOn,
        initialDocumentInsertedOn: intro.initialDocument?.insertedOn ?? null,
        actionCount: actions.length,
        minActionDate: dated[0] ?? null,
        maxActionDate: dated.at(-1) ?? null,
        actionYears: [...new Set(dated.map((d) => d.slice(0,4)))],
      }));
    } catch (error) {
      console.log(JSON.stringify({
        sample,
        url,
        error: error instanceof Error ? error.message.replace(/https?:\/\/\S+/g,'[url]') : String(error),
      }));
    }
  }
}
