import { NextRequest, NextResponse } from "next/server";
import { readFile, stat as fsStat } from "fs/promises";
import path from "path";

const BASE_DIR = process.env.WATCH_DIR || path.resolve(process.cwd(), "..");

const CONTENT_TYPES: Record<string, string> = {
  ".stl": "application/octet-stream",
  ".obj": "text/plain",
  ".3mf": "application/zip",
  ".step": "application/octet-stream",
  ".stp": "application/octet-stream",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filepath: string[] }> }
) {
  try {
    const { filepath } = await params;
    const relativePath = filepath.map(decodeURIComponent).join("/");
    const fullPath = path.resolve(BASE_DIR, relativePath);

    if (!fullPath.startsWith(BASE_DIR)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const fileStat = await fsStat(fullPath).catch(() => null);
    if (!fileStat || fileStat.isDirectory()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const buffer = await readFile(fullPath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        "Content-Length": fileStat.size.toString(),
        "Content-Disposition": `inline; filename="${path.basename(fullPath)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
