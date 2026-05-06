import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const BASE_DIR = process.env.WATCH_DIR || path.resolve(process.cwd(), "..");
const INBOX_DIR = path.join(BASE_DIR, "inbox");

interface ImportJob {
  id: string;
  status: "uploading" | "running" | "completed" | "failed";
  events: StreamEvent[];
  result: ImportResult | null;
  error: string | null;
  process: ChildProcess | null;
  files: string[];
  url: string;
  notes: string;
  createdAt: number;
}

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

// In-memory job store
const jobs = new Map<string, ImportJob>();

// Clean up old jobs after 1 hour
function pruneJobs() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && job.status !== "running") {
      jobs.delete(id);
    }
  }
}

function deriveStatusMessage(event: Record<string, unknown>): string | null {
  const type = event.type as string;

  if (type === "system" && event.subtype === "init") {
    return "Agent started...";
  }

  if (type === "assistant") {
    // Check for tool use
    const content = event.content as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "tool_use") {
          const name = block.name as string;
          if (name === "WebFetch") return "Fetching print details from source...";
          if (name === "Write") {
            const input = block.input as Record<string, unknown> | undefined;
            const filePath = input?.file_path as string | undefined;
            if (filePath?.includes("prints.yaml")) return "Writing metadata...";
            return "Creating file...";
          }
          if (name === "Edit") return "Updating metadata...";
          if (name === "Bash") {
            const cmd = (block.input as Record<string, unknown>)?.command as string || "";
            if (cmd.startsWith("mv")) return "Organizing files...";
            if (cmd.startsWith("mkdir")) return "Creating folder...";
            if (cmd.startsWith("unzip")) return "Extracting archive...";
            if (cmd.startsWith("rm")) return "Cleaning up...";
            return "Running command...";
          }
          if (name === "Glob" || name === "Grep") return "Scanning files...";
          if (name === "Read") return "Reading file...";
          return `Running ${name}...`;
        }
        if (block.type === "text" && typeof block.text === "string") {
          // Use the first ~80 chars of assistant text as status
          const text = (block.text as string).trim();
          if (text.length > 0) {
            return text.length > 80 ? text.slice(0, 77) + "..." : text;
          }
        }
      }
    }
  }

  if (type === "result") {
    return "Done!";
  }

  return null;
}

function startInventoryAgent(job: ImportJob) {
  const fileList = job.files.join(", ");

  const promptParts = [
    `Process new files in the inbox: ${fileList}`,
    `These ${job.files.length > 1 ? `${job.files.length} files are from the same project/model — group them into one folder with a single prints.yaml entry listing all files.` : "file needs to be organized and cataloged."}`,
    job.url ? `Source URL: ${job.url}` : "",
    job.notes ? `User notes: ${job.notes}` : "",
    "Move files out of inbox first, then fetch metadata from the source URL and create prints.yaml.",
  ].filter(Boolean);

  const prompt = promptParts.join("\n");

  const proc = spawn(
    "claude",
    [
      "--agent",
      "inventory",
      "-p",
      "--verbose",
      "--output-format",
      "stream-json",
      "--max-turns",
      "30",
      "--max-budget-usd",
      "1.00",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Read,Write,Edit,Glob,Grep,WebFetch,Bash(mv inbox/*),Bash(mv inbox/**/*),Bash(mkdir *),Bash(mkdir -p *),Bash(unzip *),Bash(rm inbox/*),Bash(ls *),Bash(diff *)",
    ],
    {
      cwd: BASE_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  // Pipe prompt via stdin (more reliable than positional args)
  proc.stdin?.write(prompt);
  proc.stdin?.end();

  job.process = proc;
  job.status = "running";

  let stdoutBuffer = "";
  let stderrBuffer = "";

  proc.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();

    // Process complete JSON lines
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        const message = deriveStatusMessage(event);

        job.events.push({
          type: event.type,
          subtype: event.subtype,
          message: message || undefined,
          timestamp: Date.now(),
        });

        if (event.type === "result") {
          job.status = "completed";
          job.result = {
            cost_usd: event.cost_usd || 0,
            num_turns: event.num_turns || 0,
            max_turns: 30,
            session_id: event.session_id || "",
            summary:
              typeof event.result === "string"
                ? event.result
                : "Import completed",
          };
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
  });

  proc.on("close", (code) => {
    if (code !== 0 && job.status !== "completed") {
      job.status = "failed";
      job.error = stderrBuffer || `Process exited with code ${code}`;
    } else if (job.status === "running") {
      job.status = "completed";
    }
    job.process = null;
  });

  proc.on("error", (err) => {
    job.status = "failed";
    job.error = err.message;
    job.process = null;
  });
}

export async function POST(request: NextRequest) {
  pruneJobs();

  try {
    const formData = await request.formData();
    const url = (formData.get("url") as string) || "";
    const notes = (formData.get("notes") as string) || "";
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required" },
        { status: 400 }
      );
    }

    // Ensure inbox exists
    await mkdir(INBOX_DIR, { recursive: true });

    // Save files to inbox
    const savedFiles: string[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(INBOX_DIR, file.name);
      await writeFile(filePath, buffer);
      savedFiles.push(file.name);
    }

    // Create job
    const job: ImportJob = {
      id: randomUUID(),
      status: "uploading",
      events: [],
      result: null,
      error: null,
      process: null,
      files: savedFiles,
      url,
      notes,
      createdAt: Date.now(),
    };

    jobs.set(job.id, job);

    // Start the agent
    startInventoryAgent(job);

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Export jobs map for the status route
export { jobs };
