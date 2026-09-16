"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { ArrowUp, Square, RotateCcw, KeyRound, Paperclip, Mic, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Orb } from "@/components/tui/logo";
import { Spin } from "@/components/tui/spin";
import { DocumentDetailDialog } from "@/components/documents/document-detail-dialog";
import { GenerationDetailDialog } from "@/components/generation-card";
import { MessageList } from "./message-bubble";
import type { DocumentScope } from "./document-scope-selector";
import { getChatUrl, getGeneration, transcribeAudio } from "@/lib/api";
import { fromChatError, isBudgetError, isProviderKeyRequiredError, providerForKeyError, toastApiError } from "@/lib/api-errors";
import { notifyUnauthorized } from "@/lib/auth-events";
import { requestProviderDialog } from "@/lib/model-events";
import { fetchImageBlob, MAX_ATTACHMENTS, takeChatHandoff, toImageAttachment, type ImageAttachment } from "@/lib/images";
import { useModels } from "@/hooks/use-models";
import { cn } from "@/lib/utils";
import type { Generation, SourcePassage } from "@/lib/types";

interface ChatThreadProps {
  conversationId: string;
  initialMessages: UIMessage[];
  documentIds: string[];
  /** Which documents the agent may search: all, the ticked ones, or none (no search tools). */
  documentScope: DocumentScope;
  model?: string | null;
  onResponseFinished?: () => void;
}

const SUGGESTIONS = [
  "What is the Enterprise support SLA?",
  "Summarise the remote work policy in three bullets.",
  "Which documents do you have access to?",
  "Generate an image of a red lighthouse at sunrise.",
];

/** Recordings stop themselves here; the API refuses longer ones. */
const MAX_RECORD_SECONDS = 60;
/** The composer pill: one line tall at rest, growing with the text up to a few lines. */
const COMPOSER_MIN_PX = 62;
const COMPOSER_MAX_PX = 176;
const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const micSupported = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
const noop = () => () => {};

type Recording = "idle" | "recording" | "transcribing";

