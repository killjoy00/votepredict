    },
    body: cfbCandidateReportsTabForm(registration, endYear).toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('CFB candidate reports tab API HTTP ' + response.status);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'register.cfb.mn.gov') {
    throw new Error('CFB candidate reports tab API redirected off register.cfb.mn.gov');
  }
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('CFB candidate reports tab API response exceeded 8 MB');
  return parseCfbCandidateReportsTabResponse(text, registration, endYear);
}

export async function acquireCfbCandidateHistoricalReportProofs(input: {
  registrationNumber: string;
  segmentEndYear: number;
  maxReports?: number;
}) {
  const references = await fetchCfbCandidateHistoricalReportReferences(
    input.registrationNumber,
    input.segmentEndYear,
  );
  const maxReports = Math.min(16, Math.max(1, input.maxReports ?? 12));
  const selected = references.slice(0, maxReports);
  const reports: CfbCandidateHistoricalReport[] = [];
  const failures: Array<{ reportName: string; error: string }> = [];
  const registration = requireRegistrationNumber(input.registrationNumber);
  const endYear = requireSegmentEndYear(input.segmentEndYear);
  const referer =
    CFB_ORIGIN + '/reports-and-data/viewers/campaign-finance/candidates/'
    + registration + '/' + endYear + '/';

  for (const reference of selected) {
    try {
      const fetched = await fetchCfbReportViewerText(reference, {
        method: 'POST',
        referer,
        searchType: 'Candidate',
      });
      const proof = parseCfbReportPdfAvailability(reference, fetched.text);
      if (!proof) throw new Error('CFB historical candidate report lacked required availability proof');
      reports.push({
        proof,
        text: fetched.text,
        contentSha256: fetched.contentSha256,
        fetchedAt: fetched.fetchedAt,
        bytes: fetched.bytes,
      });
    } catch (error) {
      failures.push({
        reportName: reference.reportName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    registrationNumber: requireRegistrationNumber(input.registrationNumber),
    segmentEndYear: requireSegmentEndYear(input.segmentEndYear),
    referencesDiscovered: references.length,
    selectedReports: selected.length,
    reports,
    failures,
  };
}
