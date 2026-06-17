import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { globalSearch, type SearchResult } from "@/services/searchService";

const TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  ticket: { emoji: "🎫", label: "Chamado", color: "bg-blue-100 text-blue-700" },
  knowledge: { emoji: "📖", label: "Artigo", color: "bg-green-100 text-green-700" },
  forum: { emoji: "💬", label: "Fórum", color: "bg-purple-100 text-purple-700" },
  doubts: { emoji: "❓", label: "Dúvida", color: "bg-yellow-100 text-yellow-700" },
  project: { emoji: "📁", label: "Projeto", color: "bg-orange-100 text-orange-700" },
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounce input → query
  useEffect(() => {
    const timer = setTimeout(() => setQuery(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputValue("");
      setQuery("");
    }
  }, [open]);

  // Escape key closes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", query],
    queryFn: () => globalSearch(query),
    enabled: query.length >= 2,
  });

  const results = data?.results ?? [];

  const handleResultClick = (result: SearchResult) => {
    navigate({ to: result.url });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-2xl shadow-2xl border border-white/20 w-full max-w-xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <Search className="h-5 w-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar chamados, artigos, projetos..."
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-base"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.length >= 2 && isLoading && (
            <div className="p-6 text-center text-gray-400 text-sm">Buscando...</div>
          )}
          {query.length >= 2 && !isLoading && results.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </div>
          )}
          {results.length > 0 && (
            <ul className="py-2">
              {results.map((result) => {
                const config = TYPE_CONFIG[result.type] ?? { emoji: "•", label: result.type, color: "bg-gray-100 text-gray-700" };
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      onClick={() => handleResultClick(result)}
                    >
                      <span className="text-lg">{config.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{result.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${config.color}`}>
                        {config.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {query.length < 2 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
