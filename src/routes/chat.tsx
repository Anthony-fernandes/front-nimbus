import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  CheckCheck,
  Copy,
  Forward,
  MailOpen,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/services/api";
import {
  archiveConversation,
  convertConversationToTicket,
  createChatConversation,
  deleteChatMessage,
  forwardChatMessage,
  listChatConversations,
  listChatMessages,
  markConversationUnread,
  markMessageRead,
  pinChatMessage,
  reactToMessage,
  sendChatFile,
  sendChatMessage,
  updateChatMessage,
} from "@/services/chatService";
import { getAccessToken, getStoredUser } from "@/services/session";
import { listUsers } from "@/services/userService";
import { getUserDisplayName } from "@/lib/auth";
import type { ChatMessage } from "@/lib/types";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat · NimbusDesk" }] }),
  component: ChatPage,
});

/* ─── helpers ─── */
function buildWsUrl(conversationId: string, token: string): string {
  const base = API_BASE_URL.replace(/\/api$/, "");
  const wsBase = base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  return `${wsBase}/ws/chat/${conversationId}/?token=${token}`;
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isRecentlyActive(lastMessageAt?: string | null): boolean {
  if (!lastMessageAt) return false;
  const d = new Date(lastMessageAt);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 5 * 60 * 1000;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded px-0.5 bg-yellow-200 dark:bg-yellow-800">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "oklch(0.55 0.14 30)",
  "oklch(0.52 0.13 200)",
  "oklch(0.54 0.14 280)",
  "oklch(0.55 0.14 140)",
  "oklch(0.56 0.14 80)",
  "oklch(0.52 0.15 350)",
  "oklch(0.54 0.13 230)",
  "oklch(0.56 0.13 50)",
];
function avatarColor(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const EMOJI_QUICK = ["👍", "❤️", "😂", "😮", "😢", "👏"];
const FILTER_LABELS = ["Todos", "Não lidos", "Arquivados"] as const;
type FilterKey = (typeof FILTER_LABELS)[number];

/* ─── sub-components ─── */
function ConvAvatar({ label, size = 40 }: { label: string; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ background: avatarColor(label || "?"), width: size, height: size, fontSize: size * 0.37 }}
    >
      {initials(label || "?")}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ─── main page ─── */
function ChatPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = getStoredUser();
  const isStaff =
    !!(user as { is_staff?: boolean } | null)?.is_staff ||
    !!(user as { is_superuser?: boolean } | null)?.is_superuser;

  /* conversation selection */
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  /* sidebar */
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("Todos");

  /* new conversation dialog */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");

  /* composer */
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* message interactions */
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);

  /* conversation context menu */
  const [convMenuId, setConvMenuId] = useState<string | null>(null);
  const convMenuRef = useRef<HTMLDivElement | null>(null);

  /* message search */
  const [messageSearchVisible, setMessageSearchVisible] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");

  /* typing */
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* websocket refs */
  const wsRef = useRef<WebSocket | null>(null);
  const notifWsRef = useRef<WebSocket | null>(null);
  const wsConnected = useRef(false);
  const selectedConvRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { selectedConvRef.current = selectedConversationId; }, [selectedConversationId]);

  /* close conv menu on outside click */
  useEffect(() => {
    if (!convMenuId) return;
    function handleClick(e: MouseEvent) {
      if (convMenuRef.current && !convMenuRef.current.contains(e.target as Node))
        setConvMenuId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [convMenuId]);

  /* close emoji picker on outside click */
  useEffect(() => {
    if (!emojiPickerMessageId) return;
    function handleClick() { setEmojiPickerMessageId(null); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [emojiPickerMessageId]);

  /* queries */
  const conversationsQuery = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: listChatConversations,
    refetchInterval: 15_000,
  });

  const usersQuery = useQuery({
    queryKey: ["users-list"],
    queryFn: () => listUsers(),
  });

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", selectedConversationId],
    queryFn: () => (selectedConversationId ? listChatMessages(selectedConversationId) : Promise.resolve([])),
    enabled: !!selectedConversationId,
    refetchInterval: 4_000,
  });

  useEffect(() => {
    if (messagesQuery.data) setMessages(messagesQuery.data);
  }, [messagesQuery.data]);

  /* mark messages read */
  useEffect(() => {
    if (!user || !messages.length) return;
    const unread = messages.filter(
      (m) => m.author !== user.id && !(m.read_by_ids ?? []).includes(String(user.id)),
    );
    for (const msg of unread) markMessageRead(msg.id).catch(() => null);
  }, [messages, user]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const optIdx = prev.findIndex(
        (m) => m.id.startsWith("opt-") && m.author === msg.author && m.content === msg.content,
      );
      if (optIdx !== -1) {
        const next = [...prev];
        next[optIdx] = msg;
        return next;
      }
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  /* global notification WS */
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const base = API_BASE_URL.replace(/\/api$/, "");
    const wsBase = base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsBase}/ws/notifications/?token=${token}`);
      notifWsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as Partial<ChatMessage> & { event?: string };
          if (data.event === "chat.new_message") {
            if (data.conversation && data.conversation !== selectedConvRef.current) {
              void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
              toast(`💬 ${data.author_name || "Alguém"}: ${(data.content ?? "").slice(0, 60)}`);
            }
          }
        } catch { /* ignore */ }
      };
    } catch { /* WS unavailable */ }
    return () => { ws?.close(); notifWsRef.current = null; };
  }, [queryClient]);

  /* conversation WS */
  useEffect(() => {
    if (!selectedConversationId) return;
    const token = getAccessToken();
    if (!token) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(buildWsUrl(selectedConversationId, token));
      wsRef.current = ws;
      ws.onopen = () => { wsConnected.current = true; };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as Partial<ChatMessage> & { type?: string; author_name?: string };
          if (data.type === "typing") {
            const author = data.author_name ?? "Alguém";
            setPeerTyping(author);
            if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
            peerTypingTimerRef.current = setTimeout(() => setPeerTyping(null), 3000);
            return;
          }
          if (data.id && data.content) {
            appendMessage(data as ChatMessage);
            void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { wsConnected.current = false; };
      ws.onerror = () => { wsConnected.current = false; };
    } catch { /* WS unavailable */ }
    return () => {
      ws?.close(); wsRef.current = null; wsConnected.current = false;
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      setPeerTyping(null);
    };
  }, [selectedConversationId, appendMessage, queryClient]);

  /* scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* typing debounce */
  function handleInputChange(value: string) {
    setInputText(value);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: "typing" }));
    }, 1000);
  }

  /* mutations */
  const createConvMutation = useMutation({
    mutationFn: (participantIds: string[]) => createChatConversation(participantIds),
    onSuccess: (conv) => {
      toast.success("Conversa criada.");
      setDialogOpen(false);
      setSelectedParticipants([]);
      setParticipantSearch("");
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      setSelectedConversationId(conv.id);
    },
    onError: () => toast.error("Não foi possível criar a conversa."),
  });

  const sendFileMutation = useMutation({
    mutationFn: (file: File) => sendChatFile(selectedConversationId!, file),
    onSuccess: (msg) => {
      appendMessage(msg);
      setPendingFile(null);
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: () => toast.error("Não foi possível enviar o arquivo."),
  });

  function handleSend() {
    if (!selectedConversationId) return;
    if (pendingFile) { sendFileMutation.mutate(pendingFile); return; }
    if (!inputText.trim()) return;
    const content = inputText.trim();
    const replyToId = replyingTo?.id;
    setInputText("");
    setReplyingTo(null);
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      conversation: selectedConversationId,
      author: user?.id ?? "",
      author_name: user ? ((user as { display_name?: string }).display_name ?? "") : "",
      content,
      file: null,
      file_name: null,
      reply_to: replyToId ?? null,
      reply_to_preview: replyingTo?.content?.slice(0, 60) ?? null,
      reply_to_author: replyingTo?.author_name ?? null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content, reply_to: replyToId }));
    } else {
      sendChatMessage(selectedConversationId, content, replyToId)
        .then((msg) => setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m))))
        .catch(() => {
          toast.error("Não foi possível enviar a mensagem.");
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        });
    }
  }

  function startEditing(msg: ChatMessage) {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content ?? "");
    setHoveredMessageId(null);
  }

  async function saveEdit(msgId: string) {
    if (!editingContent.trim()) return;
    try {
      const updated = await updateChatMessage(msgId, editingContent.trim());
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...updated, is_edited: true } : m)));
      setEditingMessageId(null);
      setEditingContent("");
    } catch { toast.error("Não foi possível editar a mensagem."); }
  }

  function cancelEdit() { setEditingMessageId(null); setEditingContent(""); }

  async function handleDelete(msgId: string) {
    if (!window.confirm("Remover esta mensagem?")) return;
    try {
      await deleteChatMessage(msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      toast("Mensagem removida.");
    } catch { toast.error("Não foi possível remover a mensagem."); }
  }

  async function handlePin(msgId: string) {
    try {
      await pinChatMessage(msgId);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, is_pinned: !m.is_pinned } : m)));
    } catch { toast.error("Não foi possível fixar a mensagem."); }
  }

  async function handleReact(msgId: string, emoji: string) {
    setEmojiPickerMessageId(null);
    try {
      await reactToMessage(msgId, emoji);
      void queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedConversationId] });
    } catch { toast.error("Não foi possível reagir à mensagem."); }
  }

  async function handleForward(targetConvId: string) {
    if (!forwardMessageId) return;
    try {
      await forwardChatMessage(forwardMessageId, targetConvId);
      setForwardMessageId(null);
      toast.success("Mensagem encaminhada.");
    } catch { toast.error("Não foi possível encaminhar a mensagem."); }
  }

  async function handleConvertToTicket(convId: string) {
    setConvMenuId(null);
    try {
      const res = await convertConversationToTicket(convId);
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      if (res?.detail) toast.info(res.detail);
      else toast.success(`Chamado ${res?.code || ""} criado a partir da conversa.`);
    } catch { toast.error("Não foi possível criar o chamado."); }
  }

  async function handleArchive(convId: string) {
    setConvMenuId(null);
    try {
      await archiveConversation(convId);
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      toast.success("Conversa arquivada.");
      if (selectedConversationId === convId) setSelectedConversationId(null);
    } catch { toast.error("Não foi possível arquivar a conversa."); }
  }

  async function handleMarkUnread(convId: string) {
    setConvMenuId(null);
    try {
      await markConversationUnread(convId);
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      toast.success("Marcado como não lida.");
    } catch { toast.error("Não foi possível marcar como não lida."); }
  }

  const allConversations = conversationsQuery.data ?? [];

  function getConvLabel(conv: (typeof allConversations)[number]) {
    if (conv.participant_names?.length) {
      return (
        conv.participant_names
          .filter((n) => n !== (user as { display_name?: string } | null)?.display_name)
          .join(", ") || conv.participant_names.join(", ")
      );
    }
    return `Conversa ${conv.id.slice(0, 8)}`;
  }

  const filteredConversations = allConversations.filter((conv) => {
    if (filter === "Arquivados") return !!conv.is_archived;
    if (conv.is_archived) return false;
    if (filter === "Não lidos") return (conv.unread_count ?? 0) > 0;
    if (sidebarSearch.trim().length >= 2)
      return getConvLabel(conv).toLowerCase().includes(sidebarSearch.toLowerCase());
    return true;
  });

  const displayedMessages = messageSearch.trim()
    ? messages.filter((m) => m.content?.toLowerCase().includes(messageSearch.toLowerCase()))
    : messages;

  const pinnedMessages = messages.filter((m) => m.is_pinned);
  const forwardConversations = allConversations.filter((c) => c.id !== selectedConversationId);
  const activeConv = allConversations.find((c) => c.id === selectedConversationId);
  const activeConvLabel = activeConv ? getConvLabel(activeConv) : "";
  const activeIsRecent = isRecentlyActive(activeConv?.last_message_at);

  const currentUserName =
    (user as { display_name?: string; username?: string } | null)?.display_name ||
    (user as { username?: string } | null)?.username ||
    "Você";

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-2xl shadow-card glass">
        {/* ── sidebar ── */}
        <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-border bg-card/60">
          {/* header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex min-w-0 items-center gap-3">
              <ConvAvatar label={currentUserName} size={36} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{currentUserName}</div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> online
                </div>
              </div>
            </div>
            <IconBtn title="Nova conversa" onClick={() => setDialogOpen(true)}>
              <Plus size={18} />
            </IconBtn>
          </div>

          {/* search */}
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <Search size={15} className="shrink-0 text-muted-foreground" />
              <input
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Pesquisar conversas"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {sidebarSearch && (
                <button type="button" onClick={() => setSidebarSearch("")}>
                  <X size={14} className="text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* filter pills */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5">
            {FILTER_LABELS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="px-6 py-10 text-center text-xs text-muted-foreground">Carregando...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-6 py-10 text-center text-xs text-muted-foreground">
                Nenhuma conversa encontrada.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const label = getConvLabel(conv);
                const isActive = selectedConversationId === conv.id;
                const unread = conv.unread_count ?? 0;
                const recent = isRecentlyActive(conv.last_message_at);
                return (
                  <div key={conv.id} className="relative group/conv">
                    <button
                      type="button"
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-3 text-left transition",
                        isActive
                          ? "border-l-[3px] border-primary bg-primary/8 pl-[calc(0.75rem-3px)]"
                          : "border-l-[3px] border-transparent hover:bg-muted/40",
                        conv.is_archived && "opacity-50",
                      )}
                    >
                      <div className="relative shrink-0">
                        <ConvAvatar label={label} size={44} />
                        {recent && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            {sidebarSearch.trim().length >= 2
                              ? highlightText(label, sidebarSearch)
                              : label}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[11px]",
                              unread > 0 ? "text-primary font-medium" : "text-muted-foreground",
                            )}
                          >
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {conv.is_archived ? "Arquivada" : ""}
                          </span>
                          {unread > 0 && (
                            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* context menu toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvMenuId(convMenuId === conv.id ? null : conv.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover/conv:opacity-100"
                      aria-label="Opções"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {convMenuId === conv.id && (
                      <div
                        ref={convMenuRef}
                        className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => void handleConvertToTicket(conv.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-muted"
                        >
                          <Ticket size={14} /> Criar chamado
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleArchive(conv.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-muted"
                        >
                          <Archive size={14} /> Arquivar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMarkUnread(conv.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-muted"
                        >
                          <MailOpen size={14} /> Marcar não lida
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── chat area ── */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {!selectedConversationId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted text-4xl">💬</div>
              <p className="text-sm">Selecione uma conversa para começar</p>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Plus size={14} /> Nova conversa
              </Button>
            </div>
          ) : (
            <>
              {/* chat header */}
              <div className="flex h-14 items-center justify-between border-b border-border bg-card/60 px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <ConvAvatar label={activeConvLabel} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{activeConvLabel}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {peerTyping ? (
                        <span className="italic text-primary">{peerTyping} está digitando…</span>
                      ) : activeIsRecent ? (
                        "ativo recentemente"
                      ) : (
                        ""
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconBtn
                    title="Abrir chamado"
                    onClick={() => void navigate({ to: "/tickets/new" })}
                  >
                    <Ticket size={18} />
                  </IconBtn>
                  <IconBtn
                    title={messageSearchVisible ? "Fechar busca" : "Buscar mensagens"}
                    onClick={() => { setMessageSearchVisible((v) => !v); setMessageSearch(""); }}
                  >
                    {messageSearchVisible ? <X size={18} /> : <Search size={18} />}
                  </IconBtn>
                </div>
              </div>

              {/* message search bar */}
              {messageSearchVisible && (
                <div className="border-b border-border bg-card px-4 py-2">
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
                    <Search size={14} className="shrink-0 text-muted-foreground" />
                    <input
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Buscar mensagens..."
                      autoFocus
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    {messageSearch && (
                      <button type="button" onClick={() => setMessageSearch("")}>
                        <X size={13} className="text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* pinned messages */}
              {pinnedMessages.length > 0 && (
                <div className="border-b border-border bg-card px-4 py-2 space-y-1">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Pin size={11} /> Fixadas
                  </p>
                  {pinnedMessages.map((pm) => (
                    <div
                      key={pm.id}
                      className="line-clamp-1 rounded bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{pm.author_name}: </span>
                      {pm.content}
                    </div>
                  ))}
                </div>
              )}

              {/* messages */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1">
                {displayedMessages.map((msg) => {
                  const isOwn = msg.author === user?.id;
                  const isEditing = editingMessageId === msg.id;
                  const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;

                  return (
                    <div
                      key={msg.id}
                      className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}
                    >
                      {msg.is_pinned && (
                        <div className="mb-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                          <Pin size={10} /> fixado
                        </div>
                      )}
                      {msg.forward_from && (
                        <div className="mb-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                          <Forward size={10} /> encaminhado
                        </div>
                      )}

                      <div
                        className={cn("group flex", isOwn ? "justify-end" : "justify-start")}
                        onMouseEnter={() => setHoveredMessageId(msg.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                      >
                        {/* hover toolbar — incoming */}
                        {!isOwn && hoveredMessageId === msg.id && !isEditing && (
                          <MessageActions
                            isOwn={false}
                            isStaff={isStaff}
                            msg={msg}
                            emojiPickerOpen={emojiPickerMessageId === msg.id}
                            onToggleEmoji={(e) => {
                              e.stopPropagation();
                              setEmojiPickerMessageId(emojiPickerMessageId === msg.id ? null : msg.id);
                            }}
                            onReact={(em) => void handleReact(msg.id, em)}
                            onReply={() => setReplyingTo(msg)}
                            onPin={() => void handlePin(msg.id)}
                            onForward={() => setForwardMessageId(msg.id)}
                            onEdit={() => startEditing(msg)}
                            onDelete={() => void handleDelete(msg.id)}
                          />
                        )}

                        {/* bubble */}
                        <div
                          className={cn(
                            "relative max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                            isOwn
                              ? "rounded-tr-sm bg-gradient-primary text-white"
                              : "rounded-tl-sm border border-border/60 bg-card/80 text-foreground",
                          )}
                        >
                          {!isOwn && msg.author_name && (
                            <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                              {msg.author_name}
                            </p>
                          )}

                          {msg.reply_to && (
                            <div
                              className={cn(
                                "mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[10px]",
                                isOwn
                                  ? "border-white/50 bg-white/15"
                                  : "border-primary/40 bg-primary/5",
                              )}
                            >
                              {msg.reply_to_author && (
                                <p className="font-semibold opacity-80">{msg.reply_to_author}</p>
                              )}
                              <p className="line-clamp-1 opacity-70">{msg.reply_to_preview}</p>
                            </div>
                          )}

                          {(msg.file_url || msg.file) ? (
                            /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file_name ?? "") ? (
                              <img
                                src={msg.file_url || msg.file!}
                                alt={msg.file_name ?? "imagem"}
                                className="mb-1 max-h-48 rounded-lg object-contain"
                              />
                            ) : (
                              <a
                                href={msg.file_url || msg.file!}
                                download={msg.file_name ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "mb-1 flex items-center gap-1.5 text-xs underline underline-offset-2",
                                  isOwn ? "text-white/90" : "text-primary",
                                )}
                              >
                                <Paperclip size={12} className="shrink-0" />
                                {msg.file_name ?? "arquivo"}
                              </a>
                            )
                          ) : null}

                          {isEditing ? (
                            <div className="mt-1 flex items-center gap-1">
                              <input
                                className="flex-1 rounded border border-white/30 bg-white/20 px-2 py-0.5 text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60"
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); void saveEdit(msg.id); }
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                autoFocus
                              />
                              <button type="button" onClick={() => void saveEdit(msg.id)} className="p-0.5 opacity-80 hover:opacity-100">
                                <Check size={14} />
                              </button>
                              <button type="button" onClick={cancelEdit} className="p-0.5 opacity-80 hover:opacity-100">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            msg.content ? (
                              <p className="whitespace-pre-wrap break-words">
                                {highlightText(msg.content, messageSearch)}
                              </p>
                            ) : null
                          )}

                          <div
                            className={cn(
                              "mt-1 flex items-center gap-1 text-[10px]",
                              isOwn ? "justify-end text-white/70" : "text-muted-foreground",
                            )}
                          >
                            <span>{formatTime(msg.created_at)}</span>
                            {msg.is_edited && <span className="opacity-70">· editado</span>}
                            {isOwn &&
                              ((msg.read_by_ids ?? []).some((id) => String(id) !== String(user?.id)) ? (
                                <CheckCheck size={13} className="text-blue-300" />
                              ) : (
                                <Check size={13} className="opacity-60" />
                              ))}
                          </div>

                          {hasReactions && (
                            <div className={cn("absolute -bottom-3", isOwn ? "right-2" : "left-2")}>
                              <div className="flex gap-0.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-xs shadow-sm">
                                {Object.entries(msg.reactions ?? {}).map(([emoji, userIds]) =>
                                  userIds.length ? (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => void handleReact(msg.id, emoji)}
                                      className="transition hover:scale-125"
                                    >
                                      {emoji}
                                    </button>
                                  ) : null,
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* hover toolbar — own messages */}
                        {isOwn && hoveredMessageId === msg.id && !isEditing && (
                          <MessageActions
                            isOwn={true}
                            isStaff={isStaff}
                            msg={msg}
                            emojiPickerOpen={emojiPickerMessageId === msg.id}
                            onToggleEmoji={(e) => {
                              e.stopPropagation();
                              setEmojiPickerMessageId(emojiPickerMessageId === msg.id ? null : msg.id);
                            }}
                            onReact={(em) => void handleReact(msg.id, em)}
                            onReply={() => setReplyingTo(msg)}
                            onPin={() => void handlePin(msg.id)}
                            onForward={() => setForwardMessageId(msg.id)}
                            onEdit={() => startEditing(msg)}
                            onDelete={() => void handleDelete(msg.id)}
                          />
                        )}
                      </div>

                      {/* reactions below bubble */}
                      {hasReactions && <div className="mb-3" />}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* composer */}
              <div className="border-t border-border bg-card/60 p-3 space-y-2">
                {replyingTo && (
                  <div className="flex items-center gap-3 rounded-lg border-l-4 border-primary bg-muted px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-primary">
                        {replyingTo.author === user?.id ? "Você" : replyingTo.author_name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {replyingTo.content ?? "Mídia"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="shrink-0 opacity-60 transition hover:opacity-100"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {pendingFile && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
                    <Paperclip size={13} className="shrink-0 text-primary" />
                    <span className="flex-1 truncate text-muted-foreground">{pendingFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      className="shrink-0 opacity-60 transition hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPendingFile(file);
                      e.target.value = "";
                    }}
                  />
                  <IconBtn title="Anexar arquivo" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip size={20} />
                  </IconBtn>
                  <textarea
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    rows={1}
                    disabled={!!pendingFile}
                    placeholder={pendingFile ? "Adicionar mensagem (opcional)..." : "Digite uma mensagem"}
                    className="scrollbar-thin max-h-32 min-h-10 flex-1 resize-none rounded-xl bg-muted px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  {inputText.trim() || pendingFile ? (
                    <button
                      type="button"
                      onClick={handleSend}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
                    >
                      <Send size={18} />
                    </button>
                  ) : (
                    <IconBtn title="Enviar">
                      <Send size={20} />
                    </IconBtn>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* new conversation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Buscar participantes</Label>
              <Input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Nome ou e-mail..."
                autoFocus
              />
            </div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="space-y-0.5 p-1">
                {(usersQuery.data || [])
                  .filter((u) => {
                    if (!participantSearch.trim()) return true;
                    const q = participantSearch.toLowerCase();
                    return (
                      getUserDisplayName(u).toLowerCase().includes(q) ||
                      (u.email || "").toLowerCase().includes(q)
                    );
                  })
                  .filter((u) => u.id !== user?.id)
                  .map((u) => {
                    const selected = selectedParticipants.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() =>
                          setSelectedParticipants((prev) =>
                            selected ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition hover:bg-muted",
                          selected && "bg-primary/10 font-medium",
                        )}
                      >
                        <ConvAvatar label={getUserDisplayName(u)} size={28} />
                        <span className="flex-1 truncate">
                          {getUserDisplayName(u)}
                          {u.email && (
                            <span className="ml-1 text-xs text-muted-foreground">({u.email})</span>
                          )}
                        </span>
                        {selected && <Check size={14} className="shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                {usersQuery.isLoading && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Carregando...</p>
                )}
                {!usersQuery.isLoading && (usersQuery.data || []).length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
                )}
              </div>
            </ScrollArea>
            {selectedParticipants.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedParticipants.length} participante(s) selecionado(s)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedParticipants.length === 0) return;
                createConvMutation.mutate(selectedParticipants);
              }}
              disabled={createConvMutation.isPending || selectedParticipants.length === 0}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* forward message dialog */}
      <Dialog
        open={!!forwardMessageId}
        onOpenChange={(open) => { if (!open) setForwardMessageId(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Encaminhar mensagem</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-64 rounded-md border">
            <div className="space-y-0.5 p-1">
              {forwardConversations.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma outra conversa.</p>
              )}
              {forwardConversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => void handleForward(conv.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition hover:bg-muted"
                >
                  <ConvAvatar label={getConvLabel(conv)} size={28} />
                  {getConvLabel(conv)}
                </button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardMessageId(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* ── message action toolbar ── */
function MessageActions({
  isOwn,
  isStaff,
  msg,
  emojiPickerOpen,
  onToggleEmoji,
  onReact,
  onReply,
  onPin,
  onForward,
  onEdit,
  onDelete,
}: {
  isOwn: boolean;
  isStaff: boolean;
  msg: ChatMessage;
  emojiPickerOpen: boolean;
  onToggleEmoji: (e: React.MouseEvent) => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onPin: () => void;
  onForward: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "relative self-center flex items-center gap-0.5 rounded-full border border-border bg-card px-1 py-0.5 shadow-md",
        isOwn ? "mr-2" : "ml-2",
      )}
    >
      <button
        type="button"
        onClick={onToggleEmoji}
        className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Reagir"
      >
        <Smile size={14} />
      </button>
      {emojiPickerOpen && (
        <div
          className={cn(
            "absolute bottom-full z-50 mb-1 flex gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-lg",
            isOwn ? "right-0" : "left-0",
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {EMOJI_QUICK.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onReact(e)}
              className="p-0.5 text-base transition hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onReply}
        className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Responder"
      >
        <Reply size={14} />
      </button>
      <button
        type="button"
        onClick={onForward}
        className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Encaminhar"
      >
        <Forward size={14} />
      </button>
      {msg.content && (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(msg.content)}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="Copiar"
        >
          <Copy size={14} />
        </button>
      )}
      {isStaff && (
        <button
          type="button"
          onClick={onPin}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="Fixar"
        >
          <Pin size={14} />
        </button>
      )}
      {isOwn && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="Editar"
        >
          <Pencil size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="rounded-full p-1.5 text-destructive transition hover:bg-destructive/10"
        title="Excluir"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
