"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/types";

function Score({ label, value }: { label: string; value: string }) {
  return (
    <span className="tag">
      <span className="text-dim">{label}</span>
      <span className="num-tab text-ink">{value}</span>
    </span>
  );
}

/** One retrieved passage with its fused score and per-retriever ranks. */
export function ResultRow({ result, position }: { result: SearchResult; position: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="glass-inner px-4 py-3" data-testid="search-result">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex size-6 items-center justify-center rounded-full bg-white text-xs font-bold text-ground">{position}</span>
        <span className="truncate font-semibold">{result.documentTitle}</span>
        <span className="text-sm text-dim">chunk {result.chunkIndex}</span>
        {result.flagged && (
          <Badge variant="destructive" title={`Possible prompt injection: ${result.flagReasons.join("; ")}`}><ShieldAlert />Suspicious</Badge>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Score label="fused" value={result.score.toFixed(4)} />
        {result.vectorScore !== undefined && <Score label="vector" value={result.vectorScore.toFixed(3)} />}
        {result.keywordScore !== undefined && <Score label="keyword" value={result.keywordScore.toFixed(3)} />}
        {result.ranks.vector !== undefined && <Score label="V" value={`#${result.ranks.vector}`} />}
        {result.ranks.keyword !== undefined && <Score label="K" value={`#${result.ranks.keyword}`} />}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn("mt-2 w-full whitespace-pre-wrap text-left text-sm leading-6 text-ink-2", expanded ? "" : "line-clamp-3")}
        title={expanded ? "Click to collapse" : "Click to expand"}
        aria-expanded={expanded}
      >
        {result.content}
      </button>
      {result.flagged && (
        <p className="mt-2 text-sm text-err">Flagged: {result.flagReasons.join("; ")}. The assistant treats this passage as untrusted data.</p>
      )}
    </li>
  );
}
