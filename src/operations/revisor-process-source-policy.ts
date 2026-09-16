export const MIN_REVISOR_PROCESS_RESEARCH_COVERAGE = 0.99;

export type RevisorProcessSourceExclusionReason =
  | 'html_response'
  | 'unexpected_document'
  | 'not_found';

export interface RevisorProcessSourceFailurePolicy {
  permanent: boolean;
  reason: RevisorProcessSourceExclusionReason | null;
  message: string;
}

function failureMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

export function classifyRevisorProcessSourceFailure(error: unknown): RevisorProcessSourceFailurePolicy {
  const message = failureMessage(error);
  if (/Minnesota Revisor XML endpoint returned HTML/i.test(message)) {
    return { permanent: true, reason: 'html_response', message };
  }
  if (/Minnesota Revisor XML endpoint returned an unexpected document/i.test(message)) {
    return { permanent: true, reason: 'unexpected_document', message };
  }
  if (/Minnesota Revisor bill status returned (?:404|410)\b/i.test(message)) {
    return { permanent: true, reason: 'not_found', message };
  }
  return { permanent: false, reason: null, message };
}
