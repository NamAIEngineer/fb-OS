import type { ExecutorOutcome, JobAction, JobExecutor } from "../jobs";

/** E2E-only executor. It records action IDs and performs no external work. */
export class MockExecutor implements JobExecutor {
  readonly actions: JobAction[] = [];

  constructor(
    private readonly outcomeFor: (action: JobAction, index: number) => ExecutorOutcome = () => ({
      status: "success",
    }),
  ) {}

  async execute(action: JobAction): Promise<ExecutorOutcome> {
    const index = this.actions.length;
    this.actions.push({ ...action, payload: action.payload ? { ...action.payload } : undefined });
    return this.outcomeFor(action, index);
  }
}
