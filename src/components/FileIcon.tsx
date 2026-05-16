"use client";

const iconMap: Record<string, { icon: string; color: string }> = {
  ".stl": { icon: "⬡", color: "text-primary" },
  ".obj": { icon: "⬡", color: "text-success" },
  ".3mf": { icon: "⬡", color: "text-purple-400" },
  ".step": { icon: "⬡", color: "text-orange-400" },
  ".stp": { icon: "⬡", color: "text-orange-400" },
  ".gcode": { icon: "◉", color: "text-warning" },
  folder: { icon: "📁", color: "" },
};

export default function FileIcon({
  extension,
  isDirectory,
}: {
  extension: string;
  isDirectory: boolean;
}) {
  if (isDirectory) {
    return <span className="text-lg">📁</span>;
  }

  const config = iconMap[extension] || { icon: "📄", color: "text-muted-foreground" };

  return <span className={`text-lg ${config.color}`}>{config.icon}</span>;
}
