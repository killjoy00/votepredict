export interface MemberProbability {
  memberId: string;
  yesProbability: number;
}

export interface ChamberSimulationResult {
  simulations: number;
  threshold: number;
  expectedYes: number;
  passageProbability: number;
  yesLow: number;
  yesHigh: number;
}

function xorshift32(seed: number): () => number {
  let state = seed | 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function quantile(sorted: number[], probability: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(probability * sorted.length)));
  return sorted[index];
}

export function simulateChamber(
  members: readonly MemberProbability[],
  threshold: number,
  options: { simulations?: number; seed?: number; interval?: number } = {},
): ChamberSimulationResult {
  const simulations = options.simulations ?? 10_000;
  const seed = options.seed ?? 1;
  const interval = options.interval ?? 0.9;
  if (!Number.isInteger(simulations) || simulations <= 0) throw new Error('simulations must be a positive integer');
  if (!Number.isInteger(threshold) || threshold <= 0) throw new Error('threshold must be a positive integer');
  if (!(interval > 0 && interval < 1)) throw new Error('interval must be between 0 and 1');
  for (const member of members) {
    if (!(member.yesProbability >= 0 && member.yesProbability <= 1)) throw new Error(`Invalid member probability for ${member.memberId}`);
  }

  const expectedYes = members.reduce((sum, member) => sum + member.yesProbability, 0);
  const random = xorshift32(seed);
  const totals = new Array<number>(simulations);
  let passes = 0;
  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let yes = 0;
    for (const member of members) if (random() < member.yesProbability) yes += 1;
    totals[simulation] = yes;
    if (yes >= threshold) passes += 1;
  }
  totals.sort((a, b) => a - b);
  const tail = (1 - interval) / 2;
  return {
    simulations,
    threshold,
    expectedYes,
    passageProbability: passes / simulations,
    yesLow: quantile(totals, tail),
    yesHigh: quantile(totals, 1 - tail),
  };
}
