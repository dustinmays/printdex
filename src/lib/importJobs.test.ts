import { describe, expect, it } from "vitest";
import {
  COMPLETED_PILL_LIMIT,
  ImportJob,
  splitImportJobs,
} from "./importJobs";

function makeJob(overrides: Partial<ImportJob> & Pick<ImportJob, "id" | "seq">): ImportJob {
  return {
    status: "completed",
    files: ["model.stl"],
    url: "",
    events: [],
    result: null,
    error: null,
    latestMessage: "",
    finishedAt: overrides.seq,
    ...overrides,
  };
}

describe("splitImportJobs", () => {
  it("returns empty arrays when there are no jobs", () => {
    expect(splitImportJobs([])).toEqual({ pills: [], previous: [] });
  });

  it("keeps running jobs in pills regardless of completed count", () => {
    const jobs: ImportJob[] = [
      makeJob({ id: "a", seq: 1 }),
      makeJob({ id: "b", seq: 2 }),
      makeJob({ id: "c", seq: 3 }),
      makeJob({ id: "running", seq: 4, status: "running" }),
    ];
    const { pills, previous } = splitImportJobs(jobs);
    expect(pills.map((j) => j.id)).toContain("running");
    // Only the two most recent completed remain in pills.
    const completedInPills = pills.filter((j) => j.status === "completed");
    expect(completedInPills).toHaveLength(COMPLETED_PILL_LIMIT);
    expect(completedInPills.map((j) => j.id).sort()).toEqual(["b", "c"]);
    expect(previous.map((j) => j.id)).toEqual(["a"]);
  });

  it("archives older completed jobs beyond the limit", () => {
    const jobs: ImportJob[] = [
      makeJob({ id: "old1", seq: 1, finishedAt: 100 }),
      makeJob({ id: "old2", seq: 2, finishedAt: 200 }),
      makeJob({ id: "recent1", seq: 3, finishedAt: 300 }),
      makeJob({ id: "recent2", seq: 4, finishedAt: 400 }),
    ];
    const { pills, previous } = splitImportJobs(jobs);
    expect(pills.map((j) => j.id)).toEqual(["recent1", "recent2"]);
    expect(previous.map((j) => j.id)).toEqual(["old2", "old1"]);
  });

  it("keeps failed jobs visible in pills", () => {
    const jobs: ImportJob[] = [
      makeJob({ id: "fail", seq: 1, status: "failed", error: "boom" }),
      makeJob({ id: "c1", seq: 2, finishedAt: 2 }),
      makeJob({ id: "c2", seq: 3, finishedAt: 3 }),
      makeJob({ id: "c3", seq: 4, finishedAt: 4 }),
    ];
    const { pills, previous } = splitImportJobs(jobs);
    expect(pills.map((j) => j.id)).toContain("fail");
    expect(previous.map((j) => j.id)).toEqual(["c1"]);
  });
});
