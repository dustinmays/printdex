import { NextRequest, NextResponse } from "next/server";
import { readFile, stat as fsStat } from "fs/promises";
import path from "path";
import YAML from "yaml";
import { getConfig } from "@/lib/config";

export interface PrintEntry {
  name: string;
  author?: string;
  source?: string;
  description?: string;
  files: string[];
  material?: string;
  nozzle?: string;
  layer_height?: string;
  infill?: string;
  supports?: boolean | string;
  print_time?: string;
  hardware?: string;
  notes?: string;
  status?: string;
}

async function findPrintsYaml(dirPath: string): Promise<PrintEntry[] | null> {
  const yamlPath = path.join(dirPath, "prints.yaml");
  const fileStat = await fsStat(yamlPath).catch(() => null);
  if (!fileStat) return null;

  const content = await readFile(yamlPath, "utf-8");
  return YAML.parse(content) as PrintEntry[];
}

// GET /api/prints?file=relative/path/to/file.stl
// Returns the prints.yaml entry that references this file, if any.
// Also accepts ?dir=relative/dir to get all entries for a directory.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("file");
    const dirPath = searchParams.get("dir");

    if (filePath) {
      const fullPath = path.resolve(getConfig().baseDir, filePath);
      if (!fullPath.startsWith(getConfig().baseDir)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const dir = path.dirname(fullPath);
      const fileName = path.basename(fullPath);

      // Check current dir and parent for prints.yaml
      for (const searchDir of [dir, path.dirname(dir)]) {
        const entries = await findPrintsYaml(searchDir);
        if (!entries) continue;

        const relativeFromYamlDir = path.relative(searchDir, fullPath);
        const match = entries.find(
          (entry) =>
            entry.files?.includes(fileName) ||
            entry.files?.includes(relativeFromYamlDir)
        );
        if (match) {
          return NextResponse.json({ entry: match, yamlDir: path.relative(getConfig().baseDir, searchDir) });
        }
      }

      return NextResponse.json({ entry: null });
    }

    if (dirPath) {
      const fullDir = path.resolve(getConfig().baseDir, dirPath);
      if (!fullDir.startsWith(getConfig().baseDir)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const entries = await findPrintsYaml(fullDir);
      return NextResponse.json({ entries: entries || [] });
    }

    return NextResponse.json({ error: "Provide ?file= or ?dir= parameter" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
