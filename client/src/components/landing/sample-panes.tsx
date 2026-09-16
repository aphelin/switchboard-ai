"use client";

import { Search, ImageIcon, Check, X, Plug } from "lucide-react";
import { API_ORIGIN } from "@/lib/auth-client";
import { MCP_SERVER_NAME } from "@/lib/site";
import { Pane } from "@/components/tui/pane";
import { Scroller } from "@/components/tui/scroller";
import { Badge } from "@/components/ui/badge";
import { GenerationRow } from "@/components/generation-row";
import { ResultRow } from "@/components/documents/result-row";
import { TraceCards, TraceRow, TraceTableHead } from "@/components/traces/trace-row";
import { TranscriptLine } from "@/components/chat/message-bubble";
import { ToolFrame } from "@/components/chat/tool-parts";
import { Markdown } from "@/components/chat/markdown";
import { SAMPLE_ANSWER, SAMPLE_CALLS, SAMPLE_IMAGE_REQUEST, SAMPLE_QUERY, SAMPLE_QUEUE, SAMPLE_RESULTS } from "./samples";

const SAMPLE = "Sample data";

/** The queue card as it looks with jobs in flight. */
export function QueueSample() {
  return (
    <Pane title="Queue" legend={<span className="status status-info" data-live="">2 running · {SAMPLE}</span>} flush className="pb-3">
      <div className="flex flex-col px-3 pt-3">
        {SAMPLE_QUEUE.map((job) => <GenerationRow key={job.id} generation={job} modelLabel={job.parameters ? "FLUX.1 Schnell" : undefined} />)}
      </div>
    </Pane>
  );
}

/** The retrieval tester after one hybrid query. */
export function RetrievalSample() {
  return (
    <Pane title="Test retrieval" legend={SAMPLE} tone="active">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-dim" />
        <p className="field truncate pl-11 leading-[46px]">{SAMPLE_QUERY}</p>
      </div>
      <p className="mt-4 mb-3 text-xs font-bold text-dim">3 results · hybrid</p>
      <ul className="flex flex-col gap-3">
        {SAMPLE_RESULTS.map((result, i) => <ResultRow key={result.chunkId} result={result} position={i + 1} />)}
      </ul>
    </Pane>
  );
}

/** A transcript with a search, a cited answer and an image request waiting for approval. */
export function ChatSample() {
  return (
    <Pane title="Conversation" legend={SAMPLE}>
      <div className="flex flex-col gap-4">
        <TranscriptLine speaker="You"><p>{SAMPLE_QUERY}</p></TranscriptLine>
        <TranscriptLine speaker="Agent" tone="agent">
          <div className="flex flex-col gap-3">
            <ToolFrame icon={Search} title={<>Searched documents <span className="font-normal text-dim">· “enterprise support sla”</span></>} status={<span className="text-dim">2 passages</span>} defaultOpen>
              <ul className="flex flex-col gap-2">
                {SAMPLE_RESULTS.slice(0, 2).map((passage, i) => (
                  <li key={passage.chunkId} className="rounded-xl bg-white/[0.06] px-3 py-2">
                    <p className="flex flex-wrap items-center gap-1.5"><span className="tag tag-accent">[{i + 1}]</span><span className="font-semibold">{passage.documentTitle}</span><span className="text-dim">chunk {passage.chunkIndex}</span></p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-ink-2">{passage.content}</p>
                  </li>
                ))}
              </ul>
            </ToolFrame>
            <Markdown content={SAMPLE_ANSWER} />
            <div className="text-sm">
              <p className="mb-1 text-xs font-bold text-dim">Sources</p>
              <ul className="flex flex-col gap-0.5">
                {SAMPLE_RESULTS.slice(0, 2).map((passage, i) => (
                  <li key={passage.chunkId} className="flex items-center gap-2"><span className="tag tag-accent">[{i + 1}]</span><span>{passage.documentTitle}<span className="text-dim"> · chunk {passage.chunkIndex}</span></span></li>
                ))}
              </ul>
            </div>
          </div>
        </TranscriptLine>
        <TranscriptLine speaker="You"><p>Generate an image of a red lighthouse at sunrise.</p></TranscriptLine>
        <TranscriptLine speaker="Agent" tone="agent">
          <ToolFrame icon={ImageIcon} title="Generate image" status={<Badge variant="ask">Needs approval</Badge>} collapsible={false} tone="ask">
            <div className="flex flex-col gap-2">
              <p className="text-[15px] font-medium">{SAMPLE_IMAGE_REQUEST.prompt}</p>
              <p className="text-dim">{SAMPLE_IMAGE_REQUEST.params}</p>
              <p className="text-dim">The agent wants to generate this image. Generating costs credits, so it waits for you.</p>
              <div className="flex gap-2 pt-1">
                <span className="btn btn-primary btn-sm pointer-events-none" title="Sample: open a session to approve real requests"><Check /> Approve</span>
                <span className="btn btn-glass btn-sm pointer-events-none" title="Sample: open a session to approve real requests"><X /> Deny</span>
              </div>
            </div>
          </ToolFrame>
        </TranscriptLine>
      </div>
    </Pane>
  );
}

/** The MCP connection: the one command, and what the key carries. */
export function McpSample() {
  return (
    <Pane title="Connect Claude Code" legend={<span className="flex items-center gap-1.5"><Plug className="size-3.5" /> MCP</span>} tone="ink">
      <pre className="overflow-x-auto rounded-[16px] border border-white/10 bg-black/35 px-4 py-3.5 font-data text-[13px] leading-6 whitespace-pre-wrap text-white/90">{`claude mcp add --transport http ${MCP_SERVER_NAME} \\\n  ${API_ORIGIN}/api/mcp \\\n  --header "x-api-key: <your key>"`}</pre>
    </Pane>
  );
}

/** Four ledger rows: a platform call, a cheap title call, an own-key image, a rejected key. */
export function TracesSample() {
  return (
    <Pane title="Calls" legend={`4 total · ${SAMPLE}`} flush className="pb-3">
      <Scroller className="hidden overflow-x-auto px-3 pt-2 sm:block">
        <table className="tbl">
          <TraceTableHead />
          <tbody>{SAMPLE_CALLS.map((call) => <TraceRow key={call.id} call={call} />)}</tbody>
        </table>
      </Scroller>
      <div className="px-4 pt-2 sm:hidden"><TraceCards calls={SAMPLE_CALLS} /></div>
    </Pane>
  );
}
