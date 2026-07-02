import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";

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
  head: () => ({ meta: [{ title: "Auditoria · NimbusDesk" }] }),
  component: AuditPage,
});

const ACTION_LABEL: Record<string, string> = {
  "ticket.created": "abriu chamado",
  "ticket.updated": "atualizou chamado",
  "ticket.closed": "fechou chamado",
  "ticket.deleted": "excluiu chamado",
  "ticket.approved": "aprovou chamado",
  "ticket.rejected": "reprovou chamado",
  "ticket.converted": "converteu chamado",
  "user.login": "fez login",
  "user.logout": "fez logout",
  "user.created": "criou usuário",
  CONVERT_TICKET_TO_KB: "converteu para KB",
  TICKET_RATED: "avaliou chamado",
};

const ACTION_OPTIONS = [
  { value: "ticket.created", label: "Chamado criado" },
  { value: "ticket.updated", label: "Chamado atualizado" },
  { value: "ticket.closed", label: "Chamado fechado" },
  { value: "ticket.deleted", label: "Chamado excluído" },
  { value: "ticket.approved", label: "Chamado aprovado" },
  { value: "user.login", label: "Login de usuário" },
  { value: "user.created", label: "Usuário criado" },
];

function getActionColors(action: string): { dot: string; badge: string } {
  if (action.includes("created") || action === "user.created")
    return { dot: "bg-blue-500", badge: "bg-blue-500/15 text-blue-400" };
  if (action.includes("closed"))
    return { dot: "bg-green-500", badge: "bg-green-500/15 text-green-400" };
  if (action.includes("deleted"))
    return { dot: "bg-red-500", badge: "bg-red-500/15 text-red-400" };
  if (action.includes("approved"))
    return { dot: "bg-green-500", badge: "bg-green-500/15 text-green-400" };
  if (action.includes("updated"))
    return { dot: "bg-yellow-500", badge: "bg-yellow-500/15 text-yellow-400" };
  if (action === "user.login" || action === "user.logout")
    return { dot: "bg-gray-400", badge: "bg-gray-400/15 text-gray-400" };
  return { dot: "bg-gray-400", badge: "bg-muted text-muted-foreground" };
}

function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} hora${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} dia${days !== 1 ? "s" : ""}`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatFull(value: string): string {
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

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = log.changes && Object.keys(log.changes).length > 0;
  const colors = getActionColors(log.action);

  return (
    <>
      <tr
        className={cn(
          "border-t border-border/60 text-sm transition-colors hover:bg-muted/30",
          hasChanges && "cursor-pointer",
        )}
        onClick={() => hasChanges && setExpanded((prev) => !prev)}
      >
        <td className="px-4 py-2.5 whitespace-nowrap">
          <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold", colors.badge)}>
            {ACTION_LABEL[log.action] ?? log.action}
          </span>
        </td>
        <td className="px-4 py-2.5 font-medium">{log.actor_name || "Sistema"}</td>
        <td className="max-w-[280px] truncate px-4 py-2.5">{log.entity_label || "—"}</td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.entity_type || "—"}</td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap" title={formatFull(log.created_at)}>
          {relativeTime(log.created_at)}
        </td>
        <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{log.ip_address ?? "—"}</td>
        <td className="px-4 py-2.5 text-xs text-primary">
          {hasChanges ? (expanded ? "▲" : "▼ detalhes") : ""}
        </td>
      </tr>
      {expanded && hasChanges ? (
        <tr className="border-t border-border/40 bg-muted/20">
          <td colSpan={7} className="px-6 py-3">
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
                      <td className="py-1 text-green-400">{after}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  );
}

const PAGE_SIZE = 50;

function exportCSV(logs: AuditLog[]) {
  const header = ["ID", "Ação", "Ator", "Entidade", "Tipo", "Data", "IP"].join(",");
  const rows = logs.map((l) =>
    [
      l.id,
      l.action,
      `"${l.actor_name}"`,
      `"${l.entity_label}"`,
      l.entity_type,
      formatFull(l.created_at),
      l.ip_address ?? "",
    ].join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AuditPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    action: action || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", debouncedSearch, entityType, action, dateFrom, dateTo, page],
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
          subtitle="Histórico completo de ações na plataforma."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ScrollText className="h-4 w-4" />
            </span>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por ator, entidade..."
            className="h-9 max-w-xs border-border bg-muted/40"
          />
          <Select
            value={action || "__all__"}
            onValueChange={(v) => {
              setAction(v === "__all__" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-52 border-border bg-muted/40">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as ações</SelectItem>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <SelectItem value="user">Usuário</SelectItem>
              <SelectItem value="knowledge">Conhecimento</SelectItem>
              <SelectItem value="communication">Comunicação</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-border bg-muted/40 px-3 text-sm outline-none focus:border-primary/60"
            title="Data inicial"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-border bg-muted/40 px-3 text-sm outline-none focus:border-primary/60"
            title="Data final"
          />
          {total > 0 ? (
            <span className="text-xs text-muted-foreground">
              {total} registro{total !== 1 ? "s" : ""}
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => exportCSV(logs)}
            disabled={logs.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Carregando registros...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-10 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Ação</th>
                  <th className="px-4 py-2.5 font-medium">Ator</th>
                  <th className="px-4 py-2.5 font-medium">Entidade</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Quando</th>
                  <th className="px-4 py-2.5 font-medium">IP</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}

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
