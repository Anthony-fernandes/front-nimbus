import type { ChatConversation, ChatMessage } from "@/lib/types";
import { api } from "./api";
import { listResource } from "./crud";

export function listChatConversations() {
  return listResource<ChatConversation>("/communication/chat-conversations");
}

export async function createChatConversation(
  participantIds: string[],
  options?: { tipo?: "direto" | "grupo"; name?: string; initialMessage?: string },
) {
  const response = await api.post<ChatConversation & { duplicate?: boolean }>(
    "/communication/chat-conversations/",
    {
      participants: participantIds,
      tipo: options?.tipo || "direto",
      name: options?.name || "",
      initial_message: options?.initialMessage || "",
    },
  );
  return response.data;
}

/** Cliente abre (ou reabre) atendimento com a fila de suporte. */
export async function startSupportConversation(initialMessage?: string) {
  const r = await api.post<ChatConversation & { duplicate?: boolean }>(
    "/communication/chat-conversations/start-support/",
    { initial_message: initialMessage || "" },
  );
  return r.data;
}

export async function assumeConversation(id: string, force = false) {
  const r = await api.post<ChatConversation>(`/communication/chat-conversations/${id}/assume/`, { force });
  return r.data;
}

export async function closeConversation(id: string) {
  const r = await api.post<ChatConversation>(`/communication/chat-conversations/${id}/close/`);
  return r.data;
}

/** Marca todas as mensagens da conversa como lidas (uma chamada só). */
export async function markConversationRead(id: string) {
  await api.post(`/communication/chat-conversations/${id}/mark-read/`);
}

export function listChatMessages(conversationId: string) {
  return listResource<ChatMessage>("/communication/chat-messages", {
    conversation: conversationId,
  });
}

export async function sendChatMessage(conversationId: string, content: string, replyTo?: string) {
  const response = await api.post<ChatMessage>("/communication/chat-messages/", {
    conversation: conversationId,
    content,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  return response.data;
}

export async function sendChatFile(conversationId: string, file: File, content?: string) {
  const form = new FormData();
  form.append("conversation", conversationId);
  form.append("file", file);
  if (content) form.append("content", content);
  const response = await api.post<ChatMessage>("/communication/chat-messages/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function updateChatMessage(id: string, content: string) {
  const r = await api.patch<ChatMessage>(`/communication/chat-messages/${id}/`, { content });
  return r.data;
}

export async function deleteChatMessage(id: string) {
  await api.delete(`/communication/chat-messages/${id}/`);
}

export async function pinChatMessage(id: string) {
  const r = await api.post<ChatMessage>(`/communication/chat-messages/${id}/pin/`);
  return r.data;
}

export async function reactToMessage(id: string, emoji: string) {
  const r = await api.post<ChatMessage>(`/communication/chat-messages/${id}/react/`, { emoji });
  return r.data;
}

export async function forwardChatMessage(messageId: string, conversationId: string) {
  const r = await api.post<ChatMessage>(`/communication/chat-messages/${messageId}/forward/`, { conversation: conversationId });
  return r.data;
}

// Chat → Chamado: converte a conversa em chamado e vincula o histórico.
export async function convertConversationToTicket(id: string, payload?: { title?: string; priority?: string }) {
  const r = await api.post(`/communication/chat-conversations/${id}/convert-to-ticket/`, payload || {});
  return r.data as { id: string; code?: string; detail?: string; ticket?: { id: string } };
}

export async function archiveConversation(id: string) {
  await api.post(`/communication/chat-conversations/${id}/archive/`);
}

export async function markConversationUnread(id: string) {
  await api.post(`/communication/chat-conversations/${id}/mark-unread/`);
}

export async function markMessageRead(messageId: string) {
  await api.post(`/communication/chat-messages/${messageId}/mark-read/`);
}
