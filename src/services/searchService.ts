import { api } from "./api";

export interface SearchResult {
  type: "ticket" | "knowledge" | "forum" | "doubts" | "project";
  id: string;
  title: string;
  subtitle: string;
  url: string;
  status?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export async function globalSearch(query: string): Promise<SearchResponse> {
  const response = await api.get<SearchResponse>(`/search/?q=${encodeURIComponent(query)}`);
  return response.data;
}
