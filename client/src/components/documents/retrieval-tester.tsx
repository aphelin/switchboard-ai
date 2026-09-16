"use client";

import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pane, PaneRule } from "@/components/tui/pane";
import { Spin } from "@/components/tui/spin";
import { ResultRow } from "./result-row";
import { searchDocuments } from "@/lib/api";
import { SearchMode, SEARCH_MODE_LABELS } from "@/lib/constants";
import type { SearchResponse } from "@/lib/types";
import { toast } from "sonner";

const TOP_K_OPTIONS = ["3", "5", "10"];
const TOP_K_ITEMS = Object.fromEntries(TOP_K_OPTIONS.map((k) => [k, `Top ${k}`]));
const MODE_CHIPS: Array<{ value: SearchMode; label: string }> = [
  { value: SearchMode.HYBRID, label: "Hybrid" },
  { value: SearchMode.VECTOR, label: "Vector" },
  { value: SearchMode.KEYWORD, label: "Keyword" },
];

/** Ask the retriever directly and see the passages, scores and ranks the agent would get. */
export function RetrievalTester() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>(SearchMode.HYBRID);
  const [topK, setTopK] = useState("5");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);

  const runSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try { setResponse(await searchDocuments({ query: query.trim(), mode, topK: Number(topK) })); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Search failed"); }
    finally { setLoading(false); }
  };

  return (
    <Pane title="Test retrieval" legend="What the agent would see" tone="active">
      <form onSubmit={runSearch} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-dim" />
            <Input data-prompt placeholder="Ask the documents" aria-label="Retrieval query" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-11" data-testid="retrieval-query" />
          </div>
          <button type="submit" className="btn btn-primary h-12 shrink-0 rounded-[16px] px-4" disabled={loading || !query.trim()}>
            {loading ? <Spin /> : <ArrowRight />}
            Search
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="chips" role="group" aria-label="Search mode">
            {MODE_CHIPS.map((chip) => (
              <button key={chip.value} type="button" className="chip chip-sm" data-active={mode === chip.value ? "" : undefined} aria-pressed={mode === chip.value} onClick={() => setMode(chip.value)} title={SEARCH_MODE_LABELS[chip.value]}>
                {chip.label}
              </button>
            ))}
          </div>
          <Select value={topK} onValueChange={(v) => setTopK(v ?? "5")} items={TOP_K_ITEMS}>
            <SelectTrigger size="sm" className="w-auto" aria-label="Number of results"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TOP_K_OPTIONS.map((value) => <SelectItem key={value} value={value} label={`Top ${value}`}>Top {value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </form>

      <p className="mt-4 text-sm leading-6 text-ink-2">
        Hybrid mode runs a vector search (meaning) and a keyword search (exact terms) in parallel and merges them with Reciprocal Rank Fusion. The fused score only orders results; the V and K ranks show where each retriever placed the passage.
      </p>

      {response && (
        <div className="mt-4">
          <PaneRule label={`${response.results.length} result${response.results.length === 1 ? "" : "s"} · ${response.mode}`} className="mb-3" />
          {response.results.length === 0 ? (
            <p className="rounded-[20px] border-2 border-dashed border-white/15 px-4 py-6 text-center text-sm text-dim">Nothing matched. Add documents or try different wording.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {response.results.map((result, i) => <ResultRow key={result.chunkId} result={result} position={i + 1} />)}
            </ul>
          )}
        </div>
      )}
    </Pane>
  );
}
