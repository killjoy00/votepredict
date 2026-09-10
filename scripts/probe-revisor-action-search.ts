function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Select = { name: string | null; id: string | null; options: Array<{ value: string; text: string; selected: boolean }> };

type Session = '0922021' | '0932023' | '0942025';

async function probe(body: 'house' | 'senate', session: Session) {
  const url = `https://www.revisor.mn.gov/bills/status_search.php?body=${body}&search=action&session=${session}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VotePredict/2.0 Minnesota Revisor historical action-search audit' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Revisor ${body}/${session} action search form returned ${response.status}`);
  const html = await response.text();

  const selects: Select[] = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)].map((match) => {
    const attrs = match[1];
    const name = attrs.match(/\bname=["']([^"']+)["']/i)?.[1] ?? null;
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1] ?? null;
    const options = [...match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((option) => ({
      value: option[1].match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? '',
      text: decodeHtml(option[2]),
      selected: /\bselected\b/i.test(option[1]),
    }));
    return { name, id, options };
  });

  const actionSelect = selects.find((select) => select.name === 'action[]');
  const passageOptions = actionSelect?.options.filter((option) =>
    /pass|repass|third reading|consent calendar|special orders|general orders/i.test(option.text),
  ) ?? [];

  return {
    body,
    session,
    url,
    status: response.status,
    actionOptionCount: actionSelect?.options.length ?? 0,
    passageOptions,
  };
}

async function main(): Promise<void> {
  const sessions: Session[] = ['0922021', '0932023', '0942025'];
  const results = [];
  for (const session of sessions) {
    results.push(await probe('house', session));
    results.push(await probe('senate', session));
  }
  console.log(JSON.stringify({ revisorHistoricalPassageActionProbe: results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
