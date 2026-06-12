/**
 * Pure helpers for the import-job tracker.
 *
 * Active jobs (uploading/running) and failed jobs are always shown as pills.
 * Completed jobs are pruned so only the two most recent appear inline; the
 * older completed reports move into a "Previous Jobs" archive.
 */

export interface ImportStreamEvent {
  type: string;
  subtype?: string;
  message?: string;
  timestamp: number;
}

export interface ImportResult {
  cost_usd: number;
  num_turns: number;
  max_turns: number;
  session_id: string;
  summary: string;
}

export type ImportJobStatus =
  | "uploading"
  | "running"
  | "completed"
  | "failed";

export interface ImportJob {
  id: string;
  status: ImportJobStatus;
  files: string[];
  url: string;
  events: ImportStreamEvent[];
  result: ImportResult | null;
  error: string | null;
  latestMessage: string;
  /** Order in which the job was created (monotonic counter). */
  seq: number;
  /** When the job finished (ms epoch). Unset while running. */
  finishedAt?: number;
}

/** How many completed jobs we keep visible in the header pills. */
export const COMPLETED_PILL_LIMIT = 2;

/**
 * Split jobs into the set displayed as header pills and an archive of older
 * completed reports. Newer completed jobs come first in `previous`.
 */
export function splitImportJobs(jobs: ImportJob[]): {
  pills: ImportJob[];
  previous: ImportJob[];
} {
  const active: ImportJob[] = [];
  const completed: ImportJob[] = [];

  for (const job of jobs) {
    if (job.status === "completed") {
      completed.push(job);
    } else {
      active.push(job);
    }
  }

  // Newest completed first (prefer finishedAt, fall back to seq).
  completed.sort((a, b) => {
    const af = a.finishedAt ?? 0;
    const bf = b.finishedAt ?? 0;
    if (af !== bf) return bf - af;
    return b.seq - a.seq;
  });

  const visibleCompleted = completed.slice(0, COMPLETED_PILL_LIMIT);
  const previous = completed.slice(COMPLETED_PILL_LIMIT);

  // Pills render in original insertion order (oldest first) so positions
  // stay stable as jobs come and go.
  const visibleIds = new Set([
    ...active.map((j) => j.id),
    ...visibleCompleted.map((j) => j.id),
  ]);
  const pills = jobs.filter((j) => visibleIds.has(j.id));

  return { pills, previous };
}

/**
 * Drop completed jobs beyond {@link COMPLETED_PILL_LIMIT} from the
 * inline-pill set. Older completed jobs are *not* discarded — callers keep
 * them in the archive — but this helper returns the trimmed list of jobs
 * that should remain "live" in the tracker's state.
 *
 * Currently we keep every job in state and rely on {@link splitImportJobs}
 * to decide where each one renders, so this function is a no-op identity.
 * It exists so callers have one well-named place to enforce future caps
 * (e.g. trimming the archive itself).
 */
export function pruneImportJobs(jobs: ImportJob[]): ImportJob[] {
  return jobs;
}
