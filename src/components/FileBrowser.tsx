"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import FileIcon from "./FileIcon";
import CatalogView from "./CatalogView";
import ImportModal from "./ImportModal";
import { useImportJobs, ImportJobPills } from "./ImportJobTracker";
import { ThemeToggle } from "./ThemeToggle";

const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });
const ModelThumbnail = dynamic(() => import("./ModelThumbnail"), { ssr: false });

const PREVIEWABLE_EXTENSIONS = new Set([".stl", ".3mf"]);

interface FileEntry {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  extension: string;
  isPreviewable: boolean;
}

interface TreeNode {
  name: string;
  relativePath: string;
  children: TreeNode[];
}

interface PrintMeta {
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fileUrl(relativePath: string) {
  return `/api/file/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function canPreview(file: FileEntry) {
  return PREVIEWABLE_EXTENSIONS.has(file.extension);
}

function parentDir(relativePath: string): string {
  const parts = relativePath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

/* ── Folder Tree ── */

function TreeItem({
  node,
  currentDir,
  onNavigate,
  depth,
}: {
  node: TreeNode;
  currentDir: string;
  onNavigate: (dir: string) => void;
  depth: number;
}) {
  const isActive = currentDir === node.relativePath;
  const isParent = currentDir.startsWith(node.relativePath + "/");
  const [expanded, setExpanded] = useState(isActive || isParent);

  useEffect(() => {
    if (isActive || isParent) setExpanded(true);
  }, [isActive, isParent]);

  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          onNavigate(node.relativePath);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={`w-full text-left flex items-center gap-1 py-1 px-2 text-sm rounded transition-colors ${
          isActive
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="text-[10px] w-3 flex-shrink-0">
          {hasChildren ? (expanded ? "▼" : "▶") : ""}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.relativePath}
              node={child}
              currentDir={currentDir}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderTree({
  currentDir,
  onNavigate,
  refreshKey,
}: {
  currentDir: string;
  onNavigate: (dir: string) => void;
  refreshKey: number;
}) {
  const [tree, setTree] = useState<TreeNode[]>([]);

  useEffect(() => {
    fetch("/api/tree")
      .then((r) => r.json())
      .then(setTree)
      .catch(console.error);
  }, [refreshKey]);

  return (
    <div className="w-56 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
      <div className="p-2">
        <button
          onClick={() => onNavigate("")}
          className={`w-full text-left flex items-center gap-1.5 py-1.5 px-2 text-sm rounded transition-colors ${
            currentDir === ""
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <span>📁</span>
          <span className="font-medium">All Files</span>
        </button>
        <div className="mt-1">
          {tree.map((node) => (
            <TreeItem
              key={node.relativePath}
              node={node}
              currentDir={currentDir}
              onNavigate={onNavigate}
              depth={0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Breadcrumbs ── */

function Breadcrumbs({
  currentDir,
  onNavigate,
}: {
  currentDir: string;
  onNavigate: (dir: string) => void;
}) {
  const parts = currentDir ? currentDir.split("/") : [];
  const parent =
    parts.length > 1 ? parts.slice(0, -1).join("/") : parts.length === 1 ? "" : null;

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground px-4 py-2 bg-card/50 border-b border-border/50">
      {parent !== null && (
        <button
          onClick={() => onNavigate(parent)}
          className="hover:text-foreground transition-colors mr-2 px-1.5 py-0.5 rounded hover:bg-muted"
          title="Go back"
        >
          ←
        </button>
      )}
      <button
        onClick={() => onNavigate("")}
        className="hover:text-foreground transition-colors"
      >
        ~
      </button>
      {parts.map((part, i) => {
        const pathTo = parts.slice(0, i + 1).join("/");
        return (
          <span key={pathTo} className="flex items-center gap-1">
            <span className="text-muted-foreground">/</span>
            <button
              onClick={() => onNavigate(pathTo)}
              className="hover:text-foreground transition-colors"
            >
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}

/* ── Status badge ── */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    to_print: "bg-warning/20 text-warning",
    printing: "bg-primary/20 text-primary",
    printed: "bg-success/20 text-success",
    failed: "bg-error/20 text-error",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[status] || "bg-muted text-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── Print Metadata Panel ── */

function PrintMetaPanel({ meta }: { meta: PrintMeta }) {
  const fields = [
    { label: "Material", value: meta.material },
    { label: "Nozzle", value: meta.nozzle },
    { label: "Layer Height", value: meta.layer_height },
    { label: "Infill", value: meta.infill },
    { label: "Supports", value: meta.supports != null ? String(meta.supports) : undefined },
    { label: "Print Time", value: meta.print_time },
    { label: "Hardware", value: meta.hardware },
  ].filter((f) => f.value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium text-foreground">{meta.name}</h3>
        {meta.status && <StatusBadge status={meta.status} />}
      </div>
      {meta.author && (
        <p className="text-[11px] text-muted-foreground">by {meta.author}</p>
      )}
      {meta.description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{meta.description}</p>
      )}
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {fields.map((f) => (
            <div key={f.label} className="text-[11px]">
              <span className="text-muted-foreground">{f.label}: </span>
              <span className="text-foreground">{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {meta.notes && (
        <p className="text-[11px] text-muted-foreground italic leading-relaxed">{meta.notes}</p>
      )}
      {meta.source && (
        <a
          href={meta.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-primary hover:text-primary underline"
        >
          View on source
        </a>
      )}
    </div>
  );
}

/* ── Preview Panel ── */

function PreviewPanel({
  file,
  onClose,
  onNavigate,
}: {
  file: FileEntry;
  onClose: () => void;
  onNavigate: (dir: string) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(true);
  const [printMeta, setPrintMeta] = useState<PrintMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  useEffect(() => {
    setMetaLoading(true);
    setPrintMeta(null);
    fetch(`/api/prints?file=${encodeURIComponent(file.relativePath)}`)
      .then((r) => r.json())
      .then((data) => setPrintMeta(data.entry || null))
      .catch(console.error)
      .finally(() => setMetaLoading(false));
  }, [file.relativePath]);

  const folderPath = parentDir(file.relativePath);

  return (
    <div className="w-1/2 border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border">
        <div className="min-w-0">
          <h2 className="font-medium text-sm truncate">{file.name}</h2>
          <p className="text-xs text-muted-foreground">
            {formatSize(file.size)} &middot; {formatDate(file.modified)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg flex-shrink-0 ml-2"
        >
          ✕
        </button>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 min-h-0">
        <ModelViewer
          url={fileUrl(file.relativePath)}
          extension={file.extension}
          className="w-full h-full"
        />
      </div>

      {/* Actions & Metadata drawer */}
      <div className="border-t border-border bg-background">
        <button
          onClick={() => setActionsOpen(!actionsOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="font-medium">Details & Actions</span>
          <span>{actionsOpen ? "▼" : "▶"}</span>
        </button>

        {actionsOpen && (
          <div className="px-4 pb-3 space-y-3">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate(folderPath)}
                className="text-[11px] px-2.5 py-1 rounded bg-card text-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Open folder
              </button>
              <a
                href={fileUrl(file.relativePath)}
                download={file.name}
                className="text-[11px] px-2.5 py-1 rounded bg-card text-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Download
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(file.relativePath);
                }}
                className="text-[11px] px-2.5 py-1 rounded bg-card text-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Copy path
              </button>
            </div>

            {/* File metadata */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div>
                <span className="text-muted-foreground">Location: </span>
                <button
                  onClick={() => onNavigate(folderPath)}
                  className="text-primary hover:text-primary"
                >
                  {folderPath || "/"}
                </button>
              </div>
              <div>
                <span className="text-muted-foreground">Type: </span>
                <span className="text-foreground">{file.extension.toUpperCase().slice(1)}</span>
              </div>
            </div>

            {/* Print metadata from prints.yaml */}
            {metaLoading ? (
              <p className="text-[11px] text-muted-foreground">Loading print info...</p>
            ) : printMeta ? (
              <div className="border-t border-border pt-2">
                <PrintMetaPanel meta={printMeta} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main ── */

export default function FileBrowser() {
  const [mode, setMode] = useState<"browse" | "catalog">("browse");
  const [currentDir, setCurrentDir] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [importOpen, setImportOpen] = useState(false);
  const [catalogKey, setCatalogKey] = useState(0);
  const [treeKey, setTreeKey] = useState(0);

  const fetchFiles = useCallback(async (dir: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?dir=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.error) {
        console.error(data.error);
        return;
      }
      setFiles(data.files);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentDir);
  }, [currentDir, fetchFiles]);

  // Poll for file changes every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchFiles(currentDir), 30000);
    return () => clearInterval(interval);
  }, [currentDir, fetchFiles]);

  const handleImportComplete = useCallback(() => {
    fetchFiles(currentDir);
    setCatalogKey((k) => k + 1);
    setTreeKey((k) => k + 1);
    fetch("/api/catalog", { method: "POST" }).catch(() => {});
  }, [currentDir, fetchFiles]);

  const { jobs: importJobs, submitImport, dismissJob } = useImportJobs(handleImportComplete);

  const navigate = useCallback((dir: string) => {
    setCurrentDir(dir);
    setSelectedFile(null);
    setMode("browse");
  }, []);

  const handleClick = (file: FileEntry) => {
    if (file.isDirectory) {
      navigate(file.relativePath);
    } else if (canPreview(file)) {
      setSelectedFile(
        selectedFile?.relativePath === file.relativePath ? null : file
      );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">
            PrintDex
          </h1>
          <div className="flex items-center gap-1 bg-card rounded p-0.5">
            <button
              onClick={() => setMode("browse")}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                mode === "browse"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setMode("catalog")}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                mode === "catalog"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Catalog
            </button>
          </div>
        </div>
        {mode === "browse" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`px-2 py-1 rounded text-sm ${
                viewMode === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2 py-1 rounded text-sm ${
                viewMode === "grid"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ⊞ Grid
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <ImportJobPills jobs={importJobs} onDismiss={dismissJob} />
          <button
            onClick={() => setImportOpen(true)}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary-hover transition-colors"
          >
            + Import
          </button>
          <ThemeToggle />
        </div>
      </header>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSubmit={submitImport}
      />

      {mode === "catalog" ? (
        <CatalogView key={catalogKey} onNavigate={navigate} />
      ) : (
        <>
      {/* Breadcrumbs */}
      <Breadcrumbs currentDir={currentDir} onNavigate={navigate} />

      {/* Body: sidebar + content + preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Folder tree sidebar */}
        <FolderTree currentDir={currentDir} onNavigate={navigate} refreshKey={treeKey} />

        {/* File list / grid */}
        <div
          className={`flex-1 overflow-y-auto ${
            selectedFile ? "w-1/2" : "w-full"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Empty directory
            </div>
          ) : viewMode === "list" ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium w-24">Size</th>
                  <th className="px-4 py-2 font-medium w-32">Modified</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.relativePath}
                    onClick={() => handleClick(file)}
                    className={`cursor-pointer border-b border-border/50 transition-colors ${
                      selectedFile?.relativePath === file.relativePath
                        ? "bg-primary/20"
                        : "hover:bg-card/50"
                    } ${file.isDirectory ? "font-medium" : ""}`}
                  >
                    <td className="px-4 py-2 flex items-center gap-2">
                      <FileIcon
                        extension={file.extension}
                        isDirectory={file.isDirectory}
                      />
                      <span className="truncate">{file.name}</span>
                      {canPreview(file) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                          3D
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {file.isDirectory ? "—" : formatSize(file.size)}
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {formatDate(file.modified)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
              {files.map((file) => (
                <div
                  key={file.relativePath}
                  onClick={() => handleClick(file)}
                  className={`group cursor-pointer rounded-lg border transition-all ${
                    selectedFile?.relativePath === file.relativePath
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border bg-card"
                  }`}
                >
                  <div className="aspect-square flex items-center justify-center bg-card rounded-t-lg overflow-hidden">
                    {canPreview(file) ? (
                      <ModelThumbnail
                        url={fileUrl(file.relativePath)}
                        extension={file.extension}
                        className="w-full h-full"
                      />
                    ) : (
                      <span className="text-4xl opacity-40">
                        {file.isDirectory ? "📁" : "📄"}
                      </span>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="text-xs truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {file.isDirectory ? "Folder" : formatSize(file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview panel */}
        {selectedFile && canPreview(selectedFile) && (
          <PreviewPanel
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onNavigate={navigate}
          />
        )}
      </div>
        </>
      )}
    </div>
  );
}
