import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Eye, MessageSquare, Shield } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listContentFlags, resolveContentFlag } from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";
import { useState } from "react";

export const Route = createFileRoute("/forum/moderation")({
  head: () => ({ meta: [{ title: "Moderação · Fórum · NimbusDesk" }] }),
  component: ForumModerationPage,
});

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  inappropriate: "Conteúdo inadequado",
  conteudo_inadequado: "Conteúdo inadequado",
  duplicate: "Duplicado",
  duplicado: "Duplicado",
  other: "Outro",
  outro: "Outro",
};

const CONTENT_TYPE_LABELS: Record<string, { label: string; icon: typeof Eye; route: string }> = {
  forum_topic: { label: "Tópico", icon: MessageSquare, route: "/forum" },
  forum_reply: { label: "Resposta", icon: MessageSquare, route: "/forum" },
};

function fmtDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ForumModerationPage() {
  const user = getStoredUser();
  const isAdmin = user?.is_staff || user?.is_superuser;
  const qc = useQueryClient();
  const [filterReviewed, setFilterReviewed] = useState<"all" | "pending" | "reviewed">("pending");
  const [filterType, setFilterType] = useState<string>("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionMap, setActionMap] = useState<Record<string, string>>({});

  const flagsQ = useQuery({
    queryKey: ["forum-flags", filterReviewed],
    queryFn: () => listContentFlags(filterReviewed !== "all" ? { reviewed: filterReviewed === "reviewed" } : undefined),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => resolveContentFlag(id, action),
    onSuccess: () => {
      toast.success("Sinalização resolvida.");
      setResolvingId(null);
      void qc.invalidateQueries({ queryKey: ["forum-flags"] });
    },
    onError: () => toast.error("Não foi possível resolver a sinalização."),
  });

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-10 text-center space-y-3">
          <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </AppShell>
    );
  }

  const flags = flagsQ.data ?? [];
  const filtered = filterType === "all" ? flags : flags.filter((f) => f.content_type === filterType);
  const pending = flags.filter((f) => !f.reviewed).length;

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        <PageHeader
          title="Fila de Moderação"
          subtitle="Conteúdo sinalizado pela comunidade para revisão."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-500/20 text-orange-400">
              <Shield className="h-4 w-4" />
            </span>
          }
          actions={
            pending > 0 ? (
              <Badge variant="destructive" className="gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                {pending} pendente{pending > 1 ? "s" : ""}
              </Badge>
            ) : undefined
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {(["pending", "all", "reviewed"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilterReviewed(v)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  filterReviewed === v ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {v === "pending" ? "Pendentes" : v === "reviewed" ? "Resolvidos" : "Todos"}
              </button>
            ))}
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="forum_topic">Tópicos</SelectItem>
              <SelectItem value="forum_reply">Respostas</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} sinalizaç{filtered.length === 1 ? "ão" : "ões"}</span>
        </div>

        {/* Flags list */}
        {flagsQ.isLoading ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500/50" />
            <p className="text-sm text-muted-foreground">Nenhuma sinalização encontrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((flag) => {
              const meta = CONTENT_TYPE_LABELS[flag.content_type];
              const Icon = meta?.icon ?? AlertTriangle;
              const action = actionMap[flag.id] ?? "reviewed";

              return (
                <div key={flag.id} className={cn("glass rounded-2xl p-4 shadow-card", flag.reviewed && "opacity-60")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn("mt-0.5 h-8 w-8 rounded-lg grid place-items-center shrink-0", flag.reviewed ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-400")}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-foreground">
                            {meta?.label ?? flag.content_type}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {REASON_LABELS[flag.reason] ?? flag.reason}
                          </Badge>
                          {flag.reviewed && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-500/15 text-green-500 border-green-500/20">
                              Resolvido: {flag.action_taken || "revisado"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span>ID do conteúdo: <code className="bg-muted rounded px-1">{flag.object_id.slice(0, 8)}…</code></span>
                          <span>Reportado em {fmtDate(flag.created_at)}</span>
                          {flag.content_type === "forum_topic" && (
                            <Link to="/forum/$id" params={{ id: flag.object_id }} className="flex items-center gap-1 text-blue-400 hover:underline">
                              <Eye className="h-3 w-3" /> Ver tópico
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {!flag.reviewed && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={action}
                          onValueChange={(v) => setActionMap((m) => ({ ...m, [flag.id]: v }))}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reviewed">Revisado — sem ação</SelectItem>
                            <SelectItem value="warning">Aviso ao autor</SelectItem>
                            <SelectItem value="removed">Conteúdo removido</SelectItem>
                            <SelectItem value="dismissed">Ignorado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          disabled={resolveMut.isPending && resolvingId === flag.id}
                          onClick={() => { setResolvingId(flag.id); resolveMut.mutate({ id: flag.id, action }); }}
                        >
                          Resolver
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
