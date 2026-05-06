import { NextResponse } from "next/server";
import { readFile, readdir, stat as fsStat } from "fs/promises";
import path from "path";
import YAML from "yaml";

const BASE_DIR = process.env.WATCH_DIR || path.resolve(process.cwd(), "..");

const PREVIEWABLE = new Set([".stl", ".obj", ".3mf", ".step", ".stp"]);
const SKIP = new Set([".", "..", "node_modules", "viewer", ".git", ".DS_Store"]);

interface PrintEntry {
  name?: string;
  author?: string;
  source?: string;
  description?: string;
  files?: string[];
  material?: string;
  nozzle?: string;
  layer_height?: string;
  infill?: string;
  supports?: boolean | string;
  print_time?: string;
  hardware?: string | string[];
  notes?: string;
  tags?: string[];
  gridfinity_size?: string;
  quantity?: string | number;
  status?: string;
  estimated_weight?: string;
}

export interface CatalogItem {
  fileName: string;
  relativePath: string;
  dirPath: string;
  extension: string;
  size: number;
  modified: string;
  hasMeta: boolean;
  printName: string | null;
  author: string | null;
  source: string | null;
  description: string | null;
  material: string | null;
  nozzle: string | null;
  layerHeight: string | null;
  infill: string | null;
  supports: string | null;
  printTime: string | null;
  tags: string[];
  status: string | null;
  notes: string | null;
  gridfinitySize: string | null;
}

interface CatalogCache {
  items: CatalogItem[];
  facets: Facets;
  builtAt: number;
}

interface Facets {
  material: string[];
  nozzle: string[];
  layerHeight: string[];
  status: string[];
  tags: string[];
  extension: string[];
  folders: string[];
}

function norm(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "" || s === "~") return null;
  return s;
}

async function scanDir(
  dirPath: string,
  catalog: CatalogItem[],
  printEntries: Map<string, { entry: PrintEntry; yamlDir: string }>
) {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const yamlPath = path.join(dirPath, "prints.yaml");
  try {
    const content = await readFile(yamlPath, "utf-8");
    const parsed = YAML.parse(content) as PrintEntry[];
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry.files) {
          for (const file of entry.files) {
            const fullFilePath = path.resolve(dirPath, file);
            const relPath = path.relative(BASE_DIR, fullFilePath);
            printEntries.set(relPath, { entry, yamlDir: path.relative(BASE_DIR, dirPath) });
          }
        }
      }
    }
  } catch {
    // No prints.yaml or parse error
  }

  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await scanDir(fullPath, catalog, printEntries);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!PREVIEWABLE.has(ext)) continue;

    const fileStat = await fsStat(fullPath).catch(() => null);
    if (!fileStat) continue;

    catalog.push({
      fileName: entry.name,
      relativePath: path.relative(BASE_DIR, fullPath),
      dirPath: path.relative(BASE_DIR, dirPath),
      extension: ext,
      size: fileStat.size,
      modified: fileStat.mtime.toISOString(),
      hasMeta: false,
      printName: null,
      author: null,
      source: null,
      description: null,
      material: null,
      nozzle: null,
      layerHeight: null,
      infill: null,
      supports: null,
      printTime: null,
      tags: [],
      status: null,
      notes: null,
      gridfinitySize: null,
    });
  }
}

async function buildCatalog(): Promise<CatalogCache> {
  const catalog: CatalogItem[] = [];
  const printEntries = new Map<string, { entry: PrintEntry; yamlDir: string }>();

  await scanDir(BASE_DIR, catalog, printEntries);

  for (const item of catalog) {
    const match = printEntries.get(item.relativePath);
    if (match) {
      const e = match.entry;
      item.hasMeta = true;
      item.printName = norm(e.name);
      item.author = norm(e.author);
      item.source = norm(e.source);
      item.description = norm(e.description);
      item.material = norm(e.material);
      item.nozzle = norm(e.nozzle);
      item.layerHeight = norm(e.layer_height);
      item.infill = norm(e.infill);
      item.supports = norm(e.supports);
      item.printTime = norm(e.print_time);
      item.tags = Array.isArray(e.tags) ? e.tags : [];
      item.status = norm(e.status);
      item.notes = norm(e.notes);
      item.gridfinitySize = norm(e.gridfinity_size);
    }
  }

  const facets: Facets = {
    material: [...new Set(catalog.map((i) => i.material).filter(Boolean))] as string[],
    nozzle: [...new Set(catalog.map((i) => i.nozzle).filter(Boolean))] as string[],
    layerHeight: [...new Set(catalog.map((i) => i.layerHeight).filter(Boolean))] as string[],
    status: [...new Set(catalog.map((i) => i.status).filter(Boolean))] as string[],
    tags: [...new Set(catalog.flatMap((i) => i.tags))].sort(),
    extension: [...new Set(catalog.map((i) => i.extension))].sort(),
    folders: [...new Set(catalog.map((i) => i.dirPath))].sort(),
  };

  return { items: catalog, facets, builtAt: Date.now() };
}

// Singleton cache — built on first request, refreshed via POST
let cache: CatalogCache | null = null;
let building = false;

async function getCache(): Promise<CatalogCache> {
  if (!cache && !building) {
    building = true;
    cache = await buildCatalog();
    building = false;
  }
  // If another request is building, wait
  while (building) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return cache!;
}

export async function GET() {
  try {
    const data = await getCache();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/catalog — rebuild the cache
export async function POST() {
  try {
    building = true;
    cache = await buildCatalog();
    building = false;
    return NextResponse.json({ ok: true, itemCount: cache.items.length, builtAt: cache.builtAt });
  } catch (error) {
    building = false;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
