import type { JobLog, JobRecord, JobRepository } from "./types";

export class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly allLogs = new Map<string, JobLog[]>();

  async save(job: JobRecord): Promise<JobRecord> {
    const copy = { ...job, actions: job.actions.map((action) => ({ ...action })) };
    this.jobs.set(job.id, copy);
    return { ...copy, actions: copy.actions.map((action) => ({ ...action })) };
  }

  async get(ownerId: string, id: string): Promise<JobRecord | null> {
    const job = this.jobs.get(id);
    return job && job.ownerId === ownerId
      ? { ...job, actions: job.actions.map((action) => ({ ...action })) }
      : null;
  }

  async list(ownerId: string): Promise<JobRecord[]> {
    return [...this.jobs.values()]
      .filter((job) => job.ownerId === ownerId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((job) => ({ ...job, actions: job.actions.map((action) => ({ ...action })) }));
  }

  async logs(ownerId: string, id: string): Promise<JobLog[]> {
    const job = this.jobs.get(id);
    if (!job || job.ownerId !== ownerId) return [];
    return (this.allLogs.get(id) ?? []).map((log) => ({ ...log, data: log.data ? { ...log.data } : undefined }));
  }

  async appendLog(ownerId: string, log: JobLog): Promise<void> {
    const job = this.jobs.get(log.jobId);
    if (!job || job.ownerId !== ownerId) return;
    const logs = this.allLogs.get(log.jobId) ?? [];
    logs.push({ ...log, data: log.data ? { ...log.data } : undefined });
    this.allLogs.set(log.jobId, logs);
  }
}
