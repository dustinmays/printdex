"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";

const ModelThumbnail = dynamic(() => import("./ModelThumbnail"), { ssr: false });
const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });

interface CatalogItem {
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

interface Facets {
  material: string[];
  nozzle: string[];
  layerHeight: string[];
  status: string[];
  tags: string[];
  extension: string[];
  folders: string[];
}

type FilterKey = keyof Facets;

// Metadata-based filter keys (these exclude uncataloged files when active)
const META_FILTER_KEYS: FilterKey[] = ["material", "nozzle", "layerHeight", "status", "tags"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileUrl(relativePath: string) {
  return `/api/file/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    to_print: "bg-yellow-900/50 text-yellow-300",
    printing: "bg-blue-900/50 text-blue-300",
    printed: "bg-green-900/50 text-green-300",
    failed: "bg-red-900/50 text-red-300",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[status] || "bg-gray-700 text-gray-300"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── Filter Sidebar ── */

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (val: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (options.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs font-medium text-gray-300 mb-1"
      >
        <span>
          {label}
          {selected.size > 0 && (
            <span className="ml-1 text-blue-400">({selected.size})</span>
          )}
        </span>
        <span className="text-gray-600">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 py-0.5 px-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-800/40 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => onToggle(opt)}
                className="w-3 h-3 rounded border-gray-600 bg-gray-800 accent-blue-500"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSidebar({
  facets,
  filters,
  onToggle,
  onClear,
  resultCount,
  totalCount,
  catalogedCount,
  onRefresh,
  refreshing,
  builtAt,
}: {
  facets: Facets;
  filters: Record<FilterKey, Set<string>>;
  onToggle: (key: FilterKey, val: string) => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
  catalogedCount: number;
  onRefresh: () => void;
  refreshing: boolean;
  builtAt: number | null;
}) {
  const hasFilters = Object.values(filters).some((s) => s.size > 0);

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 overflow-y-auto p-3">
      {/* Stats + refresh */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {resultCount} / {totalCount} files
          </span>
          {hasFilters && (
            <button
              onClick={onClear}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="text-[10px] text-gray-600">
          {catalogedCount} cataloged &middot; {totalCount - catalogedCount} uncataloged
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {refreshing ? "Scanning..." : "Refresh"}
          </button>
          {builtAt && (
            <span className="text-[9px] text-gray-600">
              {new Date(builtAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <FilterGroup
        label="Material"
        options={facets.material}
        selected={filters.material}
        onToggle={(v) => onToggle("material", v)}
      />
      <FilterGroup
        label="Nozzle"
        options={facets.nozzle}
        selected={filters.nozzle}
        onToggle={(v) => onToggle("nozzle", v)}
      />
      <FilterGroup
        label="Layer Height"
        options={facets.layerHeight}
        selected={filters.layerHeight}
        onToggle={(v) => onToggle("layerHeight", v)}
      />
      <FilterGroup
        label="Status"
        options={facets.status}
        selected={filters.status}
        onToggle={(v) => onToggle("status", v)}
      />
      <FilterGroup
        label="Tags"
        options={facets.tags}
        selected={filters.tags}
        onToggle={(v) => onToggle("tags", v)}
      />
      <FilterGroup
        label="File Type"
        options={facets.extension}
        selected={filters.extension}
        onToggle={(v) => onToggle("extension", v)}
      />
      <FilterGroup
        label="Folder"
        options={facets.folders}
        selected={filters.folders}
        onToggle={(v) => onToggle("folders", v)}
      />
    </div>
  );
}

/* ── Detail Panel ── */

function DetailPanel({
  item,
  onClose,
  onNavigate,
}: {
  item: CatalogItem;
  onClose: () => void;
  onNavigate: (dir: string) => void;
}) {
  const fields = [
    { label: "Material", value: item.material },
    { label: "Nozzle", value: item.nozzle },
    { label: "Layer Height", value: item.layerHeight },
    { label: "Infill", value: item.infill },
    { label: "Supports", value: item.supports },
    { label: "Print Time", value: item.printTime },
    { label: "Gridfinity", value: item.gridfinitySize },
  ].filter((f) => f.value);

  return (
    <div className="w-1/2 border-l border-gray-800 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="min-w-0">
          <h2 className="font-medium text-sm truncate">
            {item.printName || item.fileName}
          </h2>
          <p className="text-xs text-gray-500">
            {formatSize(item.size)} &middot; {item.extension.toUpperCase().slice(1)}
            {!item.hasMeta && (
              <span className="ml-2 text-yellow-600">No prints.yaml</span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg flex-shrink-0 ml-2"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <ModelViewer
          url={fileUrl(item.relativePath)}
          extension={item.extension}
          className="w-full h-full"
        />
      </div>

      <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 overflow-y-auto max-h-64 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate(item.dirPath)}
            className="text-[11px] px-2.5 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Open folder
          </button>
          <a
            href={fileUrl(item.relativePath)}
            download={item.fileName}
            className="text-[11px] px-2.5 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Download
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(item.relativePath)}
            className="text-[11px] px-2.5 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Copy path
          </button>
        </div>

        <div className="flex items-center gap-2">
          {item.status && <StatusBadge status={item.status} />}
          {item.author && (
            <span className="text-[11px] text-gray-500">by {item.author}</span>
          )}
        </div>

        {item.description && (
          <p className="text-[11px] text-gray-400 leading-relaxed">
            {item.description}
          </p>
        )}

        {fields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {fields.map((f) => (
              <div key={f.label} className="text-[11px]">
                <span className="text-gray-500">{f.label}: </span>
                <span className="text-gray-300">{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="text-[11px]">
          <span className="text-gray-500">Location: </span>
          <button
            onClick={() => onNavigate(item.dirPath)}
            className="text-blue-400 hover:text-blue-300"
          >
            {item.dirPath || "/"}
          </button>
        </div>

        {item.notes && (
          <p className="text-[11px] text-gray-500 italic leading-relaxed">
            {item.notes}
          </p>
        )}

        {item.source && (
          <a
            href={item.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-400 hover:text-blue-300 underline"
          >
            View on source
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Main Catalog View ── */

export default function CatalogView({
  onNavigate,
}: {
  onNavigate: (dir: string) => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [facets, setFacets] = useState<Facets>({
    material: [],
    nozzle: [],
    layerHeight: [],
    status: [],
    tags: [],
    extension: [],
    folders: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [builtAt, setBuiltAt] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<FilterKey, Set<string>>>({
    material: new Set(),
    nozzle: new Set(),
    layerHeight: new Set(),
    status: new Set(),
    tags: new Set(),
    extension: new Set(),
    folders: new Set(),
  });
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "modified" | "size">("name");

  const loadCatalog = useCallback(async (method: "GET" | "POST" = "GET") => {
    const isRefresh = method === "POST";
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/catalog", { method });
      const data = await res.json();
      if (method === "POST") {
        // POST returns confirmation, refetch the data
        const res2 = await fetch("/api/catalog");
        const data2 = await res2.json();
        setItems(data2.items);
        setFacets(data2.facets);
        setBuiltAt(data2.builtAt);
      } else {
        setItems(data.items);
        setFacets(data.facets);
        setBuiltAt(data.builtAt);
      }
    } catch (err) {
      console.error("Failed to load catalog:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const toggleFilter = (key: FilterKey, val: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(val)) {
        next[key].delete(val);
      } else {
        next[key].add(val);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilters({
      material: new Set(),
      nozzle: new Set(),
      layerHeight: new Set(),
      status: new Set(),
      tags: new Set(),
      extension: new Set(),
      folders: new Set(),
    });
    setSearch("");
  };

  const catalogedCount = useMemo(() => items.filter((i) => i.hasMeta).length, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    // Are any metadata-specific filters active?
    const hasMetaFilters = META_FILTER_KEYS.some((k) => filters[k].size > 0);

    return items
      .filter((item) => {
        // Text search
        if (q) {
          const hay = [
            item.fileName,
            item.printName,
            item.description,
            item.author,
            item.notes,
            item.material,
            item.dirPath,
            ...item.tags,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }

        // If any metadata filter is active, exclude uncataloged files entirely
        if (hasMetaFilters && !item.hasMeta) return false;

        for (const key of Object.keys(filters) as FilterKey[]) {
          const selected = filters[key];
          if (selected.size === 0) continue;

          if (key === "tags") {
            if (!item.tags.some((t) => selected.has(t))) return false;
          } else if (key === "folders") {
            if (!selected.has(item.dirPath)) return false;
          } else if (key === "extension") {
            if (!selected.has(item.extension)) return false;
          } else {
            // material, nozzle, layerHeight, status — strict match
            const val = item[key];
            if (val === null || !selected.has(val)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return (a.printName || a.fileName).localeCompare(
            b.printName || b.fileName
          );
        }
        if (sortBy === "modified") {
          return new Date(b.modified).getTime() - new Date(a.modified).getTime();
        }
        return b.size - a.size;
      });
  }, [items, search, filters, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Building inventory...
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <FilterSidebar
        facets={facets}
        filters={filters}
        onToggle={toggleFilter}
        onClear={clearFilters}
        resultCount={filtered.length}
        totalCount={items.length}
        catalogedCount={catalogedCount}
        onRefresh={() => loadCatalog("POST")}
        refreshing={refreshing}
        builtAt={builtAt}
      />

      <div className={`flex-1 flex flex-col overflow-hidden ${selectedItem ? "w-1/2" : ""}`}>
        {/* Search + sort bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900/50">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files, names, tags, materials..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-600"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 outline-none"
          >
            <option value="name">Name</option>
            <option value="modified">Recent</option>
            <option value="size">Size</option>
          </select>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No files match your filters
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {filtered.map((item) => (
                <div
                  key={item.relativePath}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.relativePath === item.relativePath
                        ? null
                        : item
                    )
                  }
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    selectedItem?.relativePath === item.relativePath
                      ? "bg-blue-900/30"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  {/* Tiny thumbnail */}
                  <div className="w-12 h-12 rounded bg-gray-900 overflow-hidden flex-shrink-0">
                    <ModelThumbnail
                      url={fileUrl(item.relativePath)}
                      extension={item.extension}
                      className="w-full h-full"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">
                        {item.printName || item.fileName}
                      </span>
                      {item.status && <StatusBadge status={item.status} />}
                      {!item.hasMeta && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-600">
                          uncataloged
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      <span>{item.dirPath || "/"}</span>
                      <span>&middot;</span>
                      <span>{formatSize(item.size)}</span>
                      {item.material && (
                        <>
                          <span>&middot;</span>
                          <span>{item.material}</span>
                        </>
                      )}
                      {item.nozzle && (
                        <>
                          <span>&middot;</span>
                          <span>{item.nozzle}</span>
                        </>
                      )}
                    </div>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1 py-0.5 rounded bg-gray-800 text-gray-500"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 5 && (
                          <span className="text-[9px] text-gray-600">
                            +{item.tags.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedItem && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
