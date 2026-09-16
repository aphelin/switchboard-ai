"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, X, Search, ArrowDownUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeading } from "@/components/layout/page-heading";
import { Pane } from "@/components/tui/pane";
import { Scroller } from "@/components/tui/scroller";
import { GhostRows } from "@/components/tui/ghost";
import { Pager } from "@/components/tui/pager";
import { Spin } from "@/components/tui/spin";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { SortHeader, TraceCards, TraceRow, TraceTableHead, TRACE_TEXT_FIELDS, nextSort, useClientSort, type SortState } from "./trace-row";
import { getTraces, getTraceSummary } from "@/lib/api";
import { formatCost, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LlmCall, PaginatedResult, TraceSortField, TraceSummary } from "@/lib/types";
import { toast } from "sonner";

export { formatCost } from "@/lib/format";

const PAGE_LIMIT = 25;
const ALL_NAMES = "all";

type ModelRow = TraceSummary["byModel"][number];
type NameRow = TraceSummary["byName"][number];

const MODEL_COLUMNS = {
  model: (row: ModelRow) => row.model,
  calls: (row: ModelRow) => row.calls,
  tokens: (row: ModelRow) => row.inputTokens + row.outputTokens,
  cost: (row: ModelRow) => row.costUsd,
  latency: (row: ModelRow) => row.avgLatencyMs,
};
const NAME_COLUMNS = {
  name: (row: NameRow) => row.name,
  calls: (row: NameRow) => row.calls,
  cost: (row: NameRow) => row.costUsd,
  latency: (row: NameRow) => row.avgLatencyMs,
};
const SUMMARY_TEXT_FIELDS: ReadonlySet<string> = new Set(["model", "name"]);

/** Phone sort choices for the call cards, which have no header row to click. */
const CARD_SORTS: Array<{ value: string; label: string; sort: SortState<TraceSortField> }> = [
  { value: "createdAt:desc", label: "Newest first", sort: { field: "createdAt", order: "desc" } },
  { value: "createdAt:asc", label: "Oldest first", sort: { field: "createdAt", order: "asc" } },
  { value: "costUsd:desc", label: "Most expensive", sort: { field: "costUsd", order: "desc" } },
  { value: "latencyMs:desc", label: "Slowest", sort: { field: "latencyMs", order: "desc" } },
  { value: "inputTokens:desc", label: "Most tokens", sort: { field: "inputTokens", order: "desc" } },
];
const CARD_SORT_ITEMS = Object.fromEntries(CARD_SORTS.map((option) => [option.value, option.label]));

/** One readout in the totals strip: a label, a counter, a hint. */
function Readout({ label, value, hint, tone = "ink", className }: { label: string; value: string; hint?: string; tone?: "ink" | "err" | "ok" | "accent"; className?: string }) {
  return (
    <div className={cn("glass flex min-h-[124px] min-w-0 flex-col justify-between rounded-[22px] p-4", className)}>
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-2">
        <span className={cn("size-2 shrink-0 rounded-full", tone === "err" ? "bg-err" : tone === "ok" ? "bg-ok" : tone === "accent" ? "bg-accent" : "bg-white/5")} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <div className="min-w-0">
        <span className="led block text-[clamp(20px,6vw,26px)] leading-8 text-ink [overflow-wrap:anywhere]">{value}</span>
        {hint && <span className="text-xs text-dim">{hint}</span>}
      </div>
    </div>
  );
}

