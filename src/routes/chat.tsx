import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageCircle, Paperclip, Plus, Reply, Search, Send, X } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/services/api";
import {
  createChatConversation,
  listChatConversations,
  listChatMessages,
  sendChatMessage,
  sendChatFile,
} from "@/services/knowledgeService";
import { getAccessToken, getStoredUser } from "@/services/session";
import { listUsers } from "@/services/userService";
import { getUserDisplayName } from "@/lib/auth";
import type { ChatMessage } from "@/lib/types";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat · Nimbus" }] }),
  component: ChatPage,
});

function buildWsUrl(conversationId: string, token: string): string {
  const base = API_BASE_URL.replace(/\/api$/, "");
  const wsBase = base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
  return `${wsBase}/ws/chat/${conversationId}/?token=${token}`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
      <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function ChatPage() {
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [participantInput, setParticipantInput] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // File attachment state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Typing indicator
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Message search
  const [messageSearchVisible, setMessageSearchVisible] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const notifWsRef = useRef<WebSocket | null>(null);
  const wsConnected = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedConvRef = useRef<string | null>(null);

  // Keep ref in sync so WS callbacks can read current value without closure staleness
  useEffect(() => { selectedConvRef.current = selectedConversationId; }, [selectedConversationId]);

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

  // Sync REST messages into state
  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(messagesQuery.data);
    }
  }, [messagesQuery.data]);

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

  // Global notification WebSocket (personal channel)
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const base = API_BASE_URL.replace(/\/api$/, "");
    const wsBase = base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
    const url = `${wsBase}/ws/notifications/?token=${token}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
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
        } catch {
          // ignore
        }
      };
    } catch {
      // WebSocket not available
    }

    return () => {
      ws?.close();
      notifWsRef.current = null;
    };
  }, [queryClient]);

  // Conversation WebSocket connection
  useEffect(() => {
    if (!selectedConversationId) return;

    const token = getAccessToken();
    if (!token) return;

    const url = buildWsUrl(selectedConversationId, token);
    let ws: WebSocket;

    try {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { wsConnected.current = true; };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as Partial<ChatMessage> & { type?: string; author_name?: string };
          // Handle typing indicator
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
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => { wsConnected.current = false; };
      ws.onerror = () => { wsConnected.current = false; };
    } catch {
      // WebSocket not available
    }

    return () => {
      ws?.close();
      wsRef.current = null;
      wsConnected.current = false;
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      setPeerTyping(null);
    };
  }, [selectedConversationId, appendMessage, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send typing notification (debounced 1s)
  function handleInputChange(value: string) {
    setInputText(value);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "typing" }));
      }
    }, 1000);
  }

  const createConvMutation = useMutation({
    mutationFn: (participantIds: string[]) => createChatConversation(participantIds),
    onSuccess: (conv) => {
      toast.success("Conversa criada.");
      setDialogOpen(false);
      setParticipantInput("");
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

    // If there's a pending file, send it first
    if (pendingFile) {
      sendFileMutation.mutate(pendingFile);
      return;
    }

    if (!inputText.trim()) return;

    const content = inputText.trim();
    const replyToId = replyingTo?.id;
    setInputText("");
    setReplyingTo(null);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
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
      wsRef.current.send(JSON.stringify({ type: "message", content, reply_to: replyToId }));
    } else {
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

      sendChatMessage(selectedConversationId, content, replyToId)
        .then((msg) => {
          setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m)));
          void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        })
        .catch(() => {
          toast.error("Não foi possível enviar a mensagem.");
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        });
    }
  }

  const conversations = conversationsQuery.data ?? [];

  function getConvLabel(conv: (typeof conversations)[number]) {
    if (conv.participant_names?.length) {
      return conv.participant_names
        .filter((n) => n !== (user as { display_name?: string } | null)?.display_name)
        .join(", ") || conv.participant_names.join(", ");
    }
    return `Conversa ${conv.id.slice(0, 8)}`;
  }

  const displayedMessages = messageSearch.trim()
    ? messages.filter((m) => m.content?.toLowerCase().includes(messageSearch.toLowerCase()))
    : messages;

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
        <PageHeader
          title="Chat"
          subtitle="Mensagens diretas com a sua equipe."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <MessageCircle className="h-4 w-4" />
            </span>
          }
          actions={
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nova conversa
            </Button>
          }
        />

        <div className="flex min-h-0 flex-1 gap-4">
          {/* Conversation list */}
          <aside className="w-64 shrink-0 space-y-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : conversations.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa.
              </div>
            ) : (
              conversations.map((conv) => {
                const active = isRecentlyActive(conv.last_message_at);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={cn(
                      "glass w-full rounded-2xl p-3 text-left transition-colors shadow-card",
                      selectedConversationId === conv.id
                        ? "border-primary/50 bg-primary/5"
                        : "hover:border-primary/20",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {active && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-label="Ativo recentemente" />
                      )}
                      <p className="truncate text-sm font-medium">{getConvLabel(conv)}</p>
                    </div>
                    {conv.last_message_at ? (
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(conv.last_message_at)}
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}
          </aside>

          {/* Message thread */}
          <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl shadow-card">
            {!selectedConversationId ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Selecione uma conversa para começar.
              </div>
            ) : (
              <>
                {/* Search bar toggle */}
                <div className="flex items-center justify-end border-b border-border/50 px-3 py-1.5 gap-2">
                  {messageSearchVisible && (
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8 h-7 text-xs"
                        placeholder="Buscar mensagens..."
                        value={messageSearch}
                        onChange={(e) => setMessageSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setMessageSearchVisible((v) => !v);
                      setMessageSearch("");
                    }}
                    aria-label="Buscar mensagens"
                  >
                    {messageSearchVisible ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {displayedMessages.map((msg) => {
                    const isOwn = msg.author === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex group", isOwn ? "justify-end" : "justify-start")}
                        onMouseEnter={() => setHoveredMessageId(msg.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                      >
                        {/* Reply button (shown on hover, for incoming messages on left) */}
                        {!isOwn && hoveredMessageId === msg.id && (
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            className="mr-1 self-center p-1 rounded-full hover:bg-muted transition-colors opacity-70 hover:opacity-100"
                            aria-label="Responder"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm",
                          )}
                        >
                          {!isOwn && msg.author_name ? (
                            <p className="text-[10px] font-semibold opacity-70 mb-0.5">
                              {msg.author_name}
                            </p>
                          ) : null}

                          {/* Reply preview */}
                          {msg.reply_to && (
                            <div className={cn(
                              "mb-1.5 rounded-lg border-l-2 pl-2 py-1 text-[10px]",
                              isOwn
                                ? "border-primary-foreground/40 bg-primary-foreground/10"
                                : "border-primary/40 bg-primary/5",
                            )}>
                              {msg.reply_to_author && (
                                <p className="font-semibold opacity-80">{msg.reply_to_author}</p>
                              )}
                              <p className="opacity-70 line-clamp-1">{msg.reply_to_preview}</p>
                            </div>
                          )}

                          {/* File attachment display */}
                          {msg.file ? (
                            /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file_name ?? "") ? (
                              <img
                                src={msg.file}
                                alt={msg.file_name ?? "imagem"}
                                className="rounded-lg max-w-full max-h-48 object-contain mb-1"
                              />
                            ) : (
                              <a
                                href={msg.file}
                                download={msg.file_name ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-1.5 underline underline-offset-2 text-xs mb-1",
                                  isOwn ? "text-primary-foreground/90" : "text-primary",
                                )}
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                {msg.file_name ?? "arquivo"}
                              </a>
                            )
                          ) : null}

                          {msg.content ? (
                            <p className="whitespace-pre-wrap break-words">
                              {highlightText(msg.content, messageSearch)}
                            </p>
                          ) : null}

                          <p
                            className={cn(
                              "text-[10px] mt-1",
                              isOwn ? "text-primary-foreground/70 text-right" : "text-muted-foreground",
                            )}
                          >
                            {formatDate(msg.created_at)}
                          </p>
                        </div>

                        {/* Reply button for own messages on right */}
                        {isOwn && hoveredMessageId === msg.id && (
                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            className="ml-1 self-center p-1 rounded-full hover:bg-muted transition-colors opacity-70 hover:opacity-100"
                            aria-label="Responder"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Typing indicator */}
                {peerTyping && (
                  <div className="px-4 pb-1 text-[11px] text-muted-foreground italic">
                    {peerTyping} está digitando...
                  </div>
                )}

                {/* Input area */}
                <div className="border-t border-border p-3 space-y-2">
                  {/* Reply preview bar */}
                  {replyingTo && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                      <Reply className="h-3 w-3 shrink-0 text-primary" />
                      <span className="flex-1 truncate text-muted-foreground">
                        <span className="font-medium text-foreground">{replyingTo.author_name}: </span>
                        {replyingTo.content?.slice(0, 60)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                        aria-label="Cancelar resposta"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Pending file preview */}
                  {pendingFile && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                      <Paperclip className="h-3 w-3 shrink-0 text-primary" />
                      <span className="flex-1 truncate text-muted-foreground">{pendingFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingFile(null)}
                        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                        aria-label="Cancelar arquivo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPendingFile(file);
                        // Reset so same file can be re-selected
                        e.target.value = "";
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 p-0"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Anexar arquivo"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={inputText}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder={pendingFile ? "Adicionar mensagem (opcional)..." : "Escreva uma mensagem..."}
                      className="flex-1 text-sm"
                      disabled={!!pendingFile}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleSend}
                      disabled={!inputText.trim() && !pendingFile}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* New conversation dialog */}
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
              <div className="p-1 space-y-0.5">
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
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-muted transition-colors",
                          selected && "bg-primary/10 font-medium",
                        )}
                      >
                        <span className="flex-1 truncate">
                          {getUserDisplayName(u)}
                          {u.email && (
                            <span className="text-xs text-muted-foreground ml-1">({u.email})</span>
                          )}
                        </span>
                        {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                {usersQuery.isLoading && (
                  <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
                )}
                {!usersQuery.isLoading && (usersQuery.data || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
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
    </AppShell>
  );
}
