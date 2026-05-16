"use client";

import { useEffect } from "react";
import { applyTheme, getThemePreference } from "@/lib/theme";

export function ThemeInitializer() {
  useEffect(() => {
    applyTheme(getThemePreference());
  }, []);
  return null;
}
