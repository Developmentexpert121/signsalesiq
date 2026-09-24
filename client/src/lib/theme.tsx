import { createContext, useContext, useState, useLayoutEffect, type ReactNode } from "react";

type DarkMode = "light" | "dark";

interface ThemeContextType {
  darkMode: DarkMode;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getInitialDarkMode(): DarkMode {
  const stored = localStorage.getItem("ssiq-dark-mode") as DarkMode | null;
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState<DarkMode>(getInitialDarkMode);

  const toggleDarkMode = () => {
    const next = darkMode === "light" ? "dark" : "light";
    setDarkMode(next);
    localStorage.setItem("ssiq-dark-mode", next);
  };

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (darkMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
