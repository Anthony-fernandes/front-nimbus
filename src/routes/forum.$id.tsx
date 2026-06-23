import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Flag,
  Lock, Pencil, Pin, PinOff, Tag, Trash2, Unlock,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import "highlight.js/styles/github-dark.css";

import { AppShell } from "@/components/app/AppShell";
import { MarkdownEditor } from "@/components/app/MarkdownEditor";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ForumComment, ForumReply, ForumTopic } from "@/lib/types";
import {
  convertForumTopicToKb, createForumComment, createForumReply,
  deleteForumComment, deleteForumReply, deleteForumTopic, flagContent,
  getForumTopic, listForumComments, listForumReplies, listForumReplyEdits,
  listForumTopicEdits, listKnowledgeCategories,
  lockForumTopic, markBestAnswer, pinForumTopic, toggleReplyDownvote,
  toggleReplyLike, toggleTopicDownvote, toggleTopicLike,
  updateForumReply, updateForumTopic,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);

marked.setOptions({ gfm: true, breaks: true });

export const Route = createFileRoute("/forum/$id")({
  head: () => ({ meta: [{ title: "Tópico · Nimbus" }] }),
  component: ForumTopicPage,
});

function renderMd(content: string) {
  return DOMPurify.sanitize(marked.parse(content) as string);
}

function fmtDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Vote column (Stack Overflow style ▲ score ▼) ────────────────────────────

function VoteColumn({
  score, onUpvote, onDownvote, accepted, onAccept, canAccept,
}: {
  score: number;
  onUpvote: () => void;
  onDownvote: () => void;
  accepted?: boolean;
  onAccept?: () => void;
  canAccept?: boolean;
}) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onUpvote}
        aria-label="Voto positivo"
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border/40 text-muted-foreground transition-all hover:border-orange-400 hover:text-orange-400 hover:bg-orange-400/5"
      >
        {/* triangle up */}
        <svg viewBox="0 0 36 36" className="h-5 w-5 fill-current"><path d="M2 26 18 6 34 26z" /></svg>
      </button>
      <span className={cn("py-0.5 text-xl font-bold leading-none tabular-nums", score > 0 ? "text-orange-400" : score < 0 ? "text-red-500" : "text-muted-foreground")}>
        {score}
      </span>
      <button
        type="button"
        onClick={onDownvote}
        aria-label="Voto negativo"
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border/40 text-muted-foreground transition-all hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/5"
      >
        {/* triangle down */}
        <svg viewBox="0 0 36 36" className="h-5 w-5 fill-current"><path d="M2 10 18 30 34 10z" /></svg>
      </button>
      {(accepted || canAccept) && (
        <button
          type="button"
          onClick={onAccept}
          disabled={!canAccept}
          aria-label={accepted ? "Melhor resposta" : "Marcar como melhor resposta"}
          title={accepted ? "Melhor resposta" : "Marcar como melhor resposta"}
          className={cn(
            "mt-2 flex h-10 w-10 items-center justify-center rounded-full transition-all",
            accepted ? "text-green-500 cursor-default" : "text-muted-foreground/30 hover:text-green-500 hover:bg-green-500/10",
          )}
        >
          <CheckCircle2 className="h-7 w-7" strokeWidth={accepted ? 2.5 : 1.5} />
        </button>
      )}
    </div>
  );
}

// ─── Author card ──────────────────────────────────────────────────────────────

