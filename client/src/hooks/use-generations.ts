"use client";

import { useState, useEffect, useCallback } from "react";
import { getGenerations } from "@/lib/api";
import { JobStatus } from "@/lib/constants";
import type { Generation, PaginatedResult, SseEvent } from "@/lib/types";

interface UseGenerationsOptions {
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function useGenerations(options: UseGenerationsOptions = {}) {
  const [result, setResult] = useState<PaginatedResult<Generation> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGenerations(options);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [options.type, options.status, options.page, options.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSSEEvent = useCallback((event: SseEvent) => {
    setResult((prev) => {
      if (!prev) return prev;
      const updated = prev.data.map((gen) => {
        if (gen.id !== event.generationId) return gen;

        const base = { ...gen, status: event.status };

        if (
          event.status === JobStatus.COMPLETED ||
          event.status === JobStatus.GENERATING
        ) {
          base.error = null;
        }
        if (event.status === JobStatus.FAILED) {
          base.imageUrl = null;
          base.textResult = null;
        }

        if (event.imageUrl) base.imageUrl = event.imageUrl;
        if (event.textResult) base.textResult = event.textResult;
        if (event.error) base.error = event.error;
        if (event.enhancedPrompt) base.enhancedPrompt = event.enhancedPrompt;

        return base;
      });
      return { ...prev, data: updated };
    });
  }, []);

  return { result, loading, error, refetch: fetchData, handleSSEEvent };
}
