import { useEffect, useRef, useState } from "react";
import { Moon, Palette, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyTheme,
  loadThemeConfig,
  saveThemeConfig,
  useTheme,
  type ThemeConfig,
} from "@/hooks/useTheme";
import { syncThemeToDb } from "@/services/authService";

const PRESET_COLORS: { label: string; hue: number; hex: string }[] = [
  { label: "Azul", hue: 260, hex: "#6366f1" },
  { label: "Roxo", hue: 300, hex: "#a855f7" },
  { label: "Ciano", hue: 200, hex: "#06b6d4" },
  { label: "Verde", hue: 155, hex: "#22c55e" },
  { label: "Laranja", hue: 45, hex: "#f97316" },
  { label: "Rosa", hue: 330, hex: "#ec4899" },
  { label: "Vermelho", hue: 25, hex: "#ef4444" },
  { label: "Turquesa", hue: 175, hex: "#14b8a6" },
];

export function ThemeSwitcher() {
  const { config, setConfig } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ThemeConfig>(config);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Sync draft when config changes externally
  useEffect(() => { setDraft(config); }, [config]);

  function applyAndSave(newConfig: ThemeConfig) {
    setDraft(newConfig);
    setConfig(newConfig);
    applyTheme(newConfig);
    saveThemeConfig(newConfig);
    void syncThemeToDb(newConfig as unknown as Record<string, unknown>);
  }

  function previewApply(newConfig: ThemeConfig) {
    setDraft(newConfig);
    applyTheme(newConfig);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Quick mode icons */}
      <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
        <button
          type="button"
          title="Modo escuro"
          onClick={() => applyAndSave({ ...draft, mode: "dark" })}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md transition-colors",
            config.mode === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Moon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Modo claro"
          onClick={() => applyAndSave({ ...draft, mode: "light" })}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md transition-colors",
            config.mode === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Sun className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Tema personalizado"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md transition-colors",
            config.mode === "custom" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Custom theme panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-2xl border border-border bg-popover p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Tema personalizado</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {/* Base: dark or light */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Base</p>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((base) => (
                <button
                  key={base}
                  type="button"
                  onClick={() => previewApply({ ...draft, mode: "custom", base })}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs transition-colors",
                    draft.base === base && draft.mode === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {base === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                  {base === "dark" ? "Escuro" : "Claro"}
                </button>
              ))}
            </div>
          </div>

          {/* Primary color presets */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Cor principal</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hue}
                  type="button"
                  title={c.label}
                  onClick={() => previewApply({ ...draft, mode: "custom", primaryHue: c.hue })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition-colors",
                    draft.primaryHue === c.hue && draft.mode === "custom"
                      ? "border-foreground/40 bg-muted/40"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color presets */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Cor de destaque</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hue}
                  type="button"
                  title={c.label}
                  onClick={() => previewApply({ ...draft, mode: "custom", accentHue: c.hue })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition-colors",
                    draft.accentHue === c.hue && draft.mode === "custom"
                      ? "border-foreground/40 bg-muted/40"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom hue sliders */}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between">
                <p className="text-xs text-muted-foreground">Matiz principal</p>
                <span className="text-[10px] text-muted-foreground font-mono">{draft.primaryHue}°</span>
              </div>
              <div className="relative">
                <div
                  className="h-3 w-full rounded-full"
                  style={{
                    background: "linear-gradient(to right, oklch(0.72 0.20 0), oklch(0.72 0.20 45), oklch(0.72 0.20 90), oklch(0.72 0.20 135), oklch(0.72 0.20 180), oklch(0.72 0.20 225), oklch(0.72 0.20 270), oklch(0.72 0.20 315), oklch(0.72 0.20 360))",
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={draft.primaryHue}
                  onChange={(e) => previewApply({ ...draft, mode: "custom", primaryHue: Number(e.target.value) })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <p className="text-xs text-muted-foreground">Matiz de destaque</p>
                <span className="text-[10px] text-muted-foreground font-mono">{draft.accentHue}°</span>
              </div>
              <div className="relative">
                <div
                  className="h-3 w-full rounded-full"
                  style={{
                    background: "linear-gradient(to right, oklch(0.65 0.22 0), oklch(0.65 0.22 45), oklch(0.65 0.22 90), oklch(0.65 0.22 135), oklch(0.65 0.22 180), oklch(0.65 0.22 225), oklch(0.65 0.22 270), oklch(0.65 0.22 315), oklch(0.65 0.22 360))",
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={draft.accentHue}
                  onChange={(e) => previewApply({ ...draft, mode: "custom", accentHue: Number(e.target.value) })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
          </div>

          {/* Apply / Reset buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyAndSave(draft)}
              className="flex-1 rounded-lg bg-gradient-primary py-1.5 text-xs font-medium text-primary-foreground shadow-glow hover:opacity-90 transition-opacity"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={() => {
                const reset = { mode: "dark" as const, primaryHue: 260, accentHue: 300, base: "dark" as const };
                applyAndSave(reset);
                setOpen(false);
              }}
              className="rounded-lg border border-border px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