function AuthorCard({ name, date, label, authorId, reputation }: { name?: string; date?: string; label: string; authorId?: string; reputation?: number }) {
  const initials = name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?";
  const content = (
    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 min-w-[150px] space-y-1">
      <p className="text-[10px] text-muted-foreground">{label} {fmtDate(date)}</p>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-blue-500/20 grid place-items-center text-[11px] font-bold text-blue-400 shrink-0">
          {initials}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-blue-400 truncate max-w-[100px]">{name ?? "Usuário"}</span>
          {reputation !== undefined && reputation > 0 && (
            <span className="text-[10px] text-muted-foreground">{reputation} pts</span>
          )}
        </div>
      </div>
    </div>
  );
  if (authorId) {
    return (
      <Link to="/forum/users/$id" params={{ id: authorId }} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}

// ─── Edit History ─────────────────────────────────────────────────────────────

function EditHistoryButton({ topicId, replyId, editCount }: { topicId?: string; replyId?: string; editCount?: number }) {
  const [open, setOpen] = useState(false);
  if (!editCount || editCount === 0) return null;

  const historyQ = useQuery({
    queryKey: ["forum-edit-history", topicId ?? "", replyId ?? ""],
    queryFn: () => topicId ? listForumTopicEdits(topicId) : listForumReplyEdits(replyId!),
    enabled: open,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors italic"
      >
        editado {editCount}×
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de edições ({editCount})</DialogTitle></DialogHeader>
          {historyQ.isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : (
            <div className="space-y-4 py-2">
              {(historyQ.data ?? []).map((edit, i) => (
                <div key={edit.id} className="border border-border/50 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 text-[11px] text-muted-foreground">
                    <span>Edição #{(historyQ.data?.length ?? 0) - i} por <strong className="text-foreground">{edit.editor_name || "Usuário"}</strong></span>
                    <span>{fmtDateTime(edit.created_at)}</span>
                  </div>
                  {topicId && (edit as { old_title?: string }).old_title !== (edit as { new_title?: string }).new_title && (
                    <div className="px-3 py-2 border-b border-border/50 space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Título</p>
                      <p className="text-xs line-through text-red-400/70">{(edit as { old_title: string }).old_title}</p>
                      <p className="text-xs text-green-400">{(edit as { new_title: string }).new_title}</p>
                    </div>
                  )}
                  <div className="px-3 py-2 space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Conteúdo anterior</p>
                    <pre className="text-xs text-red-400/70 whitespace-pre-wrap line-through font-mono bg-red-500/5 rounded p-2 max-h-32 overflow-y-auto">
                      {edit.old_content || "(vazio)"}
                    </pre>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Novo conteúdo</p>
                    <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono bg-green-500/5 rounded p-2 max-h-32 overflow-y-auto">
                      {edit.new_content || "(vazio)"}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Flag button ──────────────────────────────────────────────────────────────

const FLAG_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "conteudo_inadequado", label: "Conteúdo inadequado" },
  { value: "duplicado", label: "Duplicado" },
  { value: "outro", label: "Outro" },
];

function FlagButton({ contentType, objectId }: { contentType: string; objectId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mut = useMutation({
    mutationFn: () => flagContent(contentType, objectId, reason),
    onSuccess: () => { toast.success("Conteúdo sinalizado."); setOpen(false); setReason(""); },
    onError: () => toast.error("Não foi possível sinalizar."),
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-orange-400 transition-colors">
        <Flag className="h-3 w-3" /> Sinalizar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sinalizar conteúdo</DialogTitle></DialogHeader>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Motivo..." /></SelectTrigger>
            <SelectContent>
              {FLAG_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!reason || mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending ? "Enviando..." : "Sinalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Markdown content with syntax highlight ───────────────────────────────────

function MdContent({ content, className }: { content: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el as HTMLElement));
  });
  return (
    <div
      ref={ref}
      className={cn("prose prose-sm dark:prose-invert max-w-none leading-relaxed", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
      dangerouslySetInnerHTML={{ __html: renderMd(content) }}
    />
  );
}

// ─── Inline comments (SO style) ───────────────────────────────────────────────

function CommentsSection({ topicId, replyId, currentUserId }: { topicId?: string; replyId?: string; currentUserId?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const params = topicId ? { topic: topicId } : { reply: replyId };
  const qKey = ["forum-comments", topicId ?? "", replyId ?? ""];

  const q = useQuery({ queryKey: qKey, queryFn: () => listForumComments(params), enabled: open });
  const addMut = useMutation({
    mutationFn: () => createForumComment(topicId ? { topic: topicId, content: text } : { reply: replyId, content: text }),
    onSuccess: () => { setText(""); void qc.invalidateQueries({ queryKey: qKey }); },
    onError: () => toast.error("Não foi possível adicionar o comentário."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteForumComment(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qKey }),
  });

  const comments = (q.data ?? []) as ForumComment[];

  return (
    <div className="mt-4 pt-3 border-t border-border/30">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open && comments.length > 0 ? `${comments.length} comentário${comments.length > 1 ? "s" : ""}` : "Comentários"}
      </button>
      {open && (
        <div className="mt-2">
          {q.isLoading ? (
            <p className="text-[11px] text-muted-foreground">Carregando...</p>
          ) : (
            <ul className="divide-y divide-border/30 mb-2">
              {comments.length === 0 && (
                <li className="py-1.5 text-[11px] text-muted-foreground">Nenhum comentário ainda.</li>
              )}
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2 py-1.5 text-[12px] text-muted-foreground">
                  <span className="flex-1">
                    <span className="font-semibold text-foreground mr-1">{c.author_name ?? "Usuário"}</span>
                    {c.content}
                    <span className="ml-2 text-[10px] opacity-60">{fmtDateTime(c.created_at)}</span>
                  </span>
                  {c.author === currentUserId && (
                    <button type="button" onClick={() => delMut.mutate(c.id)} className="shrink-0 opacity-40 hover:text-destructive hover:opacity-100 transition-all">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Adicionar um comentário..."
              className="h-7 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); addMut.mutate(); } }}
            />
            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 shrink-0" disabled={!text.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ForumTopicPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = getStoredUser();

  const [replyContent, setReplyContent] = useState("");
  const [editTopicOpen, setEditTopicOpen] = useState(false);
  const [editTopic, setEditTopic] = useState({ title: "", content: "", tags: "" });
  const [editReply, setEditReply] = useState<ForumReply | null>(null);
  const [editReplyContent, setEditReplyContent] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertCategory, setConvertCategory] = useState("");

  const topicQ = useQuery({ queryKey: ["forum-topic", id], queryFn: () => getForumTopic(id) });
  const repliesQ = useQuery({ queryKey: ["forum-replies", id], queryFn: () => listForumReplies(id) });
  const catsQ = useQuery({ queryKey: ["knowledge-categories"], queryFn: listKnowledgeCategories, enabled: convertOpen });

  function inv() {
    void qc.invalidateQueries({ queryKey: ["forum-topic", id] });
    void qc.invalidateQueries({ queryKey: ["forum-replies", id] });
    void qc.invalidateQueries({ queryKey: ["forum-topics"] });
  }

  const replyMut = useMutation({
    mutationFn: () => createForumReply({ topic: id, content: replyContent }),
    onSuccess: () => { toast.success("Resposta publicada."); setReplyContent(""); inv(); },
    onError: () => toast.error("Não foi possível enviar a resposta."),
  });
  const topicLikeMut = useMutation({ mutationFn: () => toggleTopicLike(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ["forum-topic", id] }) });
  const topicDownMut = useMutation({ mutationFn: () => toggleTopicDownvote(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ["forum-topic", id] }) });
  const replyLikeMut = useMutation({ mutationFn: (rid: string) => toggleReplyLike(rid), onSuccess: () => void qc.invalidateQueries({ queryKey: ["forum-replies", id] }) });
  const replyDownMut = useMutation({ mutationFn: (rid: string) => toggleReplyDownvote(rid), onSuccess: () => void qc.invalidateQueries({ queryKey: ["forum-replies", id] }) });
  const bestMut = useMutation({ mutationFn: (rid: string) => markBestAnswer(id, rid), onSuccess: () => { toast.success("Melhor resposta marcada."); inv(); } });
  const updTopicMut = useMutation({
    mutationFn: (data: Partial<ForumTopic>) => updateForumTopic(id, data),
    onSuccess: () => { toast.success("Tópico atualizado."); setEditTopicOpen(false); inv(); },
    onError: () => toast.error("Não foi possível atualizar."),
  });
  const delTopicMut = useMutation({
    mutationFn: () => deleteForumTopic(id),
    onSuccess: () => { toast.success("Tópico removido."); void navigate({ to: "/forum" }); },
    onError: () => toast.error("Não foi possível remover."),
  });
  const updReplyMut = useMutation({
    mutationFn: ({ rid, content }: { rid: string; content: string }) => updateForumReply(rid, { content }),
    onSuccess: () => { toast.success("Resposta atualizada."); setEditReply(null); void qc.invalidateQueries({ queryKey: ["forum-replies", id] }); },
    onError: () => toast.error("Não foi possível atualizar."),
  });
  const delReplyMut = useMutation({
    mutationFn: (rid: string) => deleteForumReply(rid),
    onSuccess: () => { toast.success("Resposta removida."); inv(); },
    onError: () => toast.error("Não foi possível remover."),
  });
  const pinMut = useMutation({ mutationFn: () => pinForumTopic(id), onSuccess: () => { toast.success("Status atualizado."); inv(); }, onError: () => toast.error("Ação não permitida.") });
  const lockMut = useMutation({ mutationFn: () => lockForumTopic(id), onSuccess: () => { toast.success("Status atualizado."); inv(); }, onError: () => toast.error("Ação não permitida.") });
  const convertMut = useMutation({
    mutationFn: () => convertForumTopicToKb(id, convertCategory || undefined),
    onSuccess: (article) => {
      setConvertOpen(false);
      toast.success("Artigo criado!", { action: { label: "Ver artigo →", onClick: () => navigate({ to: "/knowledge/$id", params: { id: article.id } }) } });
    },
    onError: () => toast.error("Não foi possível converter."),
  });

  const topic = topicQ.data;
  const isAuthor = topic?.author === user?.id;
  const isAdmin = user?.is_staff || user?.is_superuser;

  const replies = [...(repliesQ.data ?? [])].sort((a, b) => {
    if (a.is_best_answer && !b.is_best_answer) return -1;
    if (!a.is_best_answer && b.is_best_answer) return 1;
    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  });

  const topicScore =
    ((topic as unknown as { likes_count?: number })?.likes_count ?? 0) -
    ((topic as unknown as { downvotes_count?: number })?.downvotes_count ?? 0);

  return (
    <AppShell>
      <div className="max-w-4xl">
        {/* Breadcrumb */}
        <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/forum" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Fórum
          </Link>
          {topic?.category_name && <><span>/</span><span>{topic.category_name}</span></>}
          {topic?.title && <><span>/</span><span className="text-foreground font-medium line-clamp-1 max-w-xs">{topic.title}</span></>}
        </nav>

        {topicQ.isLoading ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Carregando tópico...</div>
        ) : !topic ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Tópico não encontrado.</div>
        ) : (
          <>
            {/* ── Question header (title + meta, full-width like SO) ── */}
            <div className="border-b border-border/50 pb-5 mb-6">
              <h1 className="text-xl font-semibold leading-snug mb-3">{topic.title}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>Perguntado em <strong className="text-foreground font-medium">{fmtDate(topic.created_at)}</strong></span>
                <span>Visualizações <strong className="text-foreground font-medium">{topic.views_count ?? 0}</strong></span>
                {topic.is_pinned && <span className="flex items-center gap-1 text-primary font-medium"><Pin className="h-3 w-3" /> Fixado</span>}
                {topic.is_locked && <span className="flex items-center gap-1 text-yellow-500 font-medium"><Lock className="h-3 w-3" /> Fechado</span>}
              </div>
            </div>

            {/* ── Question body ── */}
            <div className="flex gap-5">
              <VoteColumn
                score={topicScore}
                onUpvote={() => topicLikeMut.mutate()}
                onDownvote={() => topicDownMut.mutate()}
              />
              <div className="flex-1 min-w-0 space-y-4">
                <MdContent content={topic.content} />

                {/* Tags */}
                {(topic.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {topic.tags.map((tag) => (
                      <Link
                        key={tag}
                        to="/forum/tags/$tag"
                        params={{ tag }}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        <Tag className="h-2.5 w-2.5" />{tag}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Action links + Author card */}
                <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <button type="button" onClick={() => setConvertOpen(true)} className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                      <BookOpen className="h-3 w-3" /> Converter para KB
                    </button>
                    {isAuthor && (
                      <>
                        <span className="opacity-30">·</span>
                        <button
                          type="button"
                          onClick={() => { setEditTopic({ title: topic.title, content: topic.content, tags: (topic.tags ?? []).join(", ") }); setEditTopicOpen(true); }}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                        <span className="opacity-30">·</span>
                        <ConfirmDelete
                          title="Excluir tópico?"
                          description="O tópico e todas as respostas serão removidos permanentemente."
                          onConfirm={() => delTopicMut.mutate()}
                          trigger={
                            <button type="button" className="flex items-center gap-1 hover:text-destructive transition-colors">
                              <Trash2 className="h-3 w-3" /> Excluir
                            </button>
                          }
                        />
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <span className="opacity-30">·</span>
                        <button type="button" onClick={() => pinMut.mutate()} className="flex items-center gap-1 hover:text-primary transition-colors">
                          {topic.is_pinned ? <><PinOff className="h-3 w-3" /> Desafixar</> : <><Pin className="h-3 w-3" /> Fixar</>}
                        </button>
                        <span className="opacity-30">·</span>
                        <button type="button" onClick={() => lockMut.mutate()} className="flex items-center gap-1 hover:text-yellow-500 transition-colors">
                          {topic.is_locked ? <><Unlock className="h-3 w-3" /> Reabrir</> : <><Lock className="h-3 w-3" /> Fechar</>}
                        </button>
                      </>
                    )}
                    <span className="opacity-30">·</span>
                    <FlagButton contentType="forum_topic" objectId={topic.id} />
                    <EditHistoryButton
                      topicId={id}
                      editCount={(topic as unknown as { edit_count?: number }).edit_count}
                    />
                  </div>
                  <AuthorCard
                    name={topic.author_name}
                    date={topic.created_at}
                    label="perguntado"
                    authorId={topic.author ?? undefined}
                    reputation={(topic as unknown as { author_reputation?: number }).author_reputation}
                  />
                </div>

                <CommentsSection topicId={id} currentUserId={user?.id} />
              </div>
            </div>

            {/* ── Answers ── */}
            <div className="mt-10 border-t border-border/50 pt-6">
              {replies.length > 0 && (
                <h2 className="text-base font-semibold mb-6">
                  {replies.length} {replies.length === 1 ? "Resposta" : "Respostas"}
                </h2>
              )}

              {repliesQ.isLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Carregando respostas...</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {replies.map((reply) => {
                    const isReplyAuthor = reply.author === user?.id;
                    const replyScore =
                      (reply.likes_count ?? 0) -
                      ((reply as unknown as { downvotes_count?: number }).downvotes_count ?? 0);

                    return (
                      <div
                        key={reply.id}
                        className={cn("flex gap-5 py-7 relative first:pt-0", reply.is_best_answer && "pl-4")}
                      >
                        {reply.is_best_answer && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-green-500" />
                        )}
                        <VoteColumn
                          score={replyScore}
                          onUpvote={() => replyLikeMut.mutate(reply.id)}
                          onDownvote={() => replyDownMut.mutate(reply.id)}
                          accepted={reply.is_best_answer}
                          onAccept={isAuthor && !reply.is_best_answer ? () => bestMut.mutate(reply.id) : undefined}
                          canAccept={isAuthor && !reply.is_best_answer}
                        />
                        <div className="flex-1 min-w-0 space-y-4">
                          {reply.is_best_answer && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-500">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Melhor resposta
                            </span>
                          )}
                          <MdContent content={reply.content} />
                          <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              {isReplyAuthor && (
                                <>
                                  <button type="button" onClick={() => { setEditReply(reply); setEditReplyContent(reply.content); }} className="flex items-center gap-1 hover:text-foreground transition-colors">
                                    <Pencil className="h-3 w-3" /> Editar
                                  </button>
                                  <span className="opacity-30">·</span>
                                  <ConfirmDelete
                                    title="Excluir resposta?"
                                    description="A resposta será removida permanentemente."
                                    onConfirm={() => delReplyMut.mutate(reply.id)}
                                    trigger={
                                      <button type="button" className="flex items-center gap-1 hover:text-destructive transition-colors">
                                        <Trash2 className="h-3 w-3" /> Excluir
                                      </button>
                                    }
                                  />
                                  <span className="opacity-30">·</span>
                                </>
                              )}
                              <FlagButton contentType="forum_reply" objectId={reply.id} />
                              <EditHistoryButton
                                replyId={reply.id}
                                editCount={(reply as unknown as { edit_count?: number }).edit_count}
                              />
                            </div>
                            <AuthorCard
                              name={reply.author_name}
                              date={reply.created_at}
                              label="respondido"
                              authorId={reply.author ?? undefined}
                              reputation={(reply as unknown as { author_reputation?: number }).author_reputation}
                            />
                          </div>
                          <CommentsSection replyId={reply.id} currentUserId={user?.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Reply form ── */}
            <div className="mt-10 border-t border-border/50 pt-6">
              {topic.is_locked ? (
                <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-sm text-yellow-600 dark:text-yellow-400">
                  <Lock className="h-4 w-4 shrink-0" /> Este tópico está fechado para novas respostas.
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Sua resposta</h3>
                  <MarkdownEditor value={replyContent} onChange={setReplyContent} placeholder="Escreva sua resposta em Markdown..." rows={10} />
                  <Button onClick={() => replyMut.mutate()} disabled={replyMut.isPending || !replyContent.trim()} className="gap-1.5">
                    {replyMut.isPending ? "Publicando..." : "Publicar resposta"}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit topic */}
      <Dialog open={editTopicOpen} onOpenChange={setEditTopicOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar tópico</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={editTopic.title} onChange={(e) => setEditTopic((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <MarkdownEditor value={editTopic.content} onChange={(v) => setEditTopic((f) => ({ ...f, content: v }))} rows={10} />
            </div>
            <div className="space-y-1.5">
              <Label>Tags <span className="text-muted-foreground text-xs">(separadas por vírgula)</span></Label>
              <Input value={editTopic.tags} onChange={(e) => setEditTopic((f) => ({ ...f, tags: e.target.value }))} placeholder="tag1, tag2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTopicOpen(false)}>Cancelar</Button>
            <Button disabled={updTopicMut.isPending || !editTopic.title.trim()} onClick={() => updTopicMut.mutate({ title: editTopic.title.trim(), content: editTopic.content.trim(), tags: editTopic.tags.split(",").map((t) => t.trim()).filter(Boolean) })}>
              {updTopicMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit reply */}
      <Dialog open={!!editReply} onOpenChange={(o) => { if (!o) setEditReply(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar resposta</DialogTitle></DialogHeader>
          <MarkdownEditor value={editReplyContent} onChange={setEditReplyContent} rows={10} className="mt-2" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReply(null)}>Cancelar</Button>
            <Button disabled={updReplyMut.isPending || !editReplyContent.trim()} onClick={() => editReply && updReplyMut.mutate({ rid: editReply.id, content: editReplyContent.trim() })}>
              {updReplyMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to KB */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Converter tópico em artigo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Um rascunho será criado na Base de Conhecimento com o conteúdo deste tópico.</p>
            <Select value={convertCategory} onValueChange={setConvertCategory}>
              <SelectTrigger><SelectValue placeholder="Categoria (opcional)" /></SelectTrigger>
              <SelectContent>
                {(catsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancelar</Button>
            <Button onClick={() => convertMut.mutate()} disabled={convertMut.isPending}>
              {convertMut.isPending ? "Convertendo..." : "Converter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
