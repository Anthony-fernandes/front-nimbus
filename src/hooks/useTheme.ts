import { createContext, useContext } from "react";

export type ThemeBase = "dark" | "light";
export type ThemeMode = "dark" | "light" | "custom";

export interface ThemeConfig {
  mode: ThemeMode;
  primaryHue: number;   // 0-360
  accentHue: number;    // 0-360
  base: ThemeBase;      // for custom: dark or light background base
}

const DEFAULT_CONFIG: ThemeConfig = {
  mode: "dark",
  primaryHue: 260,
  accentHue: 300,
  base: "dark",
};

const STORAGE_KEY = "nimbus-theme";

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) as Partial<ThemeConfig> };
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

export function saveThemeConfig(config: ThemeConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function buildCustomVars(config: ThemeConfig): Record<string, string> {
  const h = config.primaryHue;
  const a = config.accentHue;
  const isDark = config.base === "dark";

  if (isDark) {
    return {
      "--background": `oklch(0.16 0.015 ${h})`,
      "--foreground": "oklch(0.97 0.01 250)",
      "--card": `oklch(0.20 0.018 ${h})`,
      "--card-foreground": "oklch(0.97 0.01 250)",
      "--popover": `oklch(0.21 0.02 ${h})`,
      "--popover-foreground": "oklch(0.97 0.01 250)",
      "--primary": `oklch(0.72 0.20 ${h})`,
      "--primary-foreground": `oklch(0.12 0.02 ${h})`,
      "--secondary": `oklch(0.27 0.03 ${h})`,
      "--secondary-foreground": "oklch(0.97 0.01 250)",
      "--muted": `oklch(0.24 0.02 ${h})`,
      "--muted-foreground": `oklch(0.68 0.025 ${h})`,
      "--accent": `oklch(0.65 0.22 ${a})`,
      "--accent-foreground": "oklch(0.98 0.005 250)",
      "--destructive": "oklch(0.65 0.24 25)",
      "--destructive-foreground": "oklch(0.98 0.005 250)",
      "--success": "oklch(0.72 0.18 155)",
      "--success-foreground": "oklch(0.12 0.02 160)",
      "--warning": "oklch(0.82 0.17 85)",
      "--warning-foreground": "oklch(0.18 0.03 85)",
      "--info": "oklch(0.72 0.16 220)",
      "--info-foreground": "oklch(0.12 0.02 220)",
      "--border": `oklch(0.30 0.02 ${h} / 0.6)`,
      "--input": `oklch(0.28 0.025 ${h})`,
      "--ring": `oklch(0.72 0.20 ${h})`,
      "--sidebar": `oklch(0.14 0.018 ${h})`,
      "--sidebar-foreground": "oklch(0.92 0.01 250)",
      "--sidebar-primary": `oklch(0.72 0.20 ${h})`,
      "--sidebar-primary-foreground": `oklch(0.12 0.02 ${h})`,
      "--sidebar-accent": `oklch(0.22 0.025 ${h})`,
      "--sidebar-accent-foreground": "oklch(0.97 0.01 250)",
      "--sidebar-border": `oklch(0.26 0.02 ${h} / 0.5)`,
      "--sidebar-ring": `oklch(0.72 0.20 ${h})`,
      "--gradient-primary": `linear-gradient(135deg, oklch(0.72 0.20 ${h}), oklch(0.65 0.22 ${a}))`,
      "--gradient-glow": `radial-gradient(circle at 30% 20%, oklch(0.72 0.20 ${h} / 0.25), transparent 60%), radial-gradient(circle at 80% 80%, oklch(0.65 0.22 ${a} / 0.20), transparent 60%)`,
      "--shadow-glow": `0 0 0 1px oklch(0.72 0.20 ${h} / 0.15), 0 10px 40px -10px oklch(0.72 0.20 ${h} / 0.35)`,
      "--shadow-card": "0 1px 0 0 oklch(1 0 0 / 0.04) inset, 0 8px 24px -12px oklch(0 0 0 / 0.5)",
    };
  }

  // Light base custom
  return {
    "--background": `oklch(0.98 0.005 ${h})`,
    "--foreground": `oklch(0.18 0.02 ${h})`,
    "--card": `oklch(1 0 0)`,
    "--card-foreground": `oklch(0.18 0.02 ${h})`,
    "--popover": `oklch(1 0 0)`,
    "--popover-foreground": `oklch(0.18 0.02 ${h})`,
    "--primary": `oklch(0.58 0.22 ${h})`,
    "--primary-foreground": "oklch(0.99 0.002 0)",
    "--secondary": `oklch(0.93 0.01 ${h})`,
    "--secondary-foreground": `oklch(0.22 0.02 ${h})`,
    "--muted": `oklch(0.95 0.008 ${h})`,
    "--muted-foreground": `oklch(0.52 0.02 ${h})`,
    "--accent": `oklch(0.55 0.20 ${a})`,
    "--accent-foreground": "oklch(0.99 0.002 0)",
    "--destructive": "oklch(0.55 0.24 25)",
    "--destructive-foreground": "oklch(0.99 0.002 0)",
    "--success": "oklch(0.55 0.18 155)",
    "--success-foreground": "oklch(0.99 0.002 0)",
    "--warning": "oklch(0.62 0.17 85)",
    "--warning-foreground": "oklch(0.15 0.03 85)",
    "--info": "oklch(0.52 0.16 220)",
    "--info-foreground": "oklch(0.99 0.002 0)",
    "--border": `oklch(0.85 0.012 ${h})`,
    "--input": `oklch(0.92 0.008 ${h})`,
    "--ring": `oklch(0.58 0.22 ${h})`,
    "--sidebar": `oklch(0.96 0.008 ${h})`,
    "--sidebar-foreground": `oklch(0.22 0.02 ${h})`,
    "--sidebar-primary": `oklch(0.58 0.22 ${h})`,
    "--sidebar-primary-foreground": "oklch(0.99 0.002 0)",
    "--sidebar-accent": `oklch(0.90 0.012 ${h})`,
    "--sidebar-accent-foreground": `oklch(0.22 0.02 ${h})`,
    "--sidebar-border": `oklch(0.88 0.01 ${h})`,
    "--sidebar-ring": `oklch(0.58 0.22 ${h})`,
    "--gradient-primary": `linear-gradient(135deg, oklch(0.58 0.22 ${h}), oklch(0.55 0.20 ${a}))`,
    "--gradient-glow": `radial-gradient(circle at 30% 20%, oklch(0.58 0.22 ${h} / 0.12), transparent 60%), radial-gradient(circle at 80% 80%, oklch(0.55 0.20 ${a} / 0.10), transparent 60%)`,
    "--shadow-glow": `0 0 0 1px oklch(0.58 0.22 ${h} / 0.2), 0 10px 40px -10px oklch(0.58 0.22 ${h} / 0.25)`,
    "--shadow-card": "0 1px 3px 0 oklch(0 0 0 / 0.08), 0 1px 2px -1px oklch(0 0 0 / 0.06)",
  };
}

const CUSTOM_VAR_NAMES = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--popover", "--popover-foreground", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
  "--success", "--success-foreground", "--warning", "--warning-foreground",
  "--info", "--info-foreground", "--border", "--input", "--ring",
  "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
  "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
  "--gradient-primary", "--gradient-glow", "--shadow-glow", "--shadow-card",
];

export function applyTheme(config: ThemeConfig) {
  const html = document.documentElement;

  // Remove theme classes
  html.classList.remove("dark", "light");
  // Clear any previously set custom vars
  for (const v of CUSTOM_VAR_NAMES) html.style.removeProperty(v);

  if (config.mode === "dark") {
    html.classList.add("dark");
  } else if (config.mode === "light") {
    html.classList.add("light");
  } else {
    // Custom: apply base class + inject CSS variables
    html.classList.add(config.base === "dark" ? "dark" : "light");
    const vars = buildCustomVars(config);
    for (const [k, v] of Object.entries(vars)) {
      html.style.setProperty(k, v);
    }
  }
}

interface ThemeContextValue {
  config: ThemeConfig;
  setConfig: (config: ThemeConfig) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  config: DEFAULT_CONFIG,
  setConfig: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
