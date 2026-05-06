import { NextRequest, NextResponse } from "next/server";
import { jobs } from "../../route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs.get(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    files: job.files,
    url: job.url,
    events: job.events,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
  });
}
