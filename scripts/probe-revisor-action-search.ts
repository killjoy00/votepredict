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

async function probe(body: 'house' | 'senate') {
  const url = `https://www.revisor.mn.gov/bills/status_search.php?body=${body}&search=action`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VotePredict/2.0 Minnesota Revisor action-search audit' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Revisor ${body} action search form returned ${response.status}`);
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
  const lifecycleOptions = actionSelect?.options.filter((option) =>
    /pass|third reading|calendar|committee report|introduction|presented to governor|governor approval|chapter number/i.test(option.text),
  ) ?? [];

  const formMatch = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].find((match) => /status_result\.php/i.test(match[1]));
  const formHtml = formMatch?.[2] ?? '';
  return {
    body,
    url,
    status: response.status,
    htmlLength: html.length,
    resultForm: formMatch ? {
      attrs: decodeHtml(formMatch[1]),
      inputs: [...formHtml.matchAll(/<input\b([^>]*)>/gi)].map((match) => ({
        name: match[1].match(/\bname=["']([^"']+)["']/i)?.[1] ?? null,
        value: match[1].match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? null,
        type: match[1].match(/\btype=["']([^"']+)["']/i)?.[1] ?? null,
        checked: /\bchecked\b/i.test(match[1]),
      })).filter((input) => input.name),
      selectSummary: selects.map((select) => ({
        name: select.name,
        id: select.id,
        selected: select.options.filter((option) => option.selected),
        firstOptions: select.name === 'action[]' ? [] : select.options.slice(0, 15),
      })),
    } : null,
    lifecycleOptions,
  };
}

async function main(): Promise<void> {
  const house = await probe('house');
  const senate = await probe('senate');
  console.log(JSON.stringify({ revisorActionSearchProbe: { house, senate } }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
