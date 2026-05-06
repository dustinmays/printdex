import { NextResponse } from "next/server";

// Instead of chokidar (which adds a second FSEvents watcher on top of
// Turbopack's built-in one), we use a lightweight polling approach.
// The client hits this endpoint periodically; we return the current
// timestamp so the client can decide whether to refetch.

export async function GET() {
  return NextResponse.json({ ts: Date.now() });
}
