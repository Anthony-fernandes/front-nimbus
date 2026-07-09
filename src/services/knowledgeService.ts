import type {
  ChatConversation,
  ChatMessage,
  DoubtsAnswer,
  DoubtsQuestion,
  ForumCategory,
  ForumComment,
  ForumReply,
  ForumTopic,
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeInternalComment,
  KnowledgeTag,
} from "@/lib/types";

import { api } from "./api";
import { createResource, deleteResource, getResource, listResource, updateResource } from "./crud";

// ─── Knowledge ───────────────────────────────────────────────────────────────

export function listKnowledgeCategories() {
  return listResource<KnowledgeCategory>("/knowledge/categories");
}

export function createKnowledgeCategory(data: Partial<KnowledgeCategory>) {
  return createResource<KnowledgeCategory>("/knowledge/categories", data);
}

export function updateKnowledgeCategory(id: string, data: Partial<KnowledgeCategory>) {
  return updateResource<KnowledgeCategory>("/knowledge/categories", id, data);
}

export function deleteKnowledgeCategory(id: string) {
  return deleteResource("/knowledge/categories", id);
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

export async function toggleTopicLike(topicId: string) {
  await api.post(`/communication/forum-topics/${topicId}/toggle-like/`);
}

export function updateForumTopic(id: string, data: Partial<ForumTopic>) {
  return updateResource<ForumTopic>("/communication/forum-topics", id, data);
}

export function deleteForumTopic(id: string) {
  return deleteResource("/communication/forum-topics", id);
}

export function updateForumReply(id: string, data: Partial<ForumReply>) {
  return updateResource<ForumReply>("/communication/forum-replies", id, data);
}

export function deleteForumReply(id: string) {
  return deleteResource("/communication/forum-replies", id);
}

export async function pinForumTopic(topicId: string) {
  const response = await api.post<ForumTopic>(`/communication/forum-topics/${topicId}/pin/`);
  return response.data;
}

export async function lockForumTopic(topicId: string) {
  const response = await api.post<ForumTopic>(`/communication/forum-topics/${topicId}/lock/`);
  return response.data;
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

export async function toggleQuestionLike(questionId: string) {
  await api.post(`/communication/doubts-questions/${questionId}/toggle-like/`);
}

export function updateDoubtsQuestion(id: string, data: Partial<DoubtsQuestion>) {
  return updateResource<DoubtsQuestion>("/communication/doubts-questions", id, data);
}

export function deleteDoubtsQuestion(id: string) {
  return deleteResource("/communication/doubts-questions", id);
}

export function updateDoubtsAnswer(id: string, data: Partial<DoubtsAnswer>) {
  return updateResource<DoubtsAnswer>("/communication/doubts-answers", id, data);
}

export function deleteDoubtsAnswer(id: string) {
  return deleteResource("/communication/doubts-answers", id);
}

export async function closeDoubtsQuestion(questionId: string) {
  const response = await api.post<DoubtsQuestion>(`/communication/doubts-questions/${questionId}/close/`);
  return response.data;
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

// ─── Forum Comments ───────────────────────────────────────────────────────────

export function listForumComments(params?: Record<string, unknown>) {
  return listResource<ForumComment>("/communication/forum-comments", params);
}

export function createForumComment(data: Partial<ForumComment>) {
  return createResource<ForumComment>("/communication/forum-comments", data);
}

export function deleteForumComment(id: string) {
  return deleteResource("/communication/forum-comments", id);
}

// ─── Flag Content ─────────────────────────────────────────────────────────────

export async function flagContent(contentType: string, objectId: string, reason: string) {
  await api.post("/communication/flags/", { content_type: contentType, object_id: objectId, reason });
}

// ─── Forum Downvote ───────────────────────────────────────────────────────────

export async function toggleTopicDownvote(topicId: string) {
  await api.post(`/communication/forum-topics/${topicId}/toggle-downvote/`);
}

export async function toggleReplyDownvote(replyId: string) {
  await api.post(`/communication/forum-replies/${replyId}/toggle-downvote/`);
}

// ─── Chat Advanced ────────────────────────────────────────────────────────────

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

// ─── KB Internal Comments ─────────────────────────────────────────────────────

export function listKnowledgeInternalComments(articleId: string) {
  return listResource<KnowledgeInternalComment>("/knowledge/internal-comments", { article: articleId });
}

export function createKnowledgeInternalComment(data: Partial<KnowledgeInternalComment>) {
  return createResource<KnowledgeInternalComment>("/knowledge/internal-comments", data);
}

export function deleteKnowledgeInternalComment(id: string) {
  return deleteResource("/knowledge/internal-comments", id);
}

export async function requestKnowledgeReview(id: string) {
  const r = await api.post<KnowledgeArticle>(`/knowledge/articles/${id}/request-review/`);
  return r.data;
}

// ─── KB Versions ──────────────────────────────────────────────────────────────

export interface ArticleVersion {
  id: string;
  article: string;
  version: number;
  title: string;
  content: string;
  changed_by: string | null;
  changed_by_name?: string | null;
  change_summary: string;
  created_at: string;
}

export function listArticleVersions(articleId: string) {
  return listResource<ArticleVersion>("/knowledge/article-versions", { article: articleId });
}

// ─── KB Attachments ───────────────────────────────────────────────────────────

export interface ArticleAttachment {
  id: string;
  article: string;
  file: string;
  name: string;
  size: number | null;
  created_at: string;
}

export function listArticleAttachments(articleId: string) {
  return listResource<ArticleAttachment>("/knowledge/article-attachments", { article: articleId });
}

export async function uploadArticleAttachment(articleId: string, file: File) {
  const form = new FormData();
  form.append("article", articleId);
  form.append("file", file);
  form.append("name", file.name);
  form.append("size", String(file.size));
  const r = await api.post<ArticleAttachment>("/knowledge/article-attachments/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export function deleteArticleAttachment(id: string) {
  return deleteResource("/knowledge/article-attachments", id);
}

// ─── Tickets Reports ──────────────────────────────────────────────────────────

export interface TicketReportsData {
  total: number;
  open: number;
  closed: number;
  pending: number;
  avg_csat: number | null;
  avg_response_hours: number | null;
  volume_by_day: { date: string; count: number }[];
  top_categories: { category: string; count: number }[];
}

export async function getTicketReports() {
  const r = await api.get<TicketReportsData>("/tickets/reports/");
  return r.data;
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export interface AdminDashboardData {
  forum: { total_topics: number; total_replies: number; active_users: number };
  kb: { total_articles: number; avg_rating: number | null };
  tickets: { open: number; closed: number; avg_csat: number | null };
  chat: { active_conversations: number };
}

export async function getAdminDashboard() {
  const r = await api.get<AdminDashboardData>("/admin-dashboard/");
  return r.data;
}

// ─── SLA Policies ────────────────────────────────────────────────────────────

export interface SLAPolicy {
  id: string;
  name: string;
  priority: string;
  category: string;
  response_time: string;
  priority_weight: number;
  active: boolean;
}

export function listSLAPolicies() {
  return listResource<SLAPolicy>("/tickets/sla-policies/");
}

export function createSLAPolicy(data: Partial<SLAPolicy>) {
  return createResource<SLAPolicy>("/tickets/sla-policies/", data);
}

export function updateSLAPolicy(id: string, data: Partial<SLAPolicy>) {
  return updateResource<SLAPolicy>("/tickets/sla-policies/", id, data);
}

export function deleteSLAPolicy(id: string) {
  return deleteResource("/tickets/sla-policies/", id);
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

export interface TicketCustomField {
  id: string;
  name: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean";
  options: string[];
  required: boolean;
  active: boolean;
  order: number;
}

export function listTicketCustomFields() {
  return listResource<TicketCustomField>("/tickets/custom-fields/");
}

export function createTicketCustomField(data: Partial<TicketCustomField>) {
  return createResource<TicketCustomField>("/tickets/custom-fields/", data);
}

export function updateTicketCustomField(id: string, data: Partial<TicketCustomField>) {
  return updateResource<TicketCustomField>("/tickets/custom-fields/", id, data);
}

export function deleteTicketCustomField(id: string) {
  return deleteResource("/tickets/custom-fields/", id);
}

// ─── Chat Read Receipts ───────────────────────────────────────────────────────

export async function markMessageRead(messageId: string) {
  const r = await api.post<ChatMessage>(`/communication/chat-messages/${messageId}/mark-read/`);
  return r.data;
}



// ─── Forum Badges ─────────────────────────────────────────────────────────────

export interface ForumBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
}

export interface UserBadge {
  id: string;
  badge: string;
  badge_name: string;
  badge_icon: string;
  badge_description: string;
  earned_at: string;
}

export function listUserBadges(userId: string) {
  return listResource<UserBadge>("/communication/user-badges/", { user: userId });
}

// ─── Convert to KB ────────────────────────────────────────────────────────────

export async function convertForumTopicToKb(topicId: string, categoryId?: string): Promise<KnowledgeArticle> {
  const response = await api.post<KnowledgeArticle>(
    `/communication/forum-topics/${topicId}/convert-to-kb/`,
    categoryId ? { category: categoryId } : {},
  );
  return response.data;
}

// Fórum → Chamado: converte um tópico em chamado e vincula os dois.
export async function convertForumTopicToTicket(topicId: string) {
  const response = await api.post(`/communication/forum-topics/${topicId}/convert-to-ticket/`, {});
  return response.data as { id: string; code?: string; detail?: string; ticket?: { id: string } };
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

// ─── Forum Edit History ───────────────────────────────────────────────────────

export function listForumTopicEdits(topicId: string) {
  return listResource<{
    id: string; editor: string; editor_name: string;
    old_title: string; new_title: string;
    old_content: string; new_content: string;
    edit_comment: string; created_at: string;
  }>("/communication/forum-topic-edits", { topic: topicId });
}

export function listForumReplyEdits(replyId: string) {
  return listResource<{
    id: string; editor: string; editor_name: string;
    old_content: string; new_content: string;
    edit_comment: string; created_at: string;
  }>("/communication/forum-reply-edits", { reply: replyId });
}

// ─── Forum Moderation ─────────────────────────────────────────────────────────

export function listContentFlags(params?: Record<string, unknown>) {
  return listResource<{
    id: string; content_type: string; object_id: string;
    reason: string; author: string; reviewed: boolean;
    action_taken: string; created_at: string;
  }>("/communication/flags", params);
}

export async function resolveContentFlag(id: string, action_taken: string) {
  const r = await api.post(`/communication/flags/${id}/resolve/`, { action_taken });
  return r.data;
}

// ─── Forum User Profile ───────────────────────────────────────────────────────

export async function getForumUserProfile(userId: string) {
  const r = await api.get(`/communication/forum-users/${userId}/profile/`);
  return r.data as {
    id: string; username: string; full_name: string; job_title: string;
    topics_count: number; replies_count: number; best_answers: number; reputation: number;
    recent_topics: ForumTopic[]; recent_replies: ForumReply[];
  };
}

export function listForumReputation(params?: Record<string, unknown>) {
  return listResource<{ id: string; user: string; username: string; full_name: string; score: number }>(
    "/communication/forum-reputation", params,
  );
}
