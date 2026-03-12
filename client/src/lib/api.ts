import axios, { AxiosError } from 'axios';
import type {
  Generation,
  PaginatedResult,
  CreateGenerationPayload,
} from './types';

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
