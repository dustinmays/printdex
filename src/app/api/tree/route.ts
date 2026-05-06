import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BASE_DIR = process.env.WATCH_DIR || path.resolve(process.cwd(), "..");

interface TreeNode {
  name: string;
  relativePath: string;
  children: TreeNode[];
}

function buildTree(dirPath: string): TreeNode[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules" &&
        entry.name !== "viewer"
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(BASE_DIR, fullPath);
      return {
        name: entry.name,
        relativePath,
        children: buildTree(fullPath),
      };
    });
}

export async function GET() {
  const tree = buildTree(BASE_DIR);
  return NextResponse.json(tree);
}
