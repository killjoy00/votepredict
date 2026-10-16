/** One shared, serial courtesy budget for the official Minnesota Revisor. */
export class RevisorPacer {
  private nextStart = 0;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: {
    intervalMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {}) {
    this.intervalMs = options.intervalMs ?? 1150;
    if (this.intervalMs < 1000) throw Error('Revisor requests must be spaced at least one second apart');
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }

  async wait(): Promise<void> {
    const current = this.now();
    const start = Math.max(current, this.nextStart);
    this.nextStart = start + this.intervalMs;
    if (start > current) await this.sleep(start - current);
  }
}
