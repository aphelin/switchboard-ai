"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { useGenerations } from "@/hooks/use-generations";
import { useSSE } from "@/hooks/use-sse";
import { GenerationCard } from "./generation-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { JobStatus } from "@/lib/constants";
import { toast } from "sonner";

const HISTORY_LIMIT = 12;
const ALL_FILTER = "all";

export function GenerationHistory() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const typeFilter = searchParams.get("type") || ALL_FILTER;
  const statusFilter = searchParams.get("status") || ALL_FILTER;
  const page = Number(searchParams.get("page")) || 1;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        const isDefault =
          value === null ||
          value === ALL_FILTER ||
          (key === "page" && value === "1");
        if (isDefault) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    },
    [searchParams, router],
  );

  const { result, loading, error, handleSSEEvent, refetch } = useGenerations({
    type: typeFilter !== ALL_FILTER ? typeFilter : undefined,
    status: statusFilter !== ALL_FILTER ? statusFilter : undefined,
    page,
    limit: HISTORY_LIMIT,
  });

  useSSE((event) => {
    handleSSEEvent(event);
    if (event.status === JobStatus.FAILED) {
      toast.error(event.error ?? "Generation failed");
    }
  }, refetch);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={typeFilter}
          onValueChange={(v) => updateParams({ type: v, page: "1" })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="IMAGE">Image</SelectItem>
            <SelectItem value="TEXT">Text</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => updateParams({ status: v, page: "1" })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="GENERATING">Generating</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={refetch} className="text-sm text-primary underline">
            Try again
          </button>
        </div>
      ) : !result?.data.length ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No generations found</p>
            <p className="text-sm text-muted-foreground">
              Adjust your filters or create a new generation.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.map((gen) => (
              <GenerationCard
                key={gen.id}
                generation={gen}
                onUpdate={refetch}
                showActions
              />
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {result.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
