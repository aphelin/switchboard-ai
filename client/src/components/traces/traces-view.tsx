"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Coins,
  Gauge,
  Hash,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTraces, getTraceSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LlmCall, PaginatedResult, TraceSummary } from "@/lib/types";
import { toast } from "sonner";

const PAGE_LIMIT = 25;
const ALL_NAMES = "all";

export const formatCost = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : `$${value.toFixed(6)}`;

const formatTokens = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : value.toLocaleString();

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold leading-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function TracesView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const traceIdParam = searchParams.get("traceId") ?? "";

  const [summary, setSummary] = useState<TraceSummary | null>(null);
  const [calls, setCalls] = useState<PaginatedResult<LlmCall> | null>(null);
  const [loading, setLoading] = useState(true);
  const [traceIdInput, setTraceIdInput] = useState(traceIdParam);
  const [name, setName] = useState(ALL_NAMES);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setTraceIdInput(traceIdParam);
    setPage(1);
  }, [traceIdParam]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, callsData] = await Promise.all([
        getTraceSummary(),
        getTraces({
          traceId: traceIdParam || undefined,
          name: name === ALL_NAMES ? undefined : name,
          page,
          limit: PAGE_LIMIT,
        }),
      ]);
      setSummary(summaryData);
      setCalls(callsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load traces");
    } finally {
      setLoading(false);
    }
  }, [traceIdParam, name, page]);

  useEffect(() => {
    load();
  }, [load]);

  const applyTraceId = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("traceId", value.trim());
    else params.delete("traceId");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "/traces", { scroll: false });
  };

  const totals = summary?.totals;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {!summary ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : (
          <>
            <StatCard icon={Hash} label="LLM calls" value={totals!.calls.toLocaleString()} />
            <StatCard
              icon={AlertTriangle}
              label="Errors"
              value={totals!.errors.toLocaleString()}
              hint={totals!.calls ? `${((totals!.errors / totals!.calls) * 100).toFixed(1)}% of calls` : undefined}
            />
            <StatCard
              icon={Activity}
              label="Tokens in / out"
              value={`${formatTokens(totals!.inputTokens)} / ${formatTokens(totals!.outputTokens)}`}
            />
            <StatCard icon={Coins} label="Total cost" value={formatCost(totals!.costUsd)} hint="estimated, USD" />
            <StatCard icon={Gauge} label="Avg latency" value={`${totals!.avgLatencyMs.toLocaleString()} ms`} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By model</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">In / out</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Avg ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.byModel.length ? (
                  summary.byModel.map((row) => (
                    <TableRow key={`${row.provider}/${row.model}`}>
                      <TableCell>
                        <span className="font-mono text-xs">{row.model}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{row.provider}</span>
                      </TableCell>
                      <TableCell className="text-right">{row.calls}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatTokens(row.inputTokens)} / {formatTokens(row.outputTokens)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCost(row.costUsd)}</TableCell>
                      <TableCell className="text-right">{row.avgLatencyMs}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No calls recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By call type</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Avg ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.byName.length ? (
                  summary.byName.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-mono text-xs">{row.name}</TableCell>
                      <TableCell className="text-right">{row.calls}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCost(row.costUsd)}</TableCell>
                      <TableCell className="text-right">{row.avgLatencyMs}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No calls recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Calls
            {calls && (
              <span className="text-xs font-normal text-muted-foreground">
                {calls.total} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyTraceId(traceIdInput);
            }}
          >
            <div className="relative">
              <Input
                placeholder="Filter by trace id (conversation / generation id)"
                value={traceIdInput}
                onChange={(e) => setTraceIdInput(e.target.value)}
                className="w-[320px] max-w-full pr-8 font-mono text-xs"
                data-testid="trace-filter"
              />
              {traceIdParam && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => applyTraceId("")}
                  title="Clear filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              value={name}
              onValueChange={(v) => {
                setName(v ?? ALL_NAMES);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_NAMES}>All call types</SelectItem>
                {summary?.byName.map((row) => (
                  <SelectItem key={row.name} value={row.name}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={load}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </form>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">In / out</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !calls ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : calls?.data.length ? (
                  calls.data.map((call) => (
                    <TableRow
                      key={call.id}
                      className={cn(call.status === "error" && "bg-destructive/5")}
                      data-testid="trace-row"
                    >
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(call.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{call.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{call.model}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{call.provider}</span>
                        {call.keySource === "user" && (
                          <Badge
                            variant="secondary"
                            className="ml-1.5 h-4 px-1.5 text-[10px]"
                            title="Billed to your own provider key; not counted in the daily budget"
                            data-testid="trace-key-source"
                          >
                            your key
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                        {formatTokens(call.inputTokens)} / {formatTokens(call.outputTokens)}
                        {call.cachedInputTokens ? (
                          <span className="text-muted-foreground"> ({call.cachedInputTokens} cached)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCost(call.costUsd)}</TableCell>
                      <TableCell className="text-right text-xs">{call.latencyMs.toLocaleString()} ms</TableCell>
                      <TableCell>
                        {call.status === "error" ? (
                          <Badge variant="destructive" title={call.error ?? undefined}>
                            error
                          </Badge>
                        ) : (
                          <Badge variant="outline">ok</Badge>
                        )}
                        {call.error && (
                          <p className="mt-1 max-w-[240px] truncate text-xs text-destructive" title={call.error}>
                            {call.error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.traceId ? (
                          <button
                            type="button"
                            className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                            onClick={() => applyTraceId(call.traceId!)}
                            title={call.traceId}
                          >
                            {call.traceId.slice(0, 8)}…
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No LLM calls match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {calls && calls.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {calls.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= calls.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
