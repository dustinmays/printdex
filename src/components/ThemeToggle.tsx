"use client";

import { useThemePreference } from "@/hooks/useThemePreference";

export function ThemeToggle() {
  const { preference, updateTheme } = useThemePreference();
  const isDark = preference.mode === "dark";

  return (
    <button
      onClick={() => updateTheme({ mode: isDark ? "light" : "dark" })}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="w-7 h-7 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-colors text-sm"
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
