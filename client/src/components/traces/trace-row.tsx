"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatCost, formatStamp, formatTokens, shortId } from "@/lib/format";
import { Mark } from "@/components/tui/mark";
import { Badge } from "@/components/ui/badge";
import type { LlmCall, TraceSortField } from "@/lib/types";

export type SortOrder = "asc" | "desc";

export interface SortState<K extends string> {
  field: K;
  order: SortOrder;
}

/** Clicking the sorted column flips it; a new column starts A→Z for text and largest-first for numbers and time. */
export function nextSort<K extends string>(current: SortState<K>, field: K, textFields: ReadonlySet<string>): SortState<K> {
  if (current.field === field) return { field, order: current.order === "asc" ? "desc" : "asc" };
  return { field, order: textFields.has(field) ? "asc" : "desc" };
}

/** A header cell whose label sorts the column. Without `onSort` it is a plain header. */
export function SortHeader<K extends string>({ label, field, sort, onSort, numeric }: { label: string; field: K; sort?: SortState<K>; onSort?: (field: K) => void; numeric?: boolean }) {
  if (!onSort) return <th className={numeric ? "num" : undefined}>{label}</th>;
  const active = sort?.field === field;
  const Icon = !active ? ArrowUpDown : sort.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={numeric ? "num" : undefined} aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sort-btn" data-active={active ? "" : undefined} onClick={() => onSort(field)} title={`Sort by ${label.toLowerCase()}`}>
        {label}
        <Icon aria-hidden="true" />
      </button>
    </th>
  );
}

const NO_TEXT_FIELDS: ReadonlySet<string> = new Set();

/** Sorts rows that are all on the page already (the summary tables). */
export function useClientSort<T, K extends string>(
  rows: T[],
  columns: Record<K, (row: T) => string | number | null>,
  initial: SortState<NoInfer<K>>,
  textFields: ReadonlySet<string> = NO_TEXT_FIELDS,
) {
  const [sort, setSort] = useState(initial);
  const value = columns[sort.field];
  const sorted = [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const diff = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return sort.order === "asc" ? diff : -diff;
  });
  return { rows: sorted, sort, onSort: (field: K) => setSort((current) => nextSort(current, field, textFields)) };
}

export const TRACE_TEXT_FIELDS: ReadonlySet<string> = new Set<TraceSortField>(["name", "model", "status"]);

export function TraceTableHead({ sort, onSort }: { sort?: SortState<TraceSortField>; onSort?: (field: TraceSortField) => void }) {
  return (
    <thead>
      <tr>
        <SortHeader label="Time" field="createdAt" sort={sort} onSort={onSort} />
        <SortHeader label="Name" field="name" sort={sort} onSort={onSort} />
        <SortHeader label="Model" field="model" sort={sort} onSort={onSort} />
        <SortHeader label="In / out" field="inputTokens" sort={sort} onSort={onSort} numeric />
        <SortHeader label="Cost" field="costUsd" sort={sort} onSort={onSort} numeric />
        <SortHeader label="Latency" field="latencyMs" sort={sort} onSort={onSort} numeric />
        <SortHeader label="Status" field="status" sort={sort} onSort={onSort} />
        <th>Trace</th>
      </tr>
    </thead>
  );
}

/** The same calls as stacked cards, for phones. */
export function TraceCards({ calls, onTrace }: { calls: LlmCall[]; onTrace?: (traceId: string) => void }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="trace-cards">
      {calls.map((call) => {
        const failed = call.status === "error";
        return (
          <li key={call.id} className="glass-inner min-w-0 px-4 py-3" data-testid="trace-row" data-tone={failed ? "err" : undefined}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-bold">{call.name}</span>
              {failed ? <Mark tone="err" className="text-[13px]">Error</Mark> : <Mark tone="ok" className="text-[13px]">OK</Mark>}
            </div>
            <p className="truncate text-xs text-dim">{call.model} · {call.provider}{call.keySource === "user" ? " · your key" : ""}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span><span className="text-dim">cost </span><span className="num-tab">{formatCost(call.costUsd)}</span></span>
              <span><span className="text-dim">tokens </span><span className="num-tab">{formatTokens(call.inputTokens)} / {formatTokens(call.outputTokens)}</span></span>
              <span><span className="text-dim">latency </span><span className="num-tab">{call.latencyMs.toLocaleString()} ms</span></span>
            </div>
            <p className="mt-1 flex items-center justify-between gap-2 text-xs text-dim">
              <span suppressHydrationWarning>{formatStamp(call.createdAt)}</span>
              {call.traceId && (onTrace ? <button type="button" className="tag tag-info" onClick={() => onTrace(call.traceId!)}>{shortId(call.traceId)}</button> : <span className="tag tag-info">{shortId(call.traceId)}</span>)}
            </p>
            {call.error && <p className="mt-1 text-xs text-err [overflow-wrap:anywhere]">{call.error}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** One model call as one ledger row. */
export function TraceRow({ call, onTrace }: { call: LlmCall; onTrace?: (traceId: string) => void }) {
  const failed = call.status === "error";
  return (
    <tr data-testid="trace-row" data-tone={failed ? "err" : undefined}>
      <td className="whitespace-nowrap text-sm text-dim" suppressHydrationWarning>{formatStamp(call.createdAt)}</td>
      <td className="whitespace-nowrap text-sm font-semibold">{call.name}</td>
      <td className="whitespace-nowrap">
        <span className="text-sm font-medium">{call.model}</span>
        <span className="ml-1.5 text-xs text-dim">{call.provider}</span>
        {call.keySource === "user" && <Badge variant="warning" className="ml-2" title="Billed to your own provider key and not counted in the daily budget" data-testid="trace-key-source">Your key</Badge>}
      </td>
      <td className="num text-sm">{formatTokens(call.inputTokens)} / {formatTokens(call.outputTokens)}{call.cachedInputTokens ? <span className="text-dim"> ({call.cachedInputTokens} cached)</span> : null}</td>
      <td className="num num-tab text-sm">{formatCost(call.costUsd)}</td>
      <td className="num text-sm">{call.latencyMs.toLocaleString()} ms</td>
      <td>
        {failed ? <Mark tone="err" title={call.error ?? undefined}>Error</Mark> : <Mark tone="ok">OK</Mark>}
        {call.error && <p className="max-w-[28ch] truncate text-xs text-err" title={call.error}>{call.error}</p>}
      </td>
      <td>
        {call.traceId ? (
          onTrace ? <button type="button" className="tag tag-info" onClick={() => onTrace(call.traceId!)} title={call.traceId}>{shortId(call.traceId)}</button>
                  : <span className="tag tag-info" title={call.traceId}>{shortId(call.traceId)}</span>
        ) : <span className="text-sm text-dim">—</span>}
      </td>
    </tr>
  );
}
