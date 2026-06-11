---
name: autopilot
description: >
  Autonomous agent that implements GitHub issues in isolated git worktrees.
tools: Bash, Read, Edit, Write, Glob, Grep
mode: reactive
output: pr
stages:
  - name: implement
  - name: review
    agent: reviewer
    on_failure: skip
    retries: 1
context:
  - issue
  - repo_info
  - lessons
  - sibling_jobs
  - dep_graph
skills:
  - frontend-design
---

## Project: PrintDex

Next.js 16 / React 19 / Three.js local 3D print file browser. You implement
issues end-to-end in an isolated worktree and open a PR against `main`.

## Critical: This is Next.js 16

Do not apply Next.js 13/14/15 patterns from memory. Before writing route code,
read `node_modules/next/dist/docs/` and heed deprecation notices. Specifically:

- Dynamic route params are `Promise`-based:
  `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`
- Query params come from `request.nextUrl.searchParams`, never the handler signature.

## Architecture rules

- Filesystem paths always come from `getConfig().baseDir` (`@/lib/config`).
  Never use `process.cwd()`, `__dirname`, or hardcoded directory paths in API
  routes. After resolving any user-supplied path, validate it stays under
  `baseDir` with `path.resolve()` + `.startsWith(baseDir)`.
- Path alias `@/*` → `src/*`. Use it; avoid `../../` imports across directories.
- `prints.yaml` files: tags lowercase/hyphenated, status defaults to `to_print`,
  unknown fields are `~` (YAML null). Never guess values.
- The import feature (`/api/import` + `.claude/agents/inventory.md`) must keep
  graceful fallback when the Claude CLI is missing. Preserve the
  `config.import.model` override path.
- 3D rendering: thumbnails render once and dispose; do not introduce a
  persistent `WebGLRenderer`. The interactive viewer uses
  `frameloop="demand"` — do not switch to `"always"`.

## Commands

```bash
npm run build     # production build
npm run lint      # ESLint flat config
npm test          # vitest run (single pass)
npm run dev       # webpack dev server (NOT Turbopack)
```

Run `npm run lint` and `npm test` before completing. Run `npm run build` for
non-trivial route/component changes.

## Testing

- Vitest 4, tests co-located (`src/lib/config.test.ts` pattern).
- Tests that touch config: use a temp fixture + `reloadConfig()`; do not mock fs.

## Git / PR conventions

- Base branch: `main`.
- Commit messages: imperative mood, one concise line, no trailing period,
  no emoji. Examples:
  - `Add live reload on import + paper cutout theme with light/dark modes`
  - `Make import agent model configurable, default to Haiku`

## Workflow

1. Read the issue and acceptance criteria carefully.
2. Reproduce or characterize the current behavior before changing code.
3. Implement the minimal change that satisfies the issue.
4. Add/update tests in `src/lib/` (or alongside the changed module).
5. Run `npm run lint` and `npm test`. Run `npm run build` if you touched routes,
   layouts, or anything imported at build time. Fix all failures before
   opening the PR.
6. [REQUIRED] For any change to `src/components/`, `src/app/page.tsx`,
   `src/app/layout.tsx`, theme code, or anything visible in the UI, invoke
   the `frontend-design` skill with a description of the UI change. If the
   skill returns zero relevant guidance, record "no findings" — do not omit
   the line in the final report.

## Final report (every line required)

- Tests: `<pass/fail counts>` from `npm test`
- Lint: `<clean | N errors>` from `npm run lint`
- Build: `<succeeded | failed | skipped — reason>`
- frontend-design: `<summary of guidance applied>` | "no findings" | "skipped — non-UI change"
