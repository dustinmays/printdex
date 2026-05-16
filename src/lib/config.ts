import fs from "fs";
import path from "path";
import os from "os";
import YAML from "yaml";

interface PrinterConfig {
  name: string;
  nozzle_sizes: number[];
  bed_size: [number, number, number];
  heated_bed?: boolean;
  enclosure?: boolean;
}

interface DefaultsConfig {
  material?: string;
  nozzle?: string;
  layer_height?: string;
}

interface ImportConfig {
  enabled: boolean;
  max_budget_usd: number;
  max_turns: number;
  model?: string;
}

interface RawConfig {
  watch_dir: string;
  exclude_dirs?: string[];
  printers?: PrinterConfig[];
  defaults?: DefaultsConfig;
  import?: Partial<ImportConfig>;
}

export interface PrintDexConfig {
  baseDir: string;
  excludeDirs: string[];
  printers: PrinterConfig[];
  defaults: DefaultsConfig;
  import: ImportConfig;
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function resolveConfigPath(): string | null {
  // Check env override first
  const envPath = process.env.PRINTDEX_CONFIG;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // Check project root
  const rootConfig = path.join(process.cwd(), "config.yaml");
  if (fs.existsSync(rootConfig)) return rootConfig;

  return null;
}

function loadConfig(): PrintDexConfig {
  const configPath = resolveConfigPath();

  if (configPath) {
    const raw = YAML.parse(fs.readFileSync(configPath, "utf-8")) as RawConfig;

    if (!raw.watch_dir) {
      throw new Error(
        "config.yaml is missing 'watch_dir'. Set it to the path of your 3D print files directory."
      );
    }

    const resolved = expandHome(raw.watch_dir);
    const baseDir = path.isAbsolute(resolved)
      ? resolved
      : path.resolve(path.dirname(configPath), resolved);

    if (!fs.existsSync(baseDir)) {
      throw new Error(
        `watch_dir "${raw.watch_dir}" resolves to "${baseDir}" which does not exist. Check your config.yaml.`
      );
    }

    return {
      baseDir,
      excludeDirs: raw.exclude_dirs || [".git", "node_modules"],
      printers: raw.printers || [],
      defaults: raw.defaults || {},
      import: {
        enabled: raw.import?.enabled ?? true,
        max_budget_usd: raw.import?.max_budget_usd ?? 1.0,
        max_turns: raw.import?.max_turns ?? 30,
        model: raw.import?.model,
      },
    };
  }

  // Fallback: WATCH_DIR env var (backward compat)
  const watchDir = process.env.WATCH_DIR;
  if (watchDir) {
    const resolved = expandHome(watchDir);
    const baseDir = path.isAbsolute(resolved)
      ? resolved
      : path.resolve(process.cwd(), resolved);

    return {
      baseDir,
      excludeDirs: [".git", "node_modules"],
      printers: [],
      defaults: {},
      import: { enabled: true, max_budget_usd: 1.0, max_turns: 30 },
    };
  }

  throw new Error(
    [
      "PrintDex is not configured.",
      "",
      "To get started, either:",
      "  1. Run: claude --agent onboarding",
      "  2. Copy config.example.yaml to config.yaml and edit it",
      "  3. Set the WATCH_DIR environment variable",
    ].join("\n")
  );
}

// Cached singleton
let _config: PrintDexConfig | null = null;

export function getConfig(): PrintDexConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

// For testing or hot-reload: force re-read
export function reloadConfig(): PrintDexConfig {
  _config = null;
  return getConfig();
}