/** Window 5: the ledger. Totals, per-model and per-call-type tables, then every call. */
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
  const [callSort, setCallSort] = useState<SortState<TraceSortField>>({ field: "createdAt", order: "desc" });

  const byModel = useClientSort(summary?.byModel ?? [], MODEL_COLUMNS, { field: "cost", order: "desc" }, SUMMARY_TEXT_FIELDS);
  const byName = useClientSort(summary?.byName ?? [], NAME_COLUMNS, { field: "calls", order: "desc" }, SUMMARY_TEXT_FIELDS);

  useEffect(() => { setTraceIdInput(traceIdParam); setPage(1); }, [traceIdParam]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, callsData] = await Promise.all([
        getTraceSummary(),
        getTraces({ traceId: traceIdParam || undefined, name: name === ALL_NAMES ? undefined : name, sort: callSort.field, order: callSort.order, page, limit: PAGE_LIMIT }),
      ]);
      setSummary(summaryData);
      setCalls(callsData);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load traces"); }
    finally { setLoading(false); }
  }, [traceIdParam, name, callSort, page]);

  useEffect(() => { load(); }, [load]);

  const applyTraceId = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("traceId", value.trim()); else params.delete("traceId");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "/traces", { scroll: false });
  };

  // Sorting is done by the API, so it holds across pages; a new order starts from page one.
  const sortCalls = (field: TraceSortField) => { setCallSort((current) => nextSort(current, field, TRACE_TEXT_FIELDS)); setPage(1); };

  const totals = summary?.totals;
  const nameItems = { [ALL_NAMES]: "All call types", ...Object.fromEntries((summary?.byName ?? []).map((row) => [row.name, row.name])) };
  const cardSortValue = `${callSort.field}:${callSort.order}`;

  return (
    <>
      <PageHeading title="Traces" sub="Every model call the app makes, with tokens, estimated cost and latency. Filter by a conversation or generation id to follow one request." />
      <Stagger className="flex min-w-0 flex-col gap-6">
        <StaggerItem className="min-w-0">
          {!totals ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer h-[124px] rounded-[22px]" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Readout label="Calls" value={totals.calls.toLocaleString()} />
              <Readout label="Errors" value={totals.errors.toLocaleString()} hint={totals.calls ? `${((totals.errors / totals.calls) * 100).toFixed(1)}% of calls` : undefined} tone={totals.errors ? "err" : "ok"} />
              <Readout label="Tokens in / out" value={`${formatTokens(totals.inputTokens)} / ${formatTokens(totals.outputTokens)}`} className="col-span-2 sm:col-span-1" />
              <Readout label="Cost" value={formatCost(totals.costUsd)} hint="platform + own keys, USD" tone="accent" />
              <Readout label="Avg latency" value={`${totals.avgLatencyMs.toLocaleString()} ms`} className="sm:col-span-1" />
            </div>
          )}
        </StaggerItem>

        <StaggerItem className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Pane title="By model" flush className="min-w-0 pb-3">
            <Scroller className="overflow-x-auto px-3 pt-2">
              <table className="tbl">
                <thead>
                  <tr>
                    <SortHeader label="Model" field="model" sort={byModel.sort} onSort={byModel.onSort} />
                    <SortHeader label="Calls" field="calls" sort={byModel.sort} onSort={byModel.onSort} numeric />
                    <SortHeader label="In / out" field="tokens" sort={byModel.sort} onSort={byModel.onSort} numeric />
                    <SortHeader label="Cost" field="cost" sort={byModel.sort} onSort={byModel.onSort} numeric />
                    <SortHeader label="Avg ms" field="latency" sort={byModel.sort} onSort={byModel.onSort} numeric />
                  </tr>
                </thead>
                <tbody>
                  {byModel.rows.length ? byModel.rows.map((row) => (
                    <tr key={`${row.provider}/${row.model}`}>
                      <td className="whitespace-nowrap"><span className="text-sm font-medium">{row.model}</span><span className="ml-1.5 text-xs text-dim">{row.provider}</span></td>
                      <td className="num text-sm">{row.calls}</td>
                      <td className="num text-sm">{formatTokens(row.inputTokens)} / {formatTokens(row.outputTokens)}</td>
                      <td className="num num-tab text-sm">{formatCost(row.costUsd)}</td>
                      <td className="num text-sm">{row.avgLatencyMs}</td>
                    </tr>
                  )) : <tr><td colSpan={5} className="py-3"><GhostRows rows={2} label="No calls recorded yet" /></td></tr>}
                </tbody>
              </table>
            </Scroller>
          </Pane>
          <Pane title="By call type" flush className="min-w-0 pb-3">
            <Scroller className="overflow-x-auto px-3 pt-2">
              <table className="tbl">
                <thead>
                  <tr>
                    <SortHeader label="Name" field="name" sort={byName.sort} onSort={byName.onSort} />
                    <SortHeader label="Calls" field="calls" sort={byName.sort} onSort={byName.onSort} numeric />
                    <SortHeader label="Cost" field="cost" sort={byName.sort} onSort={byName.onSort} numeric />
                    <SortHeader label="Avg ms" field="latency" sort={byName.sort} onSort={byName.onSort} numeric />
                  </tr>
                </thead>
                <tbody>
                  {byName.rows.length ? byName.rows.map((row) => (
                    <tr key={row.name}>
                      <td className="text-sm font-semibold whitespace-nowrap">{row.name}</td>
                      <td className="num text-sm">{row.calls}</td>
                      <td className="num num-tab text-sm">{formatCost(row.costUsd)}</td>
                      <td className="num text-sm">{row.avgLatencyMs}</td>
                    </tr>
                  )) : <tr><td colSpan={4} className="py-3"><GhostRows rows={2} label="No calls recorded yet" /></td></tr>}
                </tbody>
              </table>
            </Scroller>
          </Pane>
        </StaggerItem>

        <StaggerItem className="min-w-0">
          <Pane title="Calls" legend={calls ? `${calls.total} total${traceIdParam ? " · filtered by trace" : ""}` : undefined} flush className="min-w-0 pb-3">
            <form className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3 sm:px-6" onSubmit={(e) => { e.preventDefault(); applyTraceId(traceIdInput); }}>
              <div className="relative w-full sm:w-96 sm:max-w-full">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-dim" />
                <Input placeholder="Filter by trace id (conversation or generation id)" aria-label="Trace id filter" value={traceIdInput} onChange={(e) => setTraceIdInput(e.target.value)} className="field-sm field-data h-10 pr-9 pl-10" data-testid="trace-filter" />
                {traceIdParam && (
                  <button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 text-dim hover:text-ink" onClick={() => applyTraceId("")} title="Clear filter" aria-label="Clear filter"><X className="size-4" /></button>
                )}
              </div>
              <Select value={name} onValueChange={(v) => { setName(v ?? ALL_NAMES); setPage(1); }} items={nameItems}>
                <SelectTrigger size="sm" className="w-auto max-w-full" aria-label="Call type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_NAMES} label="All call types">All call types</SelectItem>
                  {summary?.byName.map((row) => <SelectItem key={row.name} value={row.name} label={row.name}>{row.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="sm:hidden">
                <Select value={cardSortValue} onValueChange={(v) => { const option = CARD_SORTS.find((o) => o.value === v); if (option) { setCallSort(option.sort); setPage(1); } }} items={CARD_SORT_ITEMS}>
                  <SelectTrigger size="sm" className="w-auto" aria-label="Sort calls"><ArrowDownUp className="size-4 text-dim" /><SelectValue placeholder="Sorted" /></SelectTrigger>
                  <SelectContent>
                    {CARD_SORTS.map((option) => <SelectItem key={option.value} value={option.value} label={option.label}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <button type="submit" className="btn btn-glass btn-sm">Apply</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
                {loading ? <Spin /> : <RefreshCw />} Refresh
              </button>
            </form>
            <Scroller className="hidden overflow-x-auto px-3 sm:block">
              <table className="tbl">
                <TraceTableHead sort={callSort} onSort={sortCalls} />
                <tbody>
                  {loading && !calls ? (
                    <tr><td colSpan={8} className="py-3"><GhostRows rows={4} /></td></tr>
                  ) : calls?.data.length ? (
                    calls.data.map((call) => <TraceRow key={call.id} call={call} onTrace={applyTraceId} />)
                  ) : (
                    <tr><td colSpan={8} className="py-3"><GhostRows rows={3} label="No model calls match these filters" /></td></tr>
                  )}
                </tbody>
              </table>
            </Scroller>
            <div className="px-3 sm:hidden">
              {loading && !calls ? <GhostRows rows={4} /> : calls?.data.length ? <TraceCards calls={calls.data} onTrace={applyTraceId} /> : <GhostRows rows={3} label="No model calls match these filters" />}
            </div>
            {calls && <Pager page={page} totalPages={calls.totalPages} onPage={setPage} />}
          </Pane>
        </StaggerItem>
      </Stagger>
    </>
  );
}
