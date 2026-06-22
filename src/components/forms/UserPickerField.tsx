import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, UserRound, X } from "lucide-react";

export type UserPickerOption = {
  value: string;
  label: string;
  subtitle?: string;
  keywords?: string[];
};

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

type UserPickerFieldProps = {
  options: UserPickerOption[];
  selected: string[];
  onChange: (nextSelected: string[]) => void;
  placeholder?: string;
  emptySelectedText?: string;
  maxSelections?: number;
  query?: string;
  onQueryChange?: (nextQuery: string) => void;
  dropdownStrategy?: "portal" | "inline";
  selectedLabel?: string;
  emptyAvailableText?: string;
};

export function UserPickerField({
  options,
  selected,
  onChange,
  placeholder = "Adicionar responsável...",
  emptySelectedText = "Nenhum responsável adicionado ainda.",
  maxSelections,
  query,
  onQueryChange,
  dropdownStrategy = "portal",
  selectedLabel,
  emptyAvailableText = "Nenhum usuário disponível para adicionar.",
}: UserPickerFieldProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchTerm = query ?? internalQuery;

  const setSearchTerm = (nextQuery: string) => {
    if (query === undefined) {
      setInternalQuery(nextQuery);
    }

    onQueryChange?.(nextQuery);
  };

  const updateDropdownPosition = () => {
    if (dropdownStrategy !== "portal" || !anchorRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  const closeDropdown = (blurInput = false) => {
    setOpen(false);
    if (blurInput) {
      window.requestAnimationFrame(() => inputRef.current?.blur());
    }
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideRoot = rootRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);

      if (!clickedInsideRoot && !clickedInsideDropdown) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open || dropdownStrategy !== "portal") return;

    updateDropdownPosition();

    const handleViewportChange = () => updateDropdownPosition();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [dropdownStrategy, open]);

  const selectedOptions = useMemo(
    () =>
      selected
        .map((value) => options.find((option) => option.value === value))
        .filter((option): option is UserPickerOption => Boolean(option)),
    [options, selected],
  );

  const availableOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(searchTerm);
    const pool = options.filter((option) => !selected.includes(option.value));

    if (!normalizedQuery) {
      return pool;
    }

    return pool.filter((option) => {
      const haystack = normalizeSearch(
        [option.label, option.subtitle, ...(option.keywords || [])].join(" "),
      );

      return haystack.includes(normalizedQuery);
    });
  }, [options, searchTerm, selected]);

  const addUser = (value: string) => {
    if (selected.includes(value)) return;

    const nextSelected = maxSelections === 1 ? [value] : [...selected, value];

    onChange(nextSelected);
    setSearchTerm("");
    closeDropdown(true);
  };

  const removeUser = (value: string) => {
    onChange(selected.filter((entry) => entry !== value));
  };

  const shouldRenderDropdown = Boolean(
    open && (dropdownStrategy === "inline" || (dropdownPosition && typeof document !== "undefined")),
  );

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={`user-dropdown members-dropdown responsible-selector-dropdown overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-card backdrop-blur pointer-events-auto ${
        dropdownStrategy === "portal"
          ? "fixed"
          : "absolute left-0 right-0 top-full z-[60] mt-2"
      }`}
      style={
        dropdownStrategy === "portal" && dropdownPosition
          ? {
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 9999,
            }
          : undefined
      }
    >
      <div
        className="available-users-list max-h-[260px] space-y-1 overflow-y-auto overscroll-contain p-2"
        onWheel={(event) => event.stopPropagation()}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {availableOptions.length === 0 ? (
          <div className="rounded-xl px-3 py-3 text-sm text-muted-foreground">
            {emptyAvailableText}
          </div>
        ) : (
          availableOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                addUser(option.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  addUser(option.value);
                }
              }}
              className="flex w-full items-start gap-3 rounded-xl border border-transparent bg-muted/10 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
            >
              <AvatarText label={option.label} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{option.label}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {option.subtitle || "Usuário disponível"}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="responsible-selector relative space-y-3 overflow-visible">
      <div ref={anchorRef} className="relative overflow-visible">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 px-3 py-2.5 transition-colors focus-within:border-primary/50 focus-within:bg-muted/30">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              updateDropdownPosition();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeDropdown(true);
              }
            }}
            placeholder={placeholder}
            className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {shouldRenderDropdown
          ? dropdownStrategy === "portal" && dropdownPosition
            ? createPortal(dropdownContent, document.body)
            : dropdownContent
          : null}
      </div>

      <div className="space-y-2">
        {selectedLabel ? (
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {selectedLabel}
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedOptions.length} selecionado(s)
            </div>
          </div>
        ) : null}

        {selectedOptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
            {emptySelectedText}
          </div>
        ) : (
          selectedOptions.map((option) => (
            <div
              key={option.value}
              className="flex items-center gap-3 rounded-2xl border border-border bg-muted/15 px-4 py-3"
            >
              <AvatarText label={option.label} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{option.label}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {option.subtitle || "Usuário selecionado"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeUser(option.value)}
                className="rounded-lg border border-border bg-background/40 p-2 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                aria-label={`Remover ${option.label}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AvatarText({ label }: { label: string }) {
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0])
    .join("")
    .toUpperCase();

  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-xs font-semibold text-primary-foreground shadow-glow">
      {initials || <UserRound className="h-4 w-4" />}
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
