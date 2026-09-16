"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ImageIcon, Type, Ban, RotateCcw } from "lucide-react";
import { useGenerations } from "@/hooks/use-generations";
import { useSSE } from "@/hooks/use-sse";
import { useModels } from "@/hooks/use-models";
import { GenerationDetailDialog } from "./generation-card";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { PageHeading } from "@/components/layout/page-heading";
import { Pane } from "@/components/tui/pane";
import { Scroller } from "@/components/tui/scroller";
import { GhostRows } from "@/components/tui/ghost";
import { Pager } from "@/components/tui/pager";
import { Reveal } from "@/components/motion/reveal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { retryGeneration, cancelGeneration } from "@/lib/api";
import { GenerationType, JobStatus } from "@/lib/constants";
import { formatStamp } from "@/lib/format";
import type { Generation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const HISTORY_LIMIT = 12;
const ALL_FILTER = "all";
const TYPE_CHIPS = [
  { value: "all", label: "All" },
  { value: "IMAGE", label: "Images" },
  { value: "TEXT", label: "Text" },
];
const STATUS_ITEMS = { all: "All statuses", PENDING: "Pending", GENERATING: "Generating", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled" };

/** Window 2: every generation in a glass table, filterable, with retry and cancel. */
export function GenerationHistory() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { modelById, imageModelById } = useModels();
  const [open, setOpen] = useState<Generation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const typeFilter = searchParams.get("type") || ALL_FILTER;
  const statusFilter = searchParams.get("status") || ALL_FILTER;
  const page = Number(searchParams.get("page")) || 1;

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      const isDefault = value === null || value === ALL_FILTER || (key === "page" && value === "1");
      if (isDefault) params.delete(key); else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const { result, loading, error, handleSSEEvent, refetch } = useGenerations({
    type: typeFilter !== ALL_FILTER ? typeFilter : undefined,
    status: statusFilter !== ALL_FILTER ? statusFilter : undefined,
    page,
    limit: HISTORY_LIMIT,
  });

  useSSE((event) => {
    handleSSEEvent(event);
    if (event.status === JobStatus.COMPLETED) refetch();
    if (event.status === JobStatus.FAILED) toast.error(event.error ?? "Generation failed");
  }, refetch);

  const handleRetry = async (generation: Generation) => {
    setBusyId(generation.id);
    try { await retryGeneration(generation.id); toast.success("Retried", { description: "The job is back in the queue." }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Retry failed"); }
    finally { setBusyId(null); }
  };
  const handleCancel = async (generation: Generation) => {
    setBusyId(generation.id);
    try { await cancelGeneration(generation.id); toast.success("Cancelled"); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Cancel failed"); }
    finally { setBusyId(null); }
  };

  const modelLabelOf = (g: Generation) => {
    const raw = g.parameters?.model ? String(g.parameters.model) : g.type === GenerationType.IMAGE ? "flux" : "openai";
    return (g.type === GenerationType.IMAGE ? imageModelById(raw) : modelById(raw))?.label ?? raw;
  };

  return (
    <>
      <PageHeading
        title="History"
        sub="Every generation with its status, model and priority. Retry or cancel from here."
        aside={
          <>
            <div className="chips" role="group" aria-label="Type">
              {TYPE_CHIPS.map((chip) => (
                <button key={chip.value} type="button" className="chip" data-active={typeFilter === chip.value ? "" : undefined} aria-pressed={typeFilter === chip.value} onClick={() => updateParams({ type: chip.value, page: "1" })}>
                  {chip.label}
                </button>
              ))}
            </div>
            <Select value={statusFilter} onValueChange={(v) => updateParams({ status: v, page: "1" })} items={STATUS_ITEMS}>
              <SelectTrigger size="sm" className="w-auto" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_ITEMS).map(([value, label]) => <SelectItem key={value} value={value} label={label}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />
      <Reveal>
        <Pane legend={result ? `${result.total} total` : undefined} title="All generations" flush className="pb-3">
          {loading ? (
            <div className="px-6 py-4"><GhostRows rows={6} /></div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-err">{error}</p>
              <button type="button" className="btn btn-sm" onClick={refetch}>Try again</button>
            </div>
          ) : !result?.data.length ? (
            <div className="px-6 py-4"><GhostRows rows={5} label="Nothing matches these filters yet." /></div>
          ) : (
            <>
              <Scroller className="overflow-x-auto px-3 pt-2">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th className="w-10">Type</th>
                      <th>Prompt</th>
                      <th>Model</th>
                      <th>Priority</th>
                      <th>Created</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((gen) => {
                      const isImage = gen.type === GenerationType.IMAGE;
                      const retryable = gen.status === JobStatus.FAILED || gen.status === JobStatus.CANCELLED;
                      const cancellable = gen.status === JobStatus.PENDING || gen.status === JobStatus.GENERATING;
                      return (
                        <tr key={gen.id} className="cursor-pointer" onClick={() => setOpen(gen)} data-testid="history-row">
                          <td className="whitespace-nowrap"><StatusBadge status={gen.status} className="text-[13px]" /></td>
                          <td>{isImage ? <ImageIcon className="size-4 text-dim" aria-label="image" /> : <Type className="size-4 text-dim" aria-label="text" />}</td>
                          <td className="max-w-[44ch]"><span className="block truncate font-semibold" title={gen.prompt}>{gen.prompt}</span></td>
                          <td className="whitespace-nowrap text-sm text-ink-2">{modelLabelOf(gen)}</td>
                          <td><PriorityBadge priority={gen.priority} /></td>
                          <td className="whitespace-nowrap text-sm text-dim">{formatStamp(gen.createdAt)}</td>
                          <td className="text-right whitespace-nowrap">
                            {retryable && (
                              <button type="button" className="btn btn-ghost btn-xs" disabled={busyId === gen.id} onClick={(e) => { e.stopPropagation(); void handleRetry(gen); }} title="Retry">
                                <RotateCcw /> Retry
                              </button>
                            )}
                            {cancellable && (
                              <button type="button" className="btn btn-ghost btn-xs" disabled={busyId === gen.id} onClick={(e) => { e.stopPropagation(); void handleCancel(gen); }} title="Cancel">
                                <Ban /> Cancel
                              </button>
                            )}
                            {gen.status === JobStatus.FAILED && gen.error && (
                              <span className={cn("ml-2 hidden max-w-[24ch] truncate align-middle text-xs text-err lg:inline-block")} title={gen.error}>{gen.error}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Scroller>
              <Pager page={page} totalPages={result.totalPages} onPage={(p) => updateParams({ page: String(p) })} />
            </>
          )}
        </Pane>
      </Reveal>
      <GenerationDetailDialog generation={open} onClose={() => setOpen(null)} />
    </>
  );
}
