import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getConfig } from "@/lib/config";

interface TreeNode {
  name: string;
  relativePath: string;
  children: TreeNode[];
}

function buildTree(dirPath: string, baseDir: string, excludes: Set<string>): TreeNode[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !excludes.has(entry.name)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      return {
        name: entry.name,
        relativePath,
        children: buildTree(fullPath, baseDir, excludes),
      };
    });
}

export async function GET() {
  const config = getConfig();
  const excludes = new Set(config.excludeDirs);
  const tree = buildTree(config.baseDir, config.baseDir, excludes);
  return NextResponse.json(tree);
}
