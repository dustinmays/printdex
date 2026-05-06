# PrintFile Viewer

A lightweight local web app for browsing and previewing 3D print files. Renders STL and 3MF models in the browser with Three.js, and indexes metadata from `prints.yaml` files for search and filtering.

## Quick Start

```bash
cd viewer
npm install
npm run build
npm start -- -p 3333
```

Open [http://localhost:3333](http://localhost:3333).

For development with hot reload:

```bash
npm run dev -- -p 3333
```

## Features

### File Browser
- Folder tree sidebar with expand/collapse navigation
- Grid view with 3D model thumbnails (rendered once as static images)
- List view with file sizes and dates
- Breadcrumb navigation with back button
- Click any STL/3MF file to open an interactive 3D preview panel with orbit controls

### Catalog
- Indexes all files across all subdirectories into a searchable list
- Full-text search across filenames, print names, descriptions, tags, authors, and notes
- Faceted filtering by material, nozzle size, layer height, status, tags, file type, and folder
- Inventory is cached at startup; refresh button to rescan
- Files with `prints.yaml` metadata show print specs; uncataloged files are labeled and excluded from metadata filters

### Import
- Upload STL/3MF/STEP/ZIP files with a source URL (Printables, MakerWorld, etc.)
- Spawns a background Claude agent that:
  - Moves files from `inbox/` to the correct category folder
  - Fetches metadata from the source URL
  - Creates `prints.yaml` with print specs, tags, and notes
- Runs asynchronously — modal closes immediately, status shows as a pill in the header
- Multiple concurrent imports supported

## Directory Structure

```
printerfiles/
├── .claude/agents/inventory.md   # Claude agent for import processing
├── inbox/                        # Upload target, agent processes files out
├── calibration-and-testing/
├── gridfinity/                   # Bins, holders, baseplates
├── household/                    # Home items
├── print-jobs/                   # Multi-model plate files
├── printer-accessories/          # Build plate holders, risers
├── qidi-q2/                      # Printer-specific parts
├── tools/                        # Measuring tools, gauges
└── viewer/                       # This app
```

## prints.yaml

Each folder can contain a `prints.yaml` file with metadata for its model files:

```yaml
- name: Gridfinity Caliper Holder
  author: The Next Layer
  source: https://www.printables.com/model/260633
  description: >
    Space-efficient caliper holder for Gridfinity.
  files:
    - caliper-holder.stl
  material: PLA
  nozzle: 0.4mm
  layer_height: 0.2mm
  infill: 15%
  supports: false
  print_time: "2h 30m"
  tags: [gridfinity, organization]
  status: to_print
```

Fields set to `~` (null) mean unspecified — the catalog treats these as "any" and excludes them from strict filter matching.

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `WATCH_DIR` | `../` (parent of viewer) | Root directory to browse |
| `PORT` | `3000` | Server port (override with `--port` or `-p`) |

## Tech Stack

- **Next.js 16** (App Router, production server)
- **Three.js** + React Three Fiber for 3D rendering
- **Tailwind CSS** for styling
- **Claude Code** agent for import processing
