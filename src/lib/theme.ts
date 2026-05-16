export type ThemeMode = "light" | "dark";
export interface ThemePreference {
  mode: ThemeMode;
}

const STORAGE_KEY = "printdex.theme";
const COOKIE_KEY = "printdex_theme";

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return { mode: "light" };

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.mode === "light" || parsed.mode === "dark") return parsed;
    }
  } catch {}

  const cookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_KEY}=`));
  if (cookie) {
    const val = decodeURIComponent(cookie.split("=")[1] || "");
    if (val === "light" || val === "dark") return { mode: val };
  }

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return { mode: prefersDark ? "dark" : "light" };
}

export function saveThemePreference(pref: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {}
  document.cookie = `${COOKIE_KEY}=${pref.mode}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function applyTheme(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.mode = pref.mode;
}
