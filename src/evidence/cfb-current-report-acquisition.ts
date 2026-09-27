  const cookie = await fetchReportAppSession();
  const response = await fetch(CFB_REPORT_API_URL, {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-current-report-validation',
      accept: 'application/json,text/plain;q=0.8,*/*;q=0.1',
      'content-type': 'application/x-www-form-urlencoded',
      referer: CFB_CURRENT_LISTS_APP_URL + '#/' + kind + '/all/',
      origin: CFB_ORIGIN,
      'x-requested-with': 'XMLHttpRequest',
      ...(cookie ? { cookie } : {}),
    },
    body: gridBody(kind),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('CFB current-report API HTTP ' + response.status);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('CFB current-report API response exceeded 8 MB');
  return parseCfbCurrentReportGrid(text);
}

export function cfbReportViewerUrl(reference: CfbReportViewerReference): string {
  const url = new URL(CFB_REPORT_VIEWER_URL);
  url.searchParams.set('downloadpdf', 'false');
  url.searchParams.set('year', reference.year);
  url.searchParams.set('type', reference.type);
  url.searchParams.set('period', reference.period);
  url.searchParams.set('se', reference.se);
  url.searchParams.set('regnum', reference.registrationNumber);
  url.searchParams.set('amend', String(reference.amendment));
  return url.toString();
}

function cfbReportViewerFormBody(
  reference: CfbReportViewerReference,
  searchType?: string,
): string {
  const params = new URLSearchParams();
  if (searchType) params.set('searchType', searchType);
  params.set('downloadpdf', 'false');
  params.set('year', reference.year);
  params.set('type', reference.type);
  params.set('period', reference.period);
  params.set('se', reference.se);
  params.set('regnum', reference.registrationNumber);
  params.set('amend', String(reference.amendment));
  params.set('disc', '');
  params.set('date', '');
  params.set('show', '0');
  return params.toString();
}

export async function fetchCfbReportViewerText(
  reference: CfbReportViewerReference,
  options: { method?: 'GET' | 'POST'; referer?: string; searchType?: string } = {},
) {
  const sourceUrl = cfbReportViewerUrl(reference);
  const method = options.method ?? 'GET';
  const response = await fetch(method === 'POST' ? CFB_REPORT_VIEWER_URL : sourceUrl, {
    method,
    headers: {
      'user-agent': 'Mozilla/5.0 VotePredict/2.0 cfb-current-report-validation',
      referer: options.referer ?? CFB_CURRENT_LISTS_APP_URL + '#/candidate-reports/all/',
      accept: 'application/pdf,text/html;q=0.9,*/*;q=0.1',
      ...(method === 'POST'
        ? { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }
        : {}),
    },
    ...(method === 'POST'
      ? { body: cfbReportViewerFormBody(reference, options.searchType) }
      : {}),
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error('CFB report viewer HTTP ' + response.status);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !['cfb.mn.gov', 'www.cfb.mn.gov'].includes(finalUrl.hostname.toLowerCase())) {
    throw new Error('CFB report viewer redirected off official cfb.mn.gov host');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 300 || bytes.byteLength > MAX_REPORT_BYTES) {
    throw new Error('CFB report viewer returned unexpected byte length ' + bytes.byteLength);
  }
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 5));
  if (header !== '%PDF-') throw new Error('CFB report viewer response was not a PDF');

  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes, CanvasFactory });
  try {
    const parsed = await parser.getText();
    const text = parsed.text ?? '';
    if (text.trim().length < 100) throw new Error('CFB report PDF text extraction returned too little text');
    return {
      sourceUrl,
      text,
      contentSha256: createHash('sha256').update(bytes).digest('hex'),
      fetchedAt: new Date().toISOString(),
      bytes: bytes.byteLength,
    };
  } finally {
    await parser.destroy();
  }
}

export async function acquireCfbCurrentReportProofs(input: {
  kind: CfbCurrentReportKind;
  maxReports: number;
  registrationNumbers?: readonly string[];
}) {
  const grid = await fetchCfbCurrentReportGrid(input.kind);
  const maxReports = Math.min(20, Math.max(1, input.maxReports));
  const allowed = input.registrationNumbers?.length
    ? new Set(input.registrationNumbers.map(value => value.trim()).filter(Boolean))
    : null;
  const eligibleReferences = allowed
    ? grid.references.filter(reference => allowed.has(reference.registrationNumber))
    : grid.references;
  const selected = eligibleReferences.slice(0, maxReports);
  const reports: CfbAcquiredCurrentReport[] = [];
  const failures: Array<{ registrationNumber: string; reportName: string; error: string }> = [];

  for (const reference of selected) {
    try {
      const fetched = await fetchCfbReportViewerText(reference);
      const proof = parseCfbReportPdfAvailability(reference, fetched.text);
      if (!proof) throw new Error('CFB report PDF lacked required coverage/received/registration proof');
      reports.push({ proof, text: fetched.text, contentSha256: fetched.contentSha256, fetchedAt: fetched.fetchedAt, bytes: fetched.bytes });
    } catch (error) {
      failures.push({
        registrationNumber: reference.registrationNumber,
        reportName: reference.reportName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    kind: input.kind,
    entitiesDiscovered: grid.entityCount,
    referencesDiscovered: grid.references.length,
    eligibleReferences: eligibleReferences.length,
    selectedReports: selected.length,
    reports,
    failures,
  };
}
