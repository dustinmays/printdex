import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BASE_DIR = process.env.WATCH_DIR || path.resolve(process.cwd(), "..");

const SUPPORTED_EXTENSIONS = new Set([".stl", ".obj", ".3mf", ".step", ".stp"]);

interface FileEntry {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  extension: string;
  isPreviewable: boolean;
}

function getFilesInDirectory(dirPath: string): FileEntry[] {
  const resolvedPath = path.resolve(BASE_DIR, dirPath);

  // Prevent path traversal
  if (!resolvedPath.startsWith(BASE_DIR)) {
    throw new Error("Access denied");
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error("Directory not found");
  }

  const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

  return entries
    .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "viewer")
    .map((entry) => {
      const fullPath = path.join(resolvedPath, entry.name);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(entry.name).toLowerCase();
      const relativePath = path.relative(BASE_DIR, fullPath);

      return {
        name: entry.name,
        path: fullPath,
        relativePath,
        isDirectory: entry.isDirectory(),
        size: stat.size,
        modified: stat.mtime.toISOString(),
        extension: ext,
        isPreviewable: SUPPORTED_EXTENSIONS.has(ext),
      };
    })
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dir = searchParams.get("dir") || "";

    const files = getFilesInDirectory(dir);

    return NextResponse.json({
      baseDir: BASE_DIR,
      currentDir: dir,
      files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
