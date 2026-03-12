"use client";

import { useRef, useEffect, useState } from "react";
import { useGenerations } from "@/hooks/use-generations";
import { useSSE } from "@/hooks/use-sse";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Ban } from "lucide-react";
import { cancelGeneration } from "@/lib/api";
import { GenerationType, JobStatus } from "@/lib/constants";
import type { Generation } from "@/lib/types";
import { toast } from "sonner";

interface JobTrackerProps {
  refreshKey?: number;
}

const ACTIVE_JOB_LIMIT = 5;
const PROMPT_PREVIEW_LENGTH = 60;

function truncatePrompt(prompt: string): string {
  if (prompt.length <= PROMPT_PREVIEW_LENGTH) return `"${prompt}"`;
  return `"${prompt.slice(0, PROMPT_PREVIEW_LENGTH)}…"`;
}

function isActiveJob(generation: Generation): boolean {
  return (
    generation.status === JobStatus.PENDING ||
    generation.status === JobStatus.GENERATING
  );
}

export function JobTracker({ refreshKey }: JobTrackerProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { result, loading, handleSSEEvent, refetch } = useGenerations({
    status: undefined,
    limit: ACTIVE_JOB_LIMIT,
    page: 1,
  });

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await cancelGeneration(id);
      toast.success("Generation cancelled");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  };

  const resultRef = useRef(result);
  resultRef.current = result;

  useSSE((event) => {
    handleSSEEvent(event);

    if (event.status === JobStatus.FAILED) {
      toast.error(event.error ?? "Generation failed", {
        description:
          "The generation was aborted. You can retry it from the history page.",
      });
      refetch();
      return;
    }

    if (event.status === JobStatus.COMPLETED) {
      const gen = resultRef.current?.data.find(
        (g) => g.id === event.generationId,
      );
      const isImage = !!event.imageUrl || gen?.type === GenerationType.IMAGE;
      const label = isImage ? "Image" : "Text";

      toast.success(`${label} generation completed`, {
        description: gen?.prompt ? truncatePrompt(gen.prompt) : undefined,
      });
      refetch();
    }
  }, refetch);

  const prevKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== prevKeyRef.current) {
      prevKeyRef.current = refreshKey;
      refetch();
    }
  }, [refreshKey, refetch]);

  const activeJobs = result?.data.filter(isActiveJob) || [];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Active Jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Active Jobs
          {activeJobs.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
              {activeJobs.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active jobs. Submit a prompt to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{job.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.type} &middot;{" "}
                    {new Date(job.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancel(job.id)}
                    disabled={cancellingId === job.id}
                    title="Cancel"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
