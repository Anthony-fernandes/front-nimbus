import type {
  ChatConversation,
  ChatMessage,
  DoubtsAnswer,
  DoubtsQuestion,
  ForumCategory,
  ForumReply,
  ForumTopic,
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeTag,
} from "@/lib/types";

import { api } from "./api";
import { createResource, deleteResource, getResource, listResource, updateResource } from "./crud";

// ─── Knowledge ───────────────────────────────────────────────────────────────

export function listKnowledgeCategories() {
  return listResource<KnowledgeCategory>("/knowledge/categories");
}

export function listKnowledgeArticles(params?: Record<string, unknown>) {
  return listResource<KnowledgeArticle>("/knowledge/articles", {
    status: "PUBLISHED",
    ...params,
  });
}

export function getKnowledgeArticle(id: string) {
  return getResource<KnowledgeArticle>("/knowledge/articles", id);
}

export function createKnowledgeArticle(data: Partial<KnowledgeArticle>) {
  return createResource<KnowledgeArticle>("/knowledge/articles", data);
}

export async function updateKnowledgeArticle(id: string, data: Partial<KnowledgeArticle>) {
  const response = await api.patch<KnowledgeArticle>(`/knowledge/articles/${id}/`, data);
  return response.data;
}

export async function publishArticle(id: string) {
  const response = await api.post<KnowledgeArticle>(`/knowledge/articles/${id}/publish/`);
  return response.data;
}

export async function rateArticle(id: string, helpful: boolean) {
  await api.post(`/knowledge/articles/${id}/rate/`, { helpful });
}

export function listKnowledgeTags() {
  return listResource<KnowledgeTag>("/knowledge/tags");
}

// ─── Forum ────────────────────────────────────────────────────────────────────

export function listForumCategories() {
  return listResource<ForumCategory>("/communication/forum-categories");
}

export function createForumCategory(data: Partial<ForumCategory>) {
  return createResource<ForumCategory>("/communication/forum-categories", data);
}

export function updateForumCategory(id: string, data: Partial<ForumCategory>) {
  return updateResource<ForumCategory>("/communication/forum-categories", id, data);
}

export function deleteForumCategory(id: string) {
  return deleteResource("/communication/forum-categories", id);
}

export function listForumTopics(params?: Record<string, unknown>) {
  return listResource<ForumTopic>("/communication/forum-topics", params);
}

export function getForumTopic(id: string) {
  return getResource<ForumTopic>("/communication/forum-topics", id);
}

export function createForumTopic(data: Partial<ForumTopic>) {
  return createResource<ForumTopic>("/communication/forum-topics", data);
}

export function listForumReplies(topicId: string) {
  return listResource<ForumReply>("/communication/forum-replies", { topic: topicId });
}

export function createForumReply(data: Partial<ForumReply>) {
  return createResource<ForumReply>("/communication/forum-replies", data);
}

export async function markBestAnswer(topicId: string, replyId: string) {
  await api.post(`/communication/forum-topics/${topicId}/mark-best-answer/`, {
    reply_id: replyId,
  });
}

export async function toggleReplyLike(replyId: string) {
  await api.post(`/communication/forum-replies/${replyId}/toggle-like/`);
}

// ─── Doubts ───────────────────────────────────────────────────────────────────

export function listDoubtsQuestions(params?: Record<string, unknown>) {
  return listResource<DoubtsQuestion>("/communication/doubts-questions", params);
}

export function getDoubtsQuestion(id: string) {
  return getResource<DoubtsQuestion>("/communication/doubts-questions", id);
}

export function createDoubtsQuestion(data: Partial<DoubtsQuestion>) {
  return createResource<DoubtsQuestion>("/communication/doubts-questions", data);
}

export function listDoubtsAnswers(questionId: string) {
  return listResource<DoubtsAnswer>("/communication/doubts-answers", { question: questionId });
}

export function createDoubtsAnswer(data: Partial<DoubtsAnswer>) {
  return createResource<DoubtsAnswer>("/communication/doubts-answers", data);
}

export async function acceptAnswer(questionId: string, answerId: string) {
  await api.post(`/communication/doubts-questions/${questionId}/accept-answer/`, {
    answer_id: answerId,
  });
}

export async function toggleAnswerLike(answerId: string) {
  await api.post(`/communication/doubts-answers/${answerId}/toggle-like/`);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

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

export async function sendChatMessage(conversationId: string, content: string) {
  const response = await api.post<ChatMessage>("/communication/chat-messages/", {
    conversation: conversationId,
    content,
  });
  return response.data;
}

// ─── Convert to KB ────────────────────────────────────────────────────────────

export async function convertForumTopicToKb(topicId: string, categoryId?: string): Promise<KnowledgeArticle> {
  const response = await api.post<KnowledgeArticle>(
    `/communication/forum-topics/${topicId}/convert-to-kb/`,
    categoryId ? { category: categoryId } : {},
  );
  return response.data;
}

export async function convertDoubtsQuestionToKb(questionId: string, categoryId?: string): Promise<KnowledgeArticle> {
  const response = await api.post<KnowledgeArticle>(
    `/communication/doubts-questions/${questionId}/convert-to-kb/`,
    categoryId ? { category: categoryId } : {},
  );
  return response.data;
}

export async function convertTicketToKb(ticketId: string, categoryId?: string): Promise<KnowledgeArticle> {
  const response = await api.post<KnowledgeArticle>(
    `/tickets/${ticketId}/convert-to-kb/`,
    categoryId ? { category: categoryId } : {},
  );
  return response.data;
}
