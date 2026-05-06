@AGENTS.md

# PrintDex

Next.js 16 app for browsing/previewing 3D print files (STL, 3MF).

## Key Architecture

- `src/lib/config.ts` — **canonical config loader**. All API routes get the files directory from `getConfig().baseDir`. Never hardcode paths.
- `config.yaml` — user's local config (gitignored). `config.example.yaml` is the template.
- `prints.yaml` — per-folder metadata files in the user's print files directory (not in this repo).
- `.claude/agents/inventory.md` — agent for AI-powered import. Spawned by `/api/import`.
- `.claude/agents/onboarding.md` — interactive setup agent. Run via `npm run setup`.

## Conventions

- API routes are in `src/app/api/`. All use `getConfig()` from `@/lib/config` for the base directory.
- 3D rendering uses Three.js via React Three Fiber. Thumbnails render once to static PNG (no persistent WebGL).
- The import feature is optional — gracefully degrades when Claude Code CLI is not installed.
