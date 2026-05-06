# Import Feature Spec — 3D Print File Viewer

## Overview

The viewer app needs an "Import" feature that lets users add new 3D print files to their collection. It uses a background Claude Code agent to fetch metadata from source URLs and create organized `prints.yaml` files.

## User Flow

1. User clicks **"Import"** button in the app
2. A modal opens with three inputs:
   - **File(s)** — file picker or drag-and-drop zone for STL/3MF/STEP/ZIP files
   - **Source URL** — text input for the Printables/MakerWorld/Thangs page URL
   - **Notes to Claude** — optional textarea for special instructions (e.g. "put this in gridfinity", "I want to print 3 of these", "use PETG not PLA")
3. User clicks **"Start Import"**
4. App copies files to `inbox/` directory
5. App spawns a background Claude agent to process the import
6. Modal shows an **"Inventorying..."** status indicator with a spinner
7. When the agent finishes, the modal updates to show the result (files organized, metadata created)
8. The file browser refreshes to show the new items

## Backend Implementation

### API Route: `POST /api/import`

**Request:** multipart form data
- `files` — uploaded file(s)
- `url` — source URL string
- `notes` — optional user instructions string

**Steps:**
1. Save uploaded files to the `inbox/` directory
2. Build the Claude prompt (see below)
3. Spawn the Claude process
4. Return a job ID for status polling

### Spawning Claude

Use `claude --agent inventory` with the agent definition at `.claude/agents/inventory.md`.

```typescript
import { spawn } from 'child_process';

function startInventoryAgent(url: string, files: string[], notes: string): ChildProcess {
  const fileList = files.join(', ');
  
  const prompt = [
    `Process new files in the inbox: ${fileList}`,
    url ? `Source URL: ${url}` : '',
    notes ? `User notes: ${notes}` : '',
    'Fetch metadata from the source URL, organize files, and create prints.yaml.',
  ].filter(Boolean).join('\n');

  const proc = spawn('claude', [
    '--agent', 'inventory',
    '-p',
    '--output-format', 'stream-json',
    '--max-turns', '30',
    '--max-budget-usd', '1.00',
    '--allowedTools', 'Read,Write,Edit,Glob,Grep,WebFetch,Bash(mv:*),Bash(mkdir:*),Bash(unzip:*),Bash(rm:*),Bash(ls:*),Bash(diff:*)',
    '--', prompt,
  ], {
    cwd: getConfig().baseDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return proc;
}
```

**Important notes from real-world usage:**
- Each `claude -p` call has ~10 second startup overhead
- Use `--output-format stream-json` so the app can show progress in real-time
- The final event in the stream has `type: "result"` — parse it for completion status
- Check `num_turns` vs `--max-turns` (equality means it hit the limit without finishing)
- Check `permission_denials` array — non-empty means tools were denied
- Capture stderr separately for hard failures (non-zero exit code)
- On rate limit, save `session_id` from result and resume with `--resume <session-id>`

### API Route: `GET /api/import/status/:jobId`

**Response:**
```json
{
  "status": "running" | "completed" | "failed",
  "events": [...],        // stream-json events so far
  "result": {             // only when completed
    "folder": "gridfinity/nozzle-holder",
    "files_moved": ["nozzle-holder.stl"],
    "yaml_created": true,
    "cost_usd": 0.02,
    "num_turns": 5
  }
}
```

Alternatively, use Server-Sent Events (SSE) to stream progress to the frontend in real time instead of polling. Each `stream-json` line from Claude can be forwarded as an SSE event.

### Stream-JSON Events to Watch For

| Event type | What it means |
|------------|---------------|
| `system` (subtype: `init`) | Agent started, tools loaded |
| `assistant` with `tool_use` | Agent is calling a tool (show "Fetching metadata..." / "Moving files..." etc.) |
| `assistant` with `text` | Agent is thinking/reporting — can display as progress text |
| `result` | **Final event** — agent is done. Parse for cost, turns, errors |

### Deriving User-Friendly Status Messages

Parse the `assistant` events' tool calls to show contextual status:
- `WebFetch` → "Fetching print details from source..."
- `Bash(mkdir:*)` → "Creating folder..."
- `Bash(mv:*)` → "Organizing files..."
- `Write` (prints.yaml) → "Writing metadata..."
- `result` → "Done!"

## Frontend Implementation

### Import Modal Component

```
┌─────────────────────────────────────────┐
│  Import New Print                    ✕  │
│─────────────────────────────────────────│
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Drop files here or click to    │    │
│  │  browse                         │    │
│  │  .stl .3mf .step .zip          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Source URL                             │
│  ┌─────────────────────────────────┐    │
│  │ https://printables.com/model/...│    │
│  └─────────────────────────────────┘    │
│                                         │
│  Notes for Claude (optional)            │
│  ┌─────────────────────────────────┐    │
│  │ Put in gridfinity folder, I     │    │
│  │ want to print 2 of these...    │    │
│  └─────────────────────────────────┘    │
│                                         │
│          [Cancel]  [Start Import]       │
│─────────────────────────────────────────│
│  ● Inventorying...                      │
│    Fetching print details from source   │
└─────────────────────────────────────────┘
```

### Status States

1. **Idle** — modal just opened, waiting for user input
2. **Uploading** — files being copied to inbox
3. **Inventorying** — Claude agent is running. Show spinner + latest status message derived from stream events
4. **Complete** — show summary (folder created, files organized). Auto-refresh file browser. Button to "View files"
5. **Failed** — show error message + option to retry

## prints.yaml Schema Reference

The agent creates these files. The app should parse and display them.

```yaml
- name: string                    # human-readable name
  author: string                  # creator name
  source: string                  # URL to source page
  description: string             # what it is / what it's for
  files:                          # list of files in this folder
    - filename.stl
  material: string | null         # PLA, PETG, PET, ABS, etc.
  nozzle: string | null           # 0.4mm, 0.6mm, etc.
  layer_height: string | null     # 0.2mm, 0.15mm, etc.
  infill: string | null           # 15%, Adaptive Cubic, etc.
  supports: boolean | null        # true/false
  print_time: string | null       # "5h 22m"
  estimated_weight: string | null # "50g"
  hardware:                       # required non-printed parts
    - string
  notes: string                   # special instructions
  tags: string[]                  # [gridfinity, measuring, kitchen]
  gridfinity_size: string | null  # 1x1, 2x3, etc.
  quantity: number | string       # 1, "1 each", etc.
  status: string                  # to_print | printing | printed | failed
```

## File Structure

```
printerfiles/
├── .claude/
│   └── agents/
│       └── inventory.md          ← agent definition
├── inbox/                        ← upload target, agent processes out of here
├── gridfinity/
│   ├── caliper-holder/
│   │   ├── caliper-holder.stl
│   │   └── prints.yaml
│   └── .../
├── tools/
├── household/
├── printer-accessories/
├── qidi-q2/
├── calibration-and-testing/
└── print-jobs/
```

## Edge Cases

- **No URL provided** — agent creates folder and moves files but YAML will have mostly null metadata fields. Still useful for organization.
- **ZIP files** — agent decompresses, organizes contents, deletes the zip.
- **Multiple files from same model** — grouped into one folder with one `prints.yaml` entry listing all files.
- **File already exists at destination** — agent should warn, not overwrite.
- **MakerWorld/Thangs URLs** — may return 403 on fetch. Agent does its best, fills in what it can.
- **Duplicate model IDs** — agent checks if a `prints.yaml` already references the same source URL before creating a new one.
