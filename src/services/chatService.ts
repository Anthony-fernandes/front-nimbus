import type { ChatConversation, ChatMessage } from "@/lib/types";
import { api } from "./api";
import { listResource } from "./crud";

export function listChatConversations() {
  return listResource<ChatConversation>("/communication/chat-conversations");
}

export async function createChatConversation(participantIds: string[]) {
  const response = await api.post<ChatConversation>("/communication/chat-conversations/", {
    participants: participantIds,
  });
  return response.data;
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

export async function archiveConversation(id: string) {
  await api.post(`/communication/chat-conversations/${id}/archive/`);
}

export async function markConversationUnread(id: string) {
  await api.post(`/communication/chat-conversations/${id}/mark-unread/`);
}

export async function markMessageRead(messageId: string) {
  await api.post(`/communication/chat-messages/${messageId}/mark-read/`);
}
