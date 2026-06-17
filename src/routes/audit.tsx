import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ScrollText } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuditLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { listAuditLogs } from "@/services/auditService";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Auditoria · Nimbus" }] }),
  component: AuditPage,
});

const ACTION_LABEL: Record<string, string> = {
  "ticket.created": "abriu chamado",
  "ticket.updated": "atualizou chamado",
  "ticket.deleted": "excluiu chamado",
  "ticket.approved": "aprovou chamado",
  "ticket.rejected": "reprovou chamado",
  "ticket.converted": "converteu chamado",
  CONVERT_TICKET_TO_KB: "converteu para KB",
  TICKET_RATED: "avaliou chamado",
};

function getActionColor(action: string) {
  if (action.includes("created")) return "bg-blue-500";
  if (action.includes("updated")) return "bg-yellow-500";
  if (action.includes("deleted")) return "bg-red-500";
  if (action.includes("approved")) return "bg-green-500";
  return "bg-gray-400";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditLogCard({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = log.changes && Object.keys(log.changes).length > 0;

  return (
    <div className="glass rounded-2xl p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", getActionColor(log.action))}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{log.actor_name}</span>{" "}
            <span className="text-muted-foreground">
              {ACTION_LABEL[log.action] ?? log.action}
            </span>{" "}
            <span className="font-medium">{log.entity_label}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {log.entity_type}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
          {log.ip_address ? (
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{log.ip_address}</p>
          ) : null}
        </div>
      </div>

      {hasChanges ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-medium text-primary transition hover:opacity-80"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Ocultar detalhes
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> Ver detalhes
              </>
            )}
          </button>
          {expanded ? (
            <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-muted/30 p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-1.5 pr-4 font-medium">Campo</th>
                    <th className="pb-1.5 pr-4 font-medium">Antes</th>
                    <th className="pb-1.5 font-medium">Depois</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(log.changes!).map(([key, value]) => {
                    const isArray = Array.isArray(value);
                    const before = isArray ? String(value[0] ?? "—") : "—";
                    const after = isArray ? String(value[1] ?? "—") : String(value ?? "—");

                    return (
                      <tr key={key} className="border-t border-border/50">
                        <td className="py-1 pr-4 font-mono text-muted-foreground">{key}</td>
                        <td className="py-1 pr-4 text-destructive/80">{before}</td>
                        <td className="py-1 text-success">{after}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const PAGE_SIZE = 50;

function AuditPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const params = {
    search: debouncedSearch || undefined,
    entity_type: entityType || undefined,
    page,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", debouncedSearch, entityType, page],
    queryFn: () => listAuditLogs(params),
  });

  const logs = data?.results ?? [];
  const total = data?.count ?? 0;
  const hasMore = page * PAGE_SIZE < total;

  return (
    <AppShell>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          title="Auditoria"
          subtitle="Historico completo de acoes na plataforma."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ScrollText className="h-4 w-4" />
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por ator, entidade..."
            className="h-9 max-w-xs border-border bg-muted/40"
          />
          <Select
            value={entityType || "__all__"}
            onValueChange={(v) => {
              setEntityType(v === "__all__" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-48 border-border bg-muted/40">
              <SelectValue placeholder="Tipo de entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="ticket">Chamado</SelectItem>
              <SelectItem value="activity">Atividade</SelectItem>
              <SelectItem value="project">Projeto</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
              <SelectItem value="knowledge">Conhecimento</SelectItem>
              <SelectItem value="communication">Comunicacao</SelectItem>
            </SelectContent>
          </Select>
          {total > 0 ? (
            <span className="text-xs text-muted-foreground">
              {total} registro{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Carregando registros...
            </div>
          ) : logs.length === 0 ? (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
              <ScrollText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            </div>
          ) : (
            logs.map((log) => <AuditLogCard key={log.id} log={log} />)
          )}
        </div>

        {hasMore ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
            >
              Carregar mais
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
