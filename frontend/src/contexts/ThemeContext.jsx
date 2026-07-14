import { createContext, useEffect, useState } from "react";

export const ThemeContext = createContext(null);

const STORAGE_KEY = "praxis.theme";

const THEMES = [
  { id: "0", name: "Control Room", description: "Dark graphite, blue accent — the default studio" },
  { id: "1", name: "Warm Editorial", description: "Cream paper, slab serif, ink shadows" },
  { id: "2", name: "Bauhaus", description: "Bold geometry, primary colors, flat planes" },
  { id: "3", name: "Zen Garden", description: "Washi paper, indigo, negative space" },
  { id: "4", name: "Brutalist Terminal", description: "Monospace, terminal green, raw data" },
  { id: "5", name: "Glass Observatory", description: "Deep space, aurora glow, frosted glass" },
];

const VALID_THEME_IDS = new Set(THEMES.map((t) => t.id));

function readInitialTheme() {
  if (typeof window === "undefined") {
    return "0";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_THEME_IDS.has(stored)) {
    return stored;
  }

  return "0";
}

function applyTheme(themeId) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", themeId);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  function setTheme(id) {
    if (VALID_THEME_IDS.has(id)) {
      setThemeState(id);
    }
  }

  function cycleTheme() {
    setThemeState((current) => {
      const idx = THEMES.findIndex((t) => t.id === current);
      const next = (idx + 1) % THEMES.length;
      return THEMES[next].id;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
