# PrintDex

A local web app for browsing, previewing, and organizing 3D print files. Renders STL and 3MF models in the browser, indexes metadata from `prints.yaml` files, and optionally uses AI to catalog new downloads.

## Getting Started

```bash
git clone https://github.com/your-username/printdex.git
cd printdex
npm install
```

### Option A: Guided setup (requires [Claude Code](https://claude.ai/code))

```bash
npm run setup
```

This runs an interactive agent that asks about your files directory, printer, and preferences, then generates `config.yaml` for you.

### Option B: Manual setup

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml` and set `watch_dir` to the path of your 3D print files:

```yaml
watch_dir: ~/my-3d-prints
```

### Run

```bash
npm run build
npm start -- -p 3333
```

Open [http://localhost:3333](http://localhost:3333). For development: `npm run dev -- -p 3333`

## Features

### Browse
- Folder tree sidebar with expand/collapse navigation
- Grid view with 3D model thumbnails (rendered as static snapshots — zero GPU cost at idle)
- List view with file sizes and dates
- Click any STL/3MF file for an interactive 3D preview with orbit controls

### Catalog
- Indexes all files across all subdirectories into a searchable list
- Full-text search across filenames, print names, descriptions, tags, and authors
- Faceted filtering by material, nozzle, layer height, status, tags, file type, and folder
- Cached inventory with manual refresh

### Import (optional, requires Claude Code CLI)
- Upload files with a source URL (Printables, MakerWorld, etc.)
- A background AI agent moves files into the right folder, fetches metadata from the source page, and creates `prints.yaml`
- Runs asynchronously — status shows as a pill in the header
- Multiple concurrent imports supported
- Disable in `config.yaml` with `import.enabled: false`

## Configuration

PrintDex is configured via `config.yaml` in the project root:

```yaml
# Path to your 3D print files (absolute or relative, ~ supported)
watch_dir: ~/3d-prints

# Directories to exclude from listings
exclude_dirs: [.git, node_modules]

# Your printer(s)
printers:
  - name: Bambu Lab P1S
    nozzle_sizes: [0.4, 0.6]
    bed_size: [256, 256, 256]
    heated_bed: true
    enclosure: true

# Default print settings
defaults:
  material: PLA
  nozzle: 0.4mm
  layer_height: 0.2mm

# Import agent settings
import:
  enabled: true         # Set false if you don't have Claude Code
  max_budget_usd: 1.00  # Cost cap per import
  max_turns: 30          # Step limit per import
```

Printer info and defaults are passed to the import agent for smarter metadata decisions.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `WATCH_DIR` | Override files directory (fallback if no config.yaml) |
| `PRINTDEX_CONFIG` | Override config file path |
| `PORT` | Server port (or use `--port` / `-p` flag) |

## prints.yaml

Each folder in your files directory can contain a `prints.yaml` with metadata:

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

Fields set to `~` (null) mean unspecified. The catalog excludes uncataloged files from metadata-based filters.

## Tech Stack

- **Next.js 16** — App Router, production server
- **Three.js** + React Three Fiber — 3D rendering
- **Tailwind CSS v4** — styling
- **Claude Code** — optional, powers the import agent and onboarding

## License

MIT
