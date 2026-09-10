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

async function main(): Promise<void> {
  const url = 'https://www.revisor.mn.gov/bills/status_search.php?body=house&search=action';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VotePredict/2.0 Minnesota Revisor action-search audit' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Revisor action search form returned ${response.status}`);
  const html = await response.text();

  const selects = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)].map((match) => {
    const attrs = match[1];
    const name = attrs.match(/\bname=["']([^"']+)["']/i)?.[1] ?? null;
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1] ?? null;
    const options = [...match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((option) => ({
      value: option[1].match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? '',
      text: decodeHtml(option[2]),
    }));
    return { name, id, options };
  });

  const relevant = selects.filter((select) =>
    /action/i.test(select.name ?? '')
    || /action/i.test(select.id ?? '')
    || select.options.some((option) => /pass|third reading|calendar|committee|introduced|introduction/i.test(option.text)),
  );

  console.log(JSON.stringify({
    revisorActionSearchProbe: {
      url,
      status: response.status,
      htmlLength: html.length,
      formActions: [...new Set([...html.matchAll(/<form\b[^>]*\baction=["']([^"']+)["']/gi)].map((match) => match[1]))],
      inputs: [...html.matchAll(/<input\b([^>]*)>/gi)].map((match) => ({
        name: match[1].match(/\bname=["']([^"']+)["']/i)?.[1] ?? null,
        value: match[1].match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? null,
        type: match[1].match(/\btype=["']([^"']+)["']/i)?.[1] ?? null,
      })).filter((input) => input.name && /action|session|body|search|location|submit/i.test(input.name)),
      relevantSelects: relevant,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
