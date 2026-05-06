"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface StreamEvent {
  type: string;
  subtype?: string;
  message?: string;
  timestamp: number;
}

interface ImportResult {
  cost_usd: number;
  num_turns: number;
  max_turns: number;
  session_id: string;
  summary: string;
}

interface Job {
  id: string;
  status: "uploading" | "running" | "completed" | "failed";
  files: string[];
  url: string;
  events: StreamEvent[];
  result: ImportResult | null;
  error: string | null;
  latestMessage: string;
}

export function useImportJobs(onComplete: () => void) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const startPolling = useCallback(
    (jobId: string) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/import/status/${jobId}`);
          const data = await res.json();

          const msgs = (data.events || [])
            .filter((e: StreamEvent) => e.message)
            .map((e: StreamEvent) => e.message);

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
          const job: Job = {
            id: crypto.randomUUID(),
            status: "failed",
            files: files.map((f) => f.name),
            url,
            events: [],
            result: null,
            error: data.error || "Upload failed",
            latestMessage: "Upload failed",
          };
          setJobs((prev) => [...prev, job]);
          return;
        }

        const job: Job = {
          id: data.jobId,
          status: "running",
          files: files.map((f) => f.name),
          url,
          events: [],
          result: null,
          error: null,
          latestMessage: "Starting inventory agent...",
        };
        setJobs((prev) => [...prev, job]);
        startPolling(data.jobId);
      } catch (err) {
        const job: Job = {
          id: crypto.randomUUID(),
          status: "failed",
          files: files.map((f) => f.name),
          url,
          events: [],
          result: null,
          error: err instanceof Error ? err.message : "Upload failed",
          latestMessage: "Upload failed",
        };
        setJobs((prev) => [...prev, job]);
      }
    },
    [startPolling]
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

export function ImportJobPills({
  jobs,
  onDismiss,
}: {
  jobs: Job[];
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (jobs.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {jobs.map((job) => (
        <div key={job.id} className="relative">
          <button
            onClick={() =>
              setExpanded(expanded === job.id ? null : job.id)
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-colors ${
              job.status === "running"
                ? "bg-blue-900/50 text-blue-300"
                : job.status === "completed"
                ? "bg-green-900/50 text-green-300"
                : "bg-red-900/50 text-red-300"
            }`}
          >
            {job.status === "running" && (
              <div className="w-3 h-3 border-[1.5px] border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
            {job.status === "completed" && <span>✓</span>}
            {job.status === "failed" && <span>✕</span>}
            <span className="max-w-[120px] truncate">
              {job.files[0]}
              {job.files.length > 1 && ` +${job.files.length - 1}`}
            </span>
          </button>

          {/* Expanded dropdown */}
          {expanded === job.id && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-300">
                  Import: {job.files.join(", ")}
                </span>
                {job.status !== "running" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(job.id);
                    }}
                    className="text-gray-500 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
                {job.status === "running" && (
                  <p className="text-[11px] text-blue-300">
                    {job.latestMessage}
                  </p>
                )}
                {job.status === "completed" && job.result && (
                  <>
                    <p className="text-[11px] text-green-300 whitespace-pre-wrap">
                      {job.result.summary}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {job.result.num_turns} steps &middot; $
                      {job.result.cost_usd.toFixed(3)}
                    </p>
                  </>
                )}
                {job.status === "failed" && (
                  <p className="text-[11px] text-red-400">{job.error}</p>
                )}
                {job.events
                  .filter((e) => e.message)
                  .slice(-8)
                  .map((e, i) => (
                    <p key={i} className="text-[10px] text-gray-600">
                      {e.message}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
