import { useState } from "react";
import { FileText } from "lucide-react";

import type { WorkItem } from "@/lib/workItem";

const COLLAPSE_THRESHOLD = 700;

export function WorkItemDescription({ item }: { item: WorkItem }) {
  const [expanded, setExpanded] = useState(false);
  const description = item.description || "";
  const isLong = description.length > COLLAPSE_THRESHOLD;
  const shown = !isLong || expanded ? description : `${description.slice(0, COLLAPSE_THRESHOLD)}…`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Descrição original
        </div>
        {description ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{shown}</p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                {expanded ? "▲ Recolher" : "▼ Exibir mais"}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sem descrição informada.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { label: "Solicitante", value: item.requesterName },
          { label: "Cliente", value: item.clientName },
          { label: "Projeto", value: item.projectName },
          { label: "Sprint", value: item.sprintName },
          { label: "Categoria", value: item.category },
          { label: "Código", value: item.code },
        ]
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label} className="rounded-xl border border-border bg-muted/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
              <p className="mt-0.5 truncate text-sm font-medium" title={f.value}>{f.value}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