/** The transcript and the "Ask anything" pill for one conversation. */
export function ChatThread({ conversationId, initialMessages, documentIds, documentScope, model, onResponseFinished }: ChatThreadProps) {
  const transport = useMemo(() => new DefaultChatTransport({ api: getChatUrl(), credentials: "include" }), []);
  const requestOptions = { body: { documentIds, documentScope, model: model ?? undefined } };
  const { modelById } = useModels();
  const chatModel = modelById(model);
  const vision = chatModel?.capabilities.vision ?? true;

  const { messages, sendMessage, status, error, stop, regenerate, clearError, addToolApprovalResponse } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => onResponseFinished?.(),
    onError: (err) => {
      const apiError = fromChatError(err);
      if (apiError.status === 401) { notifyUnauthorized(); return; }
      toastApiError(apiError, "The assistant failed to respond", { model });
    },
  });

  const [input, setInput] = useState("");
  const [source, setSource] = useState<SourcePassage | null>(null);
  const [openGeneration, setOpenGeneration] = useState<Generation | null>(null);
  const sourceDocument = useMemo(() => (source ? { id: source.documentId, title: source.document } : null), [source]);

  const openGenerationById = (generationId: string) => {
    getGeneration(generationId)
      .then(setOpenGeneration)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not open the generation"));
  };
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Follows the reply only while the reader is at the foot of the transcript; scrolling up to reread stops it.
  const follow = useRef(true);
  const busy = status === "submitted" || status === "streaming";
  const displayError = error ? fromChatError(error) : null;
  const budgetReached = displayError ? isBudgetError(displayError) : false;
  const keyRequired = displayError ? isProviderKeyRequiredError(displayError) : false;

  // Images for the next message, already shrunk to data URLs.
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);

  // The microphone: a recording becomes text in the composer through the API's speech-to-text route.
  const canRecord = useSyncExternalStore(noop, micSupported, () => false);
  const [recording, setRecording] = useState<Recording>("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scrolls the transcript itself, never its ancestors: `scrollIntoView` would also move the page.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !follow.current) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // The pill grows with the text in every browser (`field-sizing: content` is Chrome only), so a
  // second line never scrolls out of sight behind the keys.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight + 2, COMPOSER_MIN_PX), COMPOSER_MAX_PX)}px`;
  }, [input]);

  // Opened from the gallery with "Ask the agent": the image arrives as the first attachment.
  useEffect(() => {
    if (initialMessages.length > 0) return;
    const handoff = takeChatHandoff();
    if (!handoff) return;
    let cancelled = false;
    fetchImageBlob(handoff.imageUrl)
      .then((blob) => toImageAttachment(blob, "generation.jpg"))
      .then((attachment) => {
        if (cancelled) return;
        setAttachments([attachment]);
        setInput((current) => current || "What is in this image?");
        inputRef.current?.focus();
      })
      .catch(() => toast.error("Could not attach the image"));
    return () => { cancelled = true; };
  }, [initialMessages.length]);

  // Leaving mid-recording releases the microphone.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const onListScroll = () => {
    const list = listRef.current;
    if (list) follow.current = list.scrollHeight - list.scrollTop - list.clientHeight < 96;
  };

  const submit = (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || busy) return;
    follow.current = true;
    sendMessage({ text: trimmed, files: attachments }, requestOptions);
    setInput("");
    setAttachments([]);
  };

  const handleApproval = (approvalId: string, approved: boolean) => {
    addToolApprovalResponse({ id: approvalId, approved, options: requestOptions });
  };

  const addFiles = async (files: Iterable<File>) => {
    const all = [...files];
    const images = all.filter((file) => file.type.startsWith("image/"));
    const room = MAX_ATTACHMENTS - attachments.length;
    if (images.length === 0) { if (all.length) toast.error("Only images can be attached"); return; }
    if (room <= 0) { toast.error(`At most ${MAX_ATTACHMENTS} images per message`); return; }
    setAttaching(true);
    try {
      const added = await Promise.all(images.slice(0, room).map((file) => toImageAttachment(file, file.name)));
      setAttachments((current) => [...current, ...added].slice(0, MAX_ATTACHMENTS));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not attach the image");
    } finally {
      setAttaching(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const finishRecording = async (blob: Blob) => {
    // A press with nothing said: a container this small holds no speech.
    if (blob.size < 1024) { setRecording("idle"); return; }
    setRecording("transcribing");
    try {
      const result = await transcribeAudio(blob, conversationId);
      if (result.text) {
        setInput((current) => (current.trim() ? `${current.trimEnd()} ${result.text}` : result.text));
        inputRef.current?.focus();
      } else {
        toast.message("Nothing was heard in the recording");
      }
    } catch (err) {
      toastApiError(err, "Could not transcribe the recording", { model });
    } finally {
      setRecording("idle");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void finishRecording(new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording("recording");
      setRecordSeconds(0);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setRecordSeconds(seconds);
        if (seconds >= MAX_RECORD_SECONDS) stopRecording();
      }, 500);
    } catch {
      toast.error("Microphone access was refused");
    }
  };

  const toggleRecording = () => {
    if (recording === "recording") stopRecording();
    else if (recording === "idle") void startRecording();
  };

  const placeholder =
    recording === "recording" ? "Listening. Press the microphone again to stop."
    : recording === "transcribing" ? "Transcribing…"
    : "Ask anything…";
  const canSend = (input.trim().length > 0 || attachments.length > 0) && !attaching;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} onScroll={onListScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" data-testid="chat-messages">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <Orb size={64} />
            <div className="max-w-md">
              <p className="text-2xl font-bold tracking-tight">What&apos;s on your mind?</p>
              <p className="mt-1 text-[15px] text-ink-2">The agent searches your documents, cites the passages it used, and asks before it generates an image.</p>
            </div>
            <ul className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button type="button" className="chip h-auto min-h-9 max-w-full py-1.5 text-left whitespace-normal" onClick={() => submit(suggestion)}>{suggestion}</button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <MessageList messages={messages} status={status} onApproval={handleApproval} onOpenSource={setSource} onOpenGeneration={openGenerationById} />
        )}
      </div>

      {displayError && (
        <div className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-err/10 px-4 py-2.5 text-sm text-err" data-testid="chat-error">
          <span className="min-w-0">
            {budgetReached && <span className="font-bold">Daily AI budget reached. </span>}
            {displayError.message}
          </span>
          <div className="flex shrink-0 gap-1">
            {keyRequired && (
              <button type="button" className="btn btn-xs" onClick={() => requestProviderDialog(providerForKeyError(displayError, model))} data-testid="chat-add-key"><KeyRound /> Add key</button>
            )}
            {!budgetReached && <button type="button" className="btn btn-xs" onClick={() => regenerate(requestOptions)}><RotateCcw /> Retry</button>}
            <button type="button" className="btn btn-ghost btn-xs" onClick={clearError}>Dismiss</button>
          </div>
        </div>
      )}

      <form className="px-5 pt-1 pb-5" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2" data-testid="chat-attachments">
            {attachments.map((attachment, index) => (
              <li key={`${index}-${attachment.url.length}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachment.url} alt={attachment.filename ?? "Attached image"} className="size-16 rounded-[8px] object-cover ring-1 ring-white/12" />
                <button type="button" className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-white text-ground shadow-pill" onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))} aria-label="Remove image">
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <Textarea
            ref={inputRef}
            data-prompt
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); } }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files].filter((file) => file.type.startsWith("image/"));
              if (files.length > 0 && vision) { e.preventDefault(); void addFiles(files); }
            }}
            placeholder={placeholder}
            aria-label="Message"
            rows={1}
            className="max-h-[176px] min-h-[62px] resize-none rounded-[31px] bg-transparent py-[18px] pr-[168px] pl-[24px]"
            data-testid="chat-input"
          />
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
          {/* Pixel sizes on purpose: the root font is 15px, so rem-based `size-10` is 37.5px and `right-2.5` 9.4px, which
              put the key off centre. A 40px key inset 11px in a 62px pill (radius 31) is concentric, so nothing pinches. */}
          <div className="absolute right-[11px] bottom-[11px] flex items-center gap-1.5">
            {recording === "recording" && (
              <span className="num-tab mr-1 flex items-center gap-1.5 text-xs font-semibold text-err" aria-live="polite">
                <span className="size-2 animate-pulse-soft rounded-full bg-err" aria-hidden="true" />
                {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
              </span>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-round h-[40px] w-[40px]"
              onClick={() => fileRef.current?.click()}
              disabled={!vision || attaching || attachments.length >= MAX_ATTACHMENTS}
              title={vision ? "Attach an image (or paste one)" : `${chatModel?.label ?? "This model"} cannot see images`}
              aria-label="Attach an image"
              data-testid="chat-attach"
            >
              {attaching ? <Spin /> : <Paperclip className="size-[18px]" />}
            </button>
            {canRecord && (
              <button
                type="button"
                className={cn("btn btn-ghost btn-icon btn-round h-[40px] w-[40px]", recording === "recording" && "bg-err/15 text-err hover:bg-err/25 hover:text-err")}
                onClick={toggleRecording}
                disabled={recording === "transcribing"}
                aria-pressed={recording === "recording"}
                aria-label={recording === "recording" ? "Stop recording" : "Dictate a message"}
                title={recording === "recording" ? "Stop and transcribe" : "Dictate (speech to text, priced per second)"}
                data-testid="chat-mic"
              >
                {recording === "transcribing" ? <Spin /> : <Mic className="size-[18px]" />}
              </button>
            )}
            {busy ? (
              <button type="button" className="btn btn-primary btn-icon btn-round h-[40px] w-[40px]" onClick={stop} data-testid="chat-stop" aria-label="Stop" title="Stop (also cancels an image in progress)">
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button type="submit" className="btn btn-accent btn-icon btn-round h-[40px] w-[40px]" disabled={!canSend} data-testid="chat-send" aria-label="Send">
                <ArrowUp className="size-5" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 hidden text-center text-xs text-dim sm:block">
          <kbd className="key">⏎</kbd> send · <kbd className="key">⇧⏎</kbd> new line
        </p>
      </form>

      <DocumentDetailDialog document={sourceDocument} focusChunk={source?.chunkIndex} onClose={() => setSource(null)} />
      <GenerationDetailDialog generation={openGeneration} onClose={() => setOpenGeneration(null)} />
    </div>
  );
}
