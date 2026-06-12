"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ImportJob,
  ImportStreamEvent,
  splitImportJobs,
} from "@/lib/importJobs";

export function useImportJobs(onComplete: () => void) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const seqRef = useRef(0);

  const nextSeq = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/import/status/${jobId}`);
          const data = await res.json();

          const msgs = (data.events || [])
            .filter((e: ImportStreamEvent) => e.message)
            .map((e: ImportStreamEvent) => e.message);

          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: data.status,
                    events: data.events || [],
                    result: data.result,
                    error: data.error,
                    latestMessage:
                      msgs.length > 0 ? msgs[msgs.length - 1] : j.latestMessage,
                    finishedAt:
                      data.status === "completed" || data.status === "failed"
                        ? j.finishedAt ?? Date.now()
                        : j.finishedAt,
                  }
                : j
            )
          );

          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
            pollRefs.current.delete(jobId);
            if (data.status === "completed") onComplete();
          }
        } catch {
          // keep polling
        }
      }, 2000);

      pollRefs.current.set(jobId, interval);
    },
    [onComplete]
  );

  const submitImport = useCallback(
    async (files: File[], url: string, notes: string) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      formData.append("url", url);
      formData.append("notes", notes);

      try {
        const res = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          const job: ImportJob = {
            id: crypto.randomUUID(),
            status: "failed",
            files: files.map((f) => f.name),
            url,
            events: [],
            result: null,
            error: data.error || "Upload failed",
            latestMessage: "Upload failed",
            seq: nextSeq(),
            finishedAt: Date.now(),
          };
          setJobs((prev) => [...prev, job]);
          return;
        }

        const job: ImportJob = {
          id: data.jobId,
          status: "running",
          files: files.map((f) => f.name),
          url,
          events: [],
          result: null,
          error: null,
          latestMessage: "Starting inventory agent...",
          seq: nextSeq(),
        };
        setJobs((prev) => [...prev, job]);
        startPolling(data.jobId);
      } catch (err) {
        const job: ImportJob = {
          id: crypto.randomUUID(),
          status: "failed",
          files: files.map((f) => f.name),
          url,
          events: [],
          result: null,
          error: err instanceof Error ? err.message : "Upload failed",
          latestMessage: "Upload failed",
          seq: nextSeq(),
          finishedAt: Date.now(),
        };
        setJobs((prev) => [...prev, job]);
      }
    },
    [startPolling, nextSeq]
  );

  const dismissJob = useCallback((jobId: string) => {
    const interval = pollRefs.current.get(jobId);
    if (interval) {
      clearInterval(interval);
      pollRefs.current.delete(jobId);
    }
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const interval of pollRefs.current.values()) {
        clearInterval(interval);
      }
    };
  }, []);

  return { jobs, submitImport, dismissJob };
}

/* ── Header status pills ── */

interface JobReportProps {
  job: ImportJob;
  onDismiss: (id: string) => void;
  dismissible?: boolean;
}

function JobReport({ job, onDismiss, dismissible = true }: JobReportProps) {
  return (
    <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground truncate">
          {job.files.join(", ")}
        </span>
        {dismissible && job.status !== "running" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(job.id);
            }}
            className="text-muted-foreground hover:text-foreground text-sm"
            aria-label="Dismiss job"
          >
            ✕
          </button>
        )}
      </div>
      {job.status === "running" && (
        <p className="text-[11px] text-primary">{job.latestMessage}</p>
      )}
      {job.status === "completed" && job.result && (
        <>
          <p className="text-[11px] text-success whitespace-pre-wrap">
            {job.result.summary}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {job.result.num_turns} steps &middot; $
            {job.result.cost_usd.toFixed(3)}
          </p>
        </>
      )}
      {job.status === "failed" && (
        <p className="text-[11px] text-error">{job.error}</p>
      )}
      {job.events
        .filter((e) => e.message)
        .slice(-8)
        .map((e, i) => (
          <p key={i} className="text-[10px] text-muted-foreground">
            {e.message}
          </p>
        ))}
    </div>
  );
}

export function ImportJobPills({
  jobs,
  onDismiss,
}: {
  jobs: ImportJob[];
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previousOpen, setPreviousOpen] = useState(false);
  const [openPreviousId, setOpenPreviousId] = useState<string | null>(null);

  const { pills, previous } = useMemo(() => splitImportJobs(jobs), [jobs]);

  if (jobs.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {pills.map((job) => (
        <div key={job.id} className="relative">
          <button
            onClick={() =>
              setExpanded(expanded === job.id ? null : job.id)
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
              job.status === "running"
                ? "bg-primary/20 text-primary"
                : job.status === "completed"
                ? "bg-success/20 text-success"
                : "bg-error/20 text-error"
            }`}
          >
            {job.status === "running" && (
              <div className="w-3 h-3 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {job.status === "completed" && <span>✓</span>}
            {job.status === "failed" && <span>✕</span>}
            <span className="max-w-[120px] truncate">
              {job.files[0]}
              {job.files.length > 1 && ` +${job.files.length - 1}`}
            </span>
          </button>

          {expanded === job.id && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              <JobReport job={job} onDismiss={onDismiss} />
            </div>
          )}
        </div>
      ))}

      {previous.length > 0 && (
        <div className="relative">
          <button
            onClick={() => {
              setPreviousOpen((v) => !v);
              setOpenPreviousId(null);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={previousOpen}
            aria-label="Previous import jobs"
          >
            <span>Previous</span>
            <span className="px-1 rounded bg-card text-[10px]">
              {previous.length}
            </span>
          </button>

          {previousOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border text-[11px] font-medium text-muted-foreground">
                Previous imports
              </div>
              <ul className="max-h-80 overflow-y-auto divide-y divide-border">
                {previous.map((job) => {
                  const open = openPreviousId === job.id;
                  return (
                    <li key={job.id}>
                      <button
                        onClick={() =>
                          setOpenPreviousId(open ? null : job.id)
                        }
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-[11px] truncate text-foreground">
                          {job.files[0]}
                          {job.files.length > 1 && ` +${job.files.length - 1}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {open ? "▾" : "▸"}
                        </span>
                      </button>
                      {open && (
                        <div className="border-t border-border bg-card/40">
                          <JobReport job={job} onDismiss={onDismiss} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
