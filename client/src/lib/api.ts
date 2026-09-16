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
  TraceSortField,
  MeResponse,
  DemoStatus,
  ProviderId,
  ProvidersResponse,
  SaveProviderKeyResponse,
  TranscriptionResult,
} from './types';
import type { DocumentStatus } from './constants';
import { ApiError, messageFromBody, type ApiErrorBody } from './api-errors';
import { notifyUnauthorized } from './auth-events';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // The session is an httpOnly cookie set by the API.
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    // The session expired or was revoked: let the auth gate re-check it.
    if (status === 401) notifyUnauthorized();

    const body = error.response?.data;
    const message = messageFromBody(body) || error.message || 'Request failed';
    return Promise.reject(new ApiError(message, status, body?.error));
  },
);

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export async function getMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>('/me');
  return data;
}

/** Public: whether the one-click demo is open (sign-in itself goes through Better Auth). */
export async function getDemoStatus(): Promise<DemoStatus> {
  const { data } = await apiClient.get<DemoStatus>('/demo');
  return data;
}

// ---------------------------------------------------------------------------
// AI providers (bring your own key)
// ---------------------------------------------------------------------------

export async function getProviders(): Promise<ProvidersResponse> {
  const { data } = await apiClient.get<ProvidersResponse>('/providers');
  return data;
}

/** Verifies the key with the provider, then stores it encrypted. Can take a few seconds. */
export async function saveProviderKey(
  provider: ProviderId,
  apiKey: string,
): Promise<SaveProviderKeyResponse> {
  const { data } = await apiClient.put<SaveProviderKeyResponse>(
    `/providers/${provider}/key`,
    { apiKey },
  );
  return data;
}

export async function deleteProviderKey(provider: ProviderId): Promise<void> {
  await apiClient.delete(`/providers/${provider}/key`);
}

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

/** Deletes the generation and its stored image (a job still running is cancelled first). */
export async function deleteGeneration(id: string): Promise<void> {
  await apiClient.delete(`/generations/${id}`);
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

/** Speech to text for the chat microphone: a short recording in, its transcript out (budgeted and traced). */
export async function transcribeAudio(
  audio: Blob,
  conversationId?: string,
): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append('audio', audio, 'recording');
  if (conversationId) form.append('conversationId', conversationId);
  const { data } = await apiClient.post<TranscriptionResult>(
    '/chat/transcribe',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Traces
// ---------------------------------------------------------------------------

export async function getTraces(params?: {
  traceId?: string;
  name?: string;
  sort?: TraceSortField;
  order?: 'asc' | 'desc';
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
