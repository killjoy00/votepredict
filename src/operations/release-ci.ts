export function assertGreenMainRelease(sha: string, runs: unknown[]): void {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release SHA');
  const matching = runs.filter((run): run is Record<string, unknown> => Boolean(run && typeof run === 'object'))
    .filter(run => run.head_sha === sha && run.head_branch === 'main' && run.event === 'push'
      && run.path === '.github/workflows/ci.yml')
    .sort((a, b) => Number(b.run_number) - Number(a.run_number) || Number(b.run_attempt) - Number(a.run_attempt));
  if (matching[0]?.status !== 'completed' || matching[0]?.conclusion !== 'success') {
    throw new Error('Latest exact-main CI run is absent, unfinished or unsuccessful');
  }
}
