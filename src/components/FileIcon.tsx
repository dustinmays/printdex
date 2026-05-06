"use client";

const iconMap: Record<string, { icon: string; color: string }> = {
  ".stl": { icon: "⬡", color: "text-blue-400" },
  ".obj": { icon: "⬡", color: "text-green-400" },
  ".3mf": { icon: "⬡", color: "text-purple-400" },
  ".step": { icon: "⬡", color: "text-orange-400" },
  ".stp": { icon: "⬡", color: "text-orange-400" },
  ".gcode": { icon: "◉", color: "text-yellow-400" },
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

  const config = iconMap[extension] || { icon: "📄", color: "text-gray-400" };

  return <span className={`text-lg ${config.color}`}>{config.icon}</span>;
}
