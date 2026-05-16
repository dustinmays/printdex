"use client";

import { useSyncExternalStore, useCallback } from "react";
import {
  applyTheme,
  getThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const EVENT = "themechange";
let cache: ThemePreference | null = null;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function getSnapshot(): ThemePreference {
  if (!cache) cache = getThemePreference();
  return cache;
}

function getServerSnapshot(): ThemePreference {
  return { mode: "light" };
}

export function useThemePreference() {
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const updateTheme = useCallback((next: ThemePreference) => {
    cache = next;
    saveThemePreference(next);
    applyTheme(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { preference, updateTheme };
}
