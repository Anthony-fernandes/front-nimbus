import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, Send } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/services/api";
import {
  createChatConversation,
  listChatConversations,
  listChatMessages,
  sendChatMessage,
} from "@/services/knowledgeService";
import { getAccessToken, getStoredUser } from "@/services/session";
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

function ChatPage() {
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [participantInput, setParticipantInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: listChatConversations,
  });

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", selectedConversationId],
    queryFn: () => (selectedConversationId ? listChatMessages(selectedConversationId) : Promise.resolve([])),
    enabled: !!selectedConversationId,
  });

  // Sync REST messages into state
  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(messagesQuery.data);
    }
  }, [messagesQuery.data]);

  // WebSocket connection
  useEffect(() => {
    if (!selectedConversationId) return;

    const token = getAccessToken();
    if (!token) return;

    const url = buildWsUrl(selectedConversationId, token);
    let ws: WebSocket;

    try {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as Partial<ChatMessage>;
          if (data.id && data.content) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === data.id);
              if (exists) return prev;
              return [...prev, data as ChatMessage];
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        // WS failed — REST fallback is already in place
      };
    } catch {
      // WebSocket not available
    }

    return () => {
      ws?.close();
      wsRef.current = null;
    };
  }, [selectedConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConvMutation = useMutation({
    mutationFn: (participantIds: string[]) => createChatConversation(participantIds),
    onSuccess: (conv) => {
      toast.success("Conversa criada.");
      setDialogOpen(false);
      setParticipantInput("");
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      setSelectedConversationId(conv.id);
    },
    onError: () => toast.error("Não foi possível criar a conversa."),
  });

  function handleSend() {
    if (!inputText.trim() || !selectedConversationId) return;

    const content = inputText.trim();
    setInputText("");

    // Optimistic add (temporary message without a real id)
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      conversation: selectedConversationId,
      author: user?.id ?? "",
      author_name: user ? (user as { display_name?: string }).display_name ?? "" : "",
      content,
      file: null,
      file_name: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    // Try WS first
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
    } else {
      // REST fallback
      sendChatMessage(selectedConversationId, content)
        .then((msg) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimistic.id ? msg : m)),
          );
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
              conversations.map((conv) => (
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
                  <p className="truncate text-sm font-medium">{getConvLabel(conv)}</p>
                  {conv.last_message_at ? (
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(conv.last_message_at)}
                    </p>
                  ) : null}
                </button>
              ))
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
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) => {
                    const isOwn = msg.author === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                      >
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
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={cn(
                              "text-[10px] mt-1",
                              isOwn ? "text-primary-foreground/70 text-right" : "text-muted-foreground",
                            )}
                          >
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-border p-3 flex gap-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Escreva uma mensagem..."
                    className="flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleSend} disabled={!inputText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
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
              <Label>IDs dos participantes (separados por vírgula)</Label>
              <Input
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                placeholder="uuid1, uuid2..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const ids = participantInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (ids.length === 0) return;
                createConvMutation.mutate(ids);
              }}
              disabled={createConvMutation.isPending || !participantInput.trim()}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
