import { useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { Eye, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

marked.setOptions({ breaks: true, gfm: true });

export function MarkdownEditor({ id, value, onChange, placeholder, rows = 12, className }: MarkdownEditorProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  const html = DOMPurify.sanitize(marked.parse(value || "") as string);

  return (
    <div className={cn("rounded-xl border border-input overflow-hidden", className)}>
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-input bg-muted/30 px-2 pt-1">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={cn(
            "flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "write"
              ? "bg-background text-foreground shadow-sm border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Pencil className="h-3 w-3" />
          Escrever
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={cn(
            "flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "preview"
              ? "bg-background text-foreground shadow-sm border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Eye className="h-3 w-3" />
          Pré-visualização
        </button>
        <span className="ml-auto pr-2 text-[10px] text-muted-foreground hidden sm:block">
          Suporta Markdown
        </span>
      </div>

      {/* Content area */}
      {tab === "write" ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Escreva em Markdown... (use **negrito**, _itálico_, ```código```...)"}
          rows={rows}
          className="w-full resize-none bg-background px-3 py-2.5 text-sm outline-none font-mono"
        />
      ) : (
        <div
          className="prose prose-sm dark:prose-invert max-w-none min-h-[120px] px-4 py-3 text-sm"
          dangerouslySetInnerHTML={{ __html: html || '<p class="text-muted-foreground italic">Nada para exibir...</p>' }}
        />
      )}
    </div>
  );
}
