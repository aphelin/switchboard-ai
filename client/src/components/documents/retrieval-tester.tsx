"use client";

import { useState } from "react";
import { Search, Loader2, ShieldAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchDocuments } from "@/lib/api";
import { SearchMode, SEARCH_MODE_LABELS } from "@/lib/constants";
import type { SearchResponse, SearchResult } from "@/lib/types";
import { toast } from "sonner";

const TOP_K_OPTIONS = ["3", "5", "10"];

function ScorePill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function ResultCard({ result, position }: { result: SearchResult; position: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-lg border p-3" data-testid="search-result">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">#{position}</span>
        <span className="truncate text-sm font-medium">{result.documentTitle}</span>
        <span className="text-xs text-muted-foreground">chunk {result.chunkIndex}</span>
        {result.flagged && (
          <Badge
            variant="destructive"
            className="gap-1"
            title={`Possible prompt injection: ${result.flagReasons.join("; ")}`}
          >
            <ShieldAlert className="h-3 w-3" />
            suspicious
          </Badge>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <ScorePill label="fused" value={result.score.toFixed(4)} />
        {result.vectorScore !== undefined && (
          <ScorePill label="vector sim" value={result.vectorScore.toFixed(3)} />
        )}
        {result.keywordScore !== undefined && (
          <ScorePill label="keyword" value={result.keywordScore.toFixed(3)} />
        )}
        {result.ranks.vector !== undefined && (
          <ScorePill label="V rank" value={`#${result.ranks.vector}`} />
        )}
        {result.ranks.keyword !== undefined && (
          <ScorePill label="K rank" value={`#${result.ranks.keyword}`} />
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full whitespace-pre-wrap text-left text-xs leading-relaxed text-muted-foreground ${expanded ? "" : "line-clamp-3"}`}
        title={expanded ? "Click to collapse" : "Click to expand"}
      >
        {result.content}
      </button>

      {result.flagged && (
        <p className="mt-2 text-xs text-destructive">
          Flagged: {result.flagReasons.join("; ")}. The assistant is told to treat this passage as untrusted data.
        </p>
      )}
    </li>
  );
}

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
    try {
      const data = await searchDocuments({
        query: query.trim(),
        mode,
        topK: Number(topK),
      });
      setResponse(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5" />
          Test retrieval
        </CardTitle>
        <CardDescription>
          See which passages the assistant would receive for a question.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={runSearch} className="space-y-3">
          <Input
            placeholder="Ask something the documents can answer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="retrieval-query"
          />
          <div className="flex flex-wrap gap-2">
            <Select value={mode} onValueChange={(v) => setMode((v as SearchMode) ?? SearchMode.HYBRID)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SearchMode).map((value) => (
                  <SelectItem key={value} value={value}>
                    {SEARCH_MODE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={topK} onValueChange={(v) => setTopK(v ?? "5")}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOP_K_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    top {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading || !query.trim()} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </form>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Hybrid mode runs a vector search (meaning) and a keyword search
            (exact terms) in parallel and merges them with Reciprocal Rank
            Fusion. The fused score only orders results; the V/K ranks show
            where each retriever placed the passage.
          </span>
        </p>

        {response && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {response.results.length} result
              {response.results.length === 1 ? "" : "s"} for &ldquo;{response.query}&rdquo; ({response.mode})
            </p>
            {response.results.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nothing matched. Add documents or try different wording.
              </p>
            ) : (
              <ul className="space-y-2">
                {response.results.map((result, i) => (
                  <ResultCard key={result.chunkId} result={result} position={i + 1} />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
