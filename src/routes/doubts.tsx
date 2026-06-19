import { useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Plus } from "lucide-react";
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
  if (pathname !== "/doubts") return <Outlet />;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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

  const questions = questionsQuery.data ?? [];

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

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                statusFilter === tab.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Questions */}
        {questionsQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando dúvidas...
          </div>
        ) : questions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
            <HelpCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma dúvida encontrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <Link
                key={q.id}
                to="/doubts/$id"
                params={{ id: q.id }}
                className="glass block cursor-pointer space-y-1.5 rounded-2xl p-4 shadow-card transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      STATUS_CLASS[q.status],
                    )}
                  >
                    {STATUS_LABELS[q.status]}
                  </span>
                  <span className="text-sm font-semibold">{q.title}</span>
                </div>
                {q.content ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{q.content}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  {q.author_name ? <span>{q.author_name}</span> : null}
                  <span>{formatDate(q.created_at)}</span>
                  <span>{q.answers_count} respostas</span>
                  <span>{q.views_count} visualizações</span>
                </div>
              </Link>
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
                className="min-h-[100px]"
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
