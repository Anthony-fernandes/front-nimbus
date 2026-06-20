import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HelpCircle, MessageSquare, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createDoubtsQuestion, listDoubtsQuestions } from "@/services/knowledgeService";
import type { DoubtsQuestion } from "@/lib/types";

export const Route = createFileRoute("/doubts")({
  head: () => ({ meta: [{ title: "Central de Dúvidas · Nimbus" }] }),
  component: DoubtsPage,
});

type StatusFilter = "all" | "OPEN" | "ANSWERED" | "CLOSED";

const STATUS_LABELS: Record<DoubtsQuestion["status"], string> = {
  OPEN: "Aberta",
  ANSWERED: "Respondida",
  CLOSED: "Fechada",
};

const STATUS_CLASS: Record<DoubtsQuestion["status"], string> = {
  OPEN: "bg-warning/15 text-warning",
  ANSWERED: "bg-success/15 text-success",
  CLOSED: "bg-muted text-muted-foreground",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DoubtsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "" });

  const questionsQuery = useQuery({
    queryKey: ["doubts-questions", statusFilter],
    queryFn: () =>
      listDoubtsQuestions(statusFilter !== "all" ? { status: statusFilter } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: () => createDoubtsQuestion(form),
    onSuccess: () => {
      toast.success("Pergunta enviada.");
      setDialogOpen(false);
      setForm({ title: "", content: "" });
      void queryClient.invalidateQueries({ queryKey: ["doubts-questions"] });
    },
    onError: () => toast.error("Não foi possível enviar a pergunta."),
  });

  if (pathname !== "/doubts") return <Outlet />;

  const rawQuestions = questionsQuery.data ?? [];
  const questions = search.trim()
    ? rawQuestions.filter(
        (q) =>
          q.title.toLowerCase().includes(search.toLowerCase()) ||
          q.content?.toLowerCase().includes(search.toLowerCase()),
      )
    : rawQuestions;

  const TABS: { label: string; value: StatusFilter }[] = [
    { label: "Todas", value: "all" },
    { label: "Abertas", value: "OPEN" },
    { label: "Respondidas", value: "ANSWERED" },
    { label: "Fechadas", value: "CLOSED" },
  ];

  return (
    <AppShell>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          title="Central de Dúvidas"
          subtitle="Tire suas dúvidas e ajude outros colegas."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <HelpCircle className="h-4 w-4" />
            </span>
          }
          actions={
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nova pergunta
            </Button>
          }
        />

        {/* Search + status tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Buscar dúvidas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === tab.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question list */}
        {questionsQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando dúvidas...
          </div>
        ) : questions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
            <HelpCircle className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Nenhuma dúvida encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? `Nenhum resultado para "${search}".` : 'Clique em "Nova pergunta" para começar.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                className="glass flex gap-0 rounded-2xl shadow-card transition-colors hover:border-primary/40 overflow-hidden"
              >
                {/* Stats column */}
                <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-3 border-r border-border/50 py-4 px-2">
                  {q.status === "ANSWERED" ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : null}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={cn(
                      "text-base font-bold leading-none",
                      q.answers_count > 0 ? "text-foreground" : "text-muted-foreground",
                    )}>
                      {q.answers_count}
                    </span>
                    <span className="text-[10px] text-muted-foreground">respostas</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-base font-bold text-muted-foreground leading-none">
                      {q.views_count}
                    </span>
                    <span className="text-[10px] text-muted-foreground">visitas</span>
                  </div>
                </div>

                {/* Content column */}
                <Link
                  to="/doubts/$id"
                  params={{ id: q.id }}
                  className="flex flex-1 flex-col gap-1.5 px-4 py-3 min-w-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
                        STATUS_CLASS[q.status],
                      )}
                    >
                      {STATUS_LABELS[q.status]}
                    </span>
                    <span className="font-semibold text-sm leading-snug line-clamp-1 hover:text-primary transition-colors">
                      {q.title}
                    </span>
                  </div>

                  {q.content ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {q.content}
                    </p>
                  ) : null}

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>{q.answers_count} respostas</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {q.author_name ? (
                        <span className="rounded-full bg-muted/60 px-2 py-0.5 font-medium">
                          {q.author_name}
                        </span>
                      ) : null}
                      <span>{formatDate(q.created_at)}</span>
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova pergunta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Resuma sua dúvida"
              />
            </div>
            <div className="space-y-1">
              <Label>Detalhes</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Descreva sua dúvida com mais detalhes..."
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title}
            >
              Enviar pergunta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
