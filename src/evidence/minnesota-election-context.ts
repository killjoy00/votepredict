export const MN_SOS_LEGISLATIVE_RESULTS_PARSER_VERSION = 'mn-sos-legislative-results-v1' as const;

export type MinnesotaLegislativeOffice = 'State Representative' | 'State Senator';

export interface SosLegislativeResultRow {
  state: string;
  countyId?: string;
  precinctName?: string;
  officeId: string;
  officeName: string;
  district: string;
  candidateOrder: number;
  candidateName: string;
  suffix?: string;
  incumbent: boolean;
  party: string;
  precinctsReporting: number;
  totalPrecincts: number;
  votes: number;
  percentage: number;
  totalVotesForOffice: number;
}

export interface DistrictElectionContext {
  office: MinnesotaLegislativeOffice;
  district: string;
  candidateCount: number;
  totalVotes: number;
  topVotePct: number;
  secondVotePct: number;
  topTwoMarginPct: number;
  uncontested: boolean;
  precinctsReporting: number;
  totalPrecincts: number;
}

function numeric(value: string): number {
  const parsed = Number(value.replace(/[% ,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeMinnesotaDistrict(value: string): string {
  const compact = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const match = compact.match(/^0*(\d+)([A-Z]*)$/);
  return match ? String(Number(match[1])) + match[2] : compact;
}

export function parseSosLegislativeByDistrict(text: string): SosLegislativeResultRow[] {
  const rows: SosLegislativeResultRow[] = [];
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const cells = line.split(';').map((cell) => cell.trim());
    if (cells.length < 16) continue;
    const officeName = cells[4];
    if (!/state\s+(?:representative|senator)/i.test(officeName)) continue;
    rows.push({
      state: cells[0],
      countyId: cells[1] || undefined,
      precinctName: cells[2] || undefined,
      officeId: cells[3],
      officeName,
      district: normalizeMinnesotaDistrict(cells[5]),
      candidateOrder: numeric(cells[6]),
      candidateName: cells[7],
      suffix: cells[8] || undefined,
      incumbent: /^(?:y|yes|true|1)$/i.test(cells[9]),
      party: cells[10],
      precinctsReporting: numeric(cells[11]),
      totalPrecincts: numeric(cells[12]),
      votes: numeric(cells[13]),
      percentage: numeric(cells[14]),
      totalVotesForOffice: numeric(cells[15]),
    });
  }
  return rows;
}

export function summarizeLegislativeDistrict(
  rows: readonly SosLegislativeResultRow[],
  office: MinnesotaLegislativeOffice,
  district: string,
): DistrictElectionContext | undefined {
  const normalizedDistrict = normalizeMinnesotaDistrict(district);
  const candidates = rows
    .filter((row) => row.officeName.toLowerCase() === office.toLowerCase()
      && row.district === normalizedDistrict)
    .sort((left, right) => right.votes - left.votes || left.candidateOrder - right.candidateOrder);
  if (candidates.length === 0) return undefined;
  const top = candidates[0];
  const second = candidates[1];
  const totalVotes = Math.max(
    ...candidates.map((row) => row.totalVotesForOffice),
    candidates.reduce((sum, row) => sum + row.votes, 0),
  );
  return {
    office,
    district: normalizedDistrict,
    candidateCount: candidates.length,
    totalVotes,
    topVotePct: top.percentage,
    secondVotePct: second?.percentage ?? 0,
    topTwoMarginPct: Math.max(0, top.percentage - (second?.percentage ?? 0)),
    uncontested: candidates.length < 2 || (second?.votes ?? 0) === 0,
    precinctsReporting: Math.max(...candidates.map((row) => row.precinctsReporting)),
    totalPrecincts: Math.max(...candidates.map((row) => row.totalPrecincts)),
  };
}
