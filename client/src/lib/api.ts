import axios, { AxiosError } from 'axios';
import type {
  Generation,
  PaginatedResult,
  CreateGenerationPayload,
  DocumentSummary,
  DocumentDetail,
  DocumentChunk,
  SearchPayload,
  SearchResponse,
  ConversationSummary,
  ConversationDetail,
  LlmCall,
  TraceSummary,
} from './types';
import type { DocumentStatus } from './constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const message =
      error.response?.data?.message || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  },
);

// ---------------------------------------------------------------------------
// Generations
// ---------------------------------------------------------------------------

export async function createGeneration(
  payload: CreateGenerationPayload,
): Promise<Generation> {
  const { data } = await apiClient.post<Generation>('/generations', payload);
  return data;
}

export async function getGenerations(params?: {
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<Generation>> {
  const { data } = await apiClient.get<PaginatedResult<Generation>>(
    '/generations',
    { params },
  );
  return data;
}

export async function getGeneration(id: string): Promise<Generation> {
  const { data } = await apiClient.get<Generation>(`/generations/${id}`);
  return data;
}

export async function retryGeneration(id: string): Promise<Generation> {
  const { data } = await apiClient.post<Generation>(
    `/generations/${id}/retry`,
  );
  return data;
}

export async function cancelGeneration(id: string): Promise<Generation> {
  const { data } = await apiClient.post<Generation>(
    `/generations/${id}/cancel`,
  );
  return data;
}

export function getSSEUrl(): string {
  return `${API_URL}/generations/sse`;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function getDocuments(params?: {
  status?: DocumentStatus;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<DocumentSummary>> {
  const { data } = await apiClient.get<PaginatedResult<DocumentSummary>>(
    '/documents',
    { params },
  );
  return data;
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const { data } = await apiClient.get<DocumentDetail>(`/documents/${id}`);
  return data;
}

export async function getDocumentChunks(id: string): Promise<DocumentChunk[]> {
  const { data } = await apiClient.get<DocumentChunk[]>(
    `/documents/${id}/chunks`,
  );
  return data;
}

export async function createDocument(payload: {
  title: string;
  content: string;
}): Promise<DocumentSummary> {
  const { data } = await apiClient.post<DocumentSummary>('/documents', payload);
  return data;
}

export async function uploadDocument(
  file: File,
  title?: string,
): Promise<DocumentSummary> {
  const form = new FormData();
  form.append('file', file);
  if (title?.trim()) form.append('title', title.trim());
  const { data } = await apiClient.post<DocumentSummary>(
    '/documents/upload',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function reindexDocument(id: string): Promise<DocumentSummary> {
  const { data } = await apiClient.post<DocumentSummary>(
    `/documents/${id}/reindex`,
  );
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

export async function searchDocuments(
  payload: SearchPayload,
): Promise<SearchResponse> {
  const { data } = await apiClient.post<SearchResponse>(
    '/documents/search',
    payload,
  );
  return data;
}

export function getDocumentsSSEUrl(): string {
  return `${API_URL}/documents/sse`;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** The AI SDK streaming endpoint consumed by `useChat`. */
export function getChatUrl(): string {
  return `${API_URL}/chat`;
}

export async function getConversations(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<ConversationSummary>> {
  const { data } = await apiClient.get<PaginatedResult<ConversationSummary>>(
    '/chat/conversations',
    { params },
  );
  return data;
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const { data } = await apiClient.get<ConversationDetail>(
    `/chat/conversations/${id}`,
  );
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/chat/conversations/${id}`);
}

// ---------------------------------------------------------------------------
// Traces
// ---------------------------------------------------------------------------

export async function getTraces(params?: {
  traceId?: string;
  name?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<LlmCall>> {
  const { data } = await apiClient.get<PaginatedResult<LlmCall>>('/traces', {
    params,
  });
  return data;
}

export async function getTraceSummary(): Promise<TraceSummary> {
  const { data } = await apiClient.get<TraceSummary>('/traces/summary');
  return data;
}
