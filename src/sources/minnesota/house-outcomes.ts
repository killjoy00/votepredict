/** Recover explicit journal results, never infer passage from a roster threshold. */
export interface HouseJournalOutcome {
  identifier: string;
  yeaCount: number;
  nayCount: number;
  passed: boolean;
  resultText: string;
  journalPage?: string;
}

export function parseHouseJournalOutcomes(html: string): HouseJournalOutcome[] {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ');
  const outcomes: HouseJournalOutcome[] = [];
  const roll = /The question was taken on the (?:re)?passage of the bill(?:, as amended)? and the roll was called\.(?:\s*Pursuant to rule[^.]*\.[\s\S]{0,250}?)?\s*There were (\d+) yeas and (\d+) nays/gi;
  for (const match of text.matchAll(roll)) {
    const before = text.slice(0, match.index);
    const headings = [...before.matchAll(/([HS])\.?\s*F\.?\s*No\.?\s*(\d+)\s*,\s*A (?:bill for an act|resolution)/gi)];
    const heading = headings.at(-1);
    if (!heading) continue;
    const following = text.slice(match.index! + match[0].length);
    const boundary = following.search(/The question was taken|[HS]\.?\s*F\.?\s*No\.?\s*\d+\s*,\s*A (?:bill for an act|resolution)/i);
    const block = following.slice(0, boundary < 0 ? 12000 : Math.min(boundary, 12000));
    const result = block.match(/The (?:bill|resolution)(?:, as amended)? (?:was (not )?(?:(?:re)?passed|adopted)|did (not )?(?:pass|adopt))[^.]*\./i);
    if (!result) continue;
    outcomes.push({ identifier: `${heading[1].toUpperCase()}F${Number(heading[2])}`,
      yeaCount: Number(match[1]), nayCount: Number(match[2]), passed: !(result[1] || result[2]), resultText: result[0], journalPage: [...before.matchAll(/Top of Page (\d+)/g)].at(-1)?.[1] });
  }
  return outcomes;
}
