"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGenerations } from "@/hooks/use-generations";
import { useSSE } from "@/hooks/use-sse";
import { useModels } from "@/hooks/use-models";
import { Pane, PaneRule } from "@/components/tui/pane";
import { GhostRows } from "@/components/tui/ghost";
import { GenerationRow } from "@/components/generation-row";
import { GenerationDetailDialog } from "@/components/generation-card";
import { cancelGeneration, retryGeneration } from "@/lib/api";
import { GenerationType, JobStatus } from "@/lib/constants";
import type { Generation } from "@/lib/types";
import { toast } from "sonner";

interface JobTrackerProps {
  refreshKey?: number;
}

const RECENT_LIMIT = 6;
const PROMPT_PREVIEW_LENGTH = 60;

function truncatePrompt(prompt: string): string {
  if (prompt.length <= PROMPT_PREVIEW_LENGTH) return `"${prompt}"`;
  return `"${prompt.slice(0, PROMPT_PREVIEW_LENGTH)}…"`;
}

function isActiveJob(generation: Generation): boolean {
  return generation.status === JobStatus.PENDING || generation.status === JobStatus.GENERATING;
}

/** The queue card: running jobs slide in as they arrive; the last few finished jobs sit below. */
export function JobTracker({ refreshKey }: JobTrackerProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState<Generation | null>(null);
  const { modelById, imageModelById } = useModels();

  const { result, loading, handleSSEEvent, refetch } = useGenerations({ status: undefined, limit: RECENT_LIMIT, page: 1 });

  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!result) return;
    if (seenIds.current === null) seenIds.current = new Set(result.data.map((g) => g.id));
  }, [result]);

  const handleCancel = async (job: Generation) => {
    setBusyId(job.id);
    try { await cancelGeneration(job.id); toast.success("Cancelled"); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Cancel failed"); }
    finally { setBusyId(null); }
  };

  const handleRetry = async (job: Generation) => {
    setBusyId(job.id);
    try { await retryGeneration(job.id); toast.success("Retried", { description: "The job is back in the queue." }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Retry failed"); }
    finally { setBusyId(null); }
  };

  const resultRef = useRef(result);
  resultRef.current = result;

  useSSE((event) => {
    handleSSEEvent(event);
    if (event.status === JobStatus.FAILED) {
      toast.error(event.error ?? "Generation failed", { description: "The job was aborted. Retry it from the queue or from History." });
      refetch();
      return;
    }
    if (event.status === JobStatus.COMPLETED) {
      const gen = resultRef.current?.data.find((g) => g.id === event.generationId);
      const isImage = !!event.imageUrl || gen?.type === GenerationType.IMAGE;
      toast.success(`${isImage ? "Image" : "Text"} ready`, { description: gen?.prompt ? truncatePrompt(gen.prompt) : undefined });
      refetch();
    }
  }, refetch);

  const prevKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== prevKeyRef.current) { prevKeyRef.current = refreshKey; refetch(); }
  }, [refreshKey, refetch]);

  const jobs = result?.data ?? [];
  const activeJobs = jobs.filter(isActiveJob);
  const recentJobs = jobs.filter((g) => !isActiveJob(g));

  const modelLabelOf = (g: Generation) => {
    const raw = g.parameters?.model ? String(g.parameters.model) : null;
    if (!raw) return undefined;
    const model = g.type === GenerationType.IMAGE ? imageModelById(raw) : modelById(raw);
    return model?.label ?? raw;
  };
  const isNew = (g: Generation) => seenIds.current !== null && !seenIds.current.has(g.id);

  return (
    <Pane
      title="Queue"
      legend={loading ? "Loading" : activeJobs.length > 0 ? <span className="status status-info" data-live="">{activeJobs.length} running</span> : "Idle"}
      flush
      className="pb-3"
    >
      <div className="px-3 pt-3">
        {loading ? (
          <div className="px-3"><GhostRows rows={3} /></div>
        ) : activeJobs.length === 0 ? (
          <div className="px-3"><GhostRows rows={3} label="No jobs running. Describe something above." /></div>
        ) : (
          <div className="flex flex-col" data-testid="active-jobs">
            {activeJobs.map((job) => (
              <GenerationRow key={job.id} generation={job} modelLabel={modelLabelOf(job)} onOpen={setOpen} onCancel={handleCancel} busy={busyId === job.id} printIn={isNew(job)} />
            ))}
          </div>
        )}

        {recentJobs.length > 0 && (
          <>
            <PaneRule label="Recent" className="mx-3 mt-4 mb-2" />
            <div className="flex flex-col">
              {recentJobs.map((job) => (
                <GenerationRow key={job.id} generation={job} modelLabel={modelLabelOf(job)} onOpen={setOpen} onRetry={handleRetry} busy={busyId === job.id} printIn={isNew(job)} />
              ))}
            </div>
            <div className="px-3 pt-2">
              <Link href="/history" className="btn btn-ghost btn-sm -ml-3">
                All history <ArrowRight />
              </Link>
            </div>
          </>
        )}
      </div>
      <GenerationDetailDialog generation={open} onClose={() => setOpen(null)} onQueued={refetch} />
    </Pane>
  );
}
