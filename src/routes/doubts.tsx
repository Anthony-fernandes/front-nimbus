import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HelpCircle, Plus, Search, Star, Tag } from "lucide-react";
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
import {
  createDoubtsQuestion,
  listDoubtsQuestions,
  listKnowledgeArticles,
} from "@/services/knowledgeService";
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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tags: "" });

  // KB suggestions state
  const [kbSearch, setKbSearch] = useState("");
  const kbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kbSuggestionsQuery = useQuery({
    queryKey: ["kb-suggestions", kbSearch],
    queryFn: () => listKnowledgeArticles({ search: kbSearch }),
    enabled: kbSearch.length >= 3,
  });

  // Debounce title → kbSearch
  useEffect(() => {
    if (kbDebounceRef.current) clearTimeout(kbDebounceRef.current);
    kbDebounceRef.current = setTimeout(() => {
      setKbSearch(form.title.length >= 3 ? form.title : "");
    }, 300);
    return () => {
      if (kbDebounceRef.current) clearTimeout(kbDebounceRef.current);
    };
  }, [form.title]);

  const questionsQuery = useQuery({
    queryKey: ["doubts-questions", statusFilter],
    queryFn: () =>
      listDoubtsQuestions(statusFilter !== "all" ? { status: statusFilter } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createDoubtsQuestion({
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Pergunta enviada.");
      setDialogOpen(false);
      setForm({ title: "", content: "", tags: "" });
      void queryClient.invalidateQueries({ queryKey: ["doubts-questions"] });
    },
    onError: () => toast.error("Não foi possível enviar a pergunta."),
  });

  if (pathname !== "/doubts") return <Outlet />;

  const rawQuestions = questionsQuery.data ?? [];
  const filtered = search.trim()
    ? rawQuestions.filter(
        (q) =>
          q.title.toLowerCase().includes(search.toLowerCase()) ||
          q.content?.toLowerCase().includes(search.toLowerCase()),
      )
    : rawQuestions;

  const questions = selectedTag
    ? filtered.filter((q) => q.tags?.includes(selectedTag))
    : filtered;

  const TABS: { label: string; value: StatusFilter }[] = [
    { label: "Todas", value: "all" },
    { label: "Abertas", value: "OPEN" },
    { label: "Respondidas", value: "ANSWERED" },
    { label: "Fechadas", value: "CLOSED" },
  ];

  const kbSuggestions = (kbSuggestionsQuery.data ?? []).slice(0, 3);

  const faqQuery = useQuery({
    queryKey: ["doubts-faq"],
    queryFn: () => listDoubtsQuestions({ status: "ANSWERED", ordering: "-views_count" }),
  });
  const faqQuestions = (faqQuery.data ?? []).slice(0, 4);
  const showFaq = !search.trim() && !selectedTag;

  return (
    <AppShell>
      <div className="space-y-5">
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
        <div className="flex flex-wrap items-center gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  statusFilter === tab.value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-sm w-56"
              placeholder="Buscar dúvidas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Active tag filter chip */}
        {selectedTag && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <Tag className="h-3 w-3" />
              Tag: {selectedTag}
              <button type="button" onClick={() => setSelectedTag(null)} className="ml-1 opacity-60 hover:opacity-100">×</button>
            </span>
          </div>
        )}

        {/* FAQ highlight strip */}
        {showFaq && faqQuestions.length > 0 && (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/30">
            <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-2">
              <Star className="h-3.5 w-3.5 text-warning" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perguntas frequentes</span>
            </div>
            <div className="divide-y divide-border/30">
              {faqQuestions.map((q) => (
                <Link key={q.id} to="/doubts/$id" params={{ id: q.id }}
                  className="flex items-center gap-4 px-4 py-2.5 hover:bg-muted/20 transition-colors group"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  <span className="flex-1 text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">{q.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{q.answers_count} respostas · {q.views_count} visitas</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        {questionsQuery.isLoading ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">Carregando dúvidas...</div>
        ) : questions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-xl p-12 text-center">
            <HelpCircle className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Nenhuma dúvida encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? `Nenhum resultado para "${search}".` : 'Clique em "Nova pergunta" para começar.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/30">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_160px] border-b border-border/50 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Dúvida</span>
              <span className="text-center">Status</span>
              <span className="text-center">Respostas</span>
              <span className="text-center">Visitas</span>
              <span className="text-right">Autor · Data</span>
            </div>
            {questions.map((q) => (
              <div key={q.id} className="grid grid-cols-[1fr_80px_80px_80px_160px] items-center border-b border-border/30 last:border-0 px-4 py-3 hover:bg-muted/20 transition-colors gap-x-2">
                {/* Title + tags */}
                <div className="min-w-0">
                  <Link to="/doubts/$id" params={{ id: q.id }} className="group block">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">{q.title}</p>
                  </Link>
                  {q.tags && q.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {q.tags.map((tag) => (
                        <button key={tag} type="button"
                          onClick={(e) => { e.preventDefault(); setSelectedTag(tag); }}
                          className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium hover:bg-primary/20 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_CLASS[q.status])}>
                    {STATUS_LABELS[q.status]}
                  </span>
                </div>

                {/* Answers */}
                <div className={cn("text-center text-sm font-semibold tabular-nums", q.answers_count > 0 ? "text-foreground" : "text-muted-foreground")}>
                  {q.answers_count}
                </div>

                {/* Views */}
                <div className="text-center text-sm tabular-nums text-muted-foreground">
                  {q.views_count}
                </div>

                {/* Author + date */}
                <div className="text-right text-[11px] text-muted-foreground leading-snug">
                  {q.author_name && <span className="font-medium text-foreground block">{q.author_name}</span>}
                  <span>{formatDate(q.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!questionsQuery.isLoading && questions.length > 0 && (
          <p className="text-xs text-muted-foreground">{questions.length} {questions.length === 1 ? "dúvida" : "dúvidas"}</p>
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

            {/* KB suggestions */}
            {kbSearch.length >= 3 && kbSuggestions.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <p className="text-xs font-medium text-primary">
                  Artigos relacionados na KB — confira antes de perguntar:
                </p>
                <ul className="space-y-1">
                  {kbSuggestions.map((article) => (
                    <li key={article.id}>
                      <a
                        href={`/knowledge/${article.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        {article.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1">
              <Label>Detalhes</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Descreva sua dúvida com mais detalhes..."
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Tags</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Ex: react, typescript, api (separadas por vírgula)"
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
