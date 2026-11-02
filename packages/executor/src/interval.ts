import type { RandomIntervalPolicy } from "./contracts.js";

export function createRandomIntervalPolicy(
  fromSeconds: number,
  toSeconds: number
): RandomIntervalPolicy {
  if (!Number.isInteger(fromSeconds) || !Number.isInteger(toSeconds)) {
    throw new Error("Interval bounds must be integers");
  }
  if (fromSeconds < 10 || toSeconds < fromSeconds) {
    throw new Error("Interval must be at least 10 seconds and ordered");
  }
  return {
    fromSeconds,
    toSeconds,
    sample(seed: number, sequence: number): number {
      const span = toSeconds - fromSeconds + 1;
      const value = Math.abs(Math.trunc(seed) + Math.trunc(sequence) * 1103515245);
      return fromSeconds + (value % span);
    }
  };
}
