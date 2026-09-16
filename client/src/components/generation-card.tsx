"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Type, ChevronLeft, ChevronRight, Trash2, Wand2, MessageSquare, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Spin } from "@/components/tui/spin";
import { GeneratedImage } from "@/components/generated-image";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ModelPicker } from "@/components/models/model-picker";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { createGeneration, getGeneration } from "@/lib/api";
import { toastApiError } from "@/lib/api-errors";
import { GenerationType, JobStatus } from "@/lib/constants";
import { formatStamp } from "@/lib/format";
import { setChatHandoff } from "@/lib/images";
import type { Generation } from "@/lib/types";
import { useModels } from "@/hooks/use-models";
import { cn } from "@/lib/utils";
import { useLastDefined } from "@/hooks/use-last-defined";
import { Reveal } from "@/components/motion/reveal";

function useModelLabel(generation: Generation): { raw: string; label: string } {
  const { modelById, imageModelById } = useModels();
  const isImage = generation.type === GenerationType.IMAGE;
  const raw = generation.parameters?.model ? String(generation.parameters.model) : isImage ? "flux" : "openai";
  const label = (isImage ? imageModelById(raw) : modelById(raw))?.label ?? raw;
  return { raw, label };
}

interface GenerationCardProps {
  generation: Generation;
  onOpen?: (generation: Generation) => void;
  className?: string;
}

/** A gallery tile: the image in a white glass frame with its caption underneath. */
export function GenerationCard({ generation, onOpen, className }: GenerationCardProps) {
  const { label } = useModelLabel(generation);
  const isImage = generation.type === GenerationType.IMAGE;
  const done = generation.status === JobStatus.COMPLETED;

  return (
    <article
      className={cn("glass lift group flex cursor-pointer flex-col rounded-[26px] p-2 focus-visible:outline-2 focus-visible:outline-accent", className)}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(generation)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(generation); } }}
      data-testid="generation-tile"
    >
      {isImage && done && generation.imageUrl ? (
        <div className="relative aspect-square overflow-hidden rounded-[20px] bg-ground-2">
          <GeneratedImage src={generation.imageUrl} alt={generation.prompt} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
      ) : (
        <div className="cover flex aspect-square flex-col justify-between rounded-[20px] p-4" data-cover={isImage ? "generate" : "chat"}>
          <span className="flex size-9 items-center justify-center rounded-full bg-white/8 text-ink">
            {isImage ? <ImageIcon className="size-4" /> : <Type className="size-4" />}
          </span>
          {done && generation.textResult ? (
            <p className="line-clamp-5 text-sm leading-5 text-white/80">{generation.textResult}</p>
          ) : generation.status === JobStatus.FAILED && generation.error ? (
            <p className="line-clamp-3 text-sm text-err">{generation.error}</p>
          ) : (
            <StatusBadge status={generation.status} />
          )}
        </div>
      )}
      <div className="px-2.5 pt-2.5 pb-1.5">
        <p className="line-clamp-1 text-[15px] font-semibold" title={generation.prompt}>{generation.prompt}</p>
        <p className="flex items-center justify-between gap-2 text-xs text-dim">
          <span className="truncate">{label}</span>
          <time dateTime={generation.createdAt} className="shrink-0" suppressHydrationWarning>{formatStamp(generation.createdAt)}</time>
        </p>
      </div>
    </article>
  );
}

interface GenerationDetailDialogProps {
  generation: Generation | null;
  onClose: () => void;
  /** The list the viewer was opened from: enables previous / next (buttons and arrow keys). */
  items?: Generation[];
  onNavigate?: (generation: Generation) => void;
  /** Shows a Delete action (with an inline confirm); resolves once the generation is gone. */
  onDelete?: (generation: Generation) => Promise<void>;
  onQueued?: () => void;
}

type BrowseDirection = "prev" | "next";

/**
 * The viewer. Previous / next are round keys patched to the sheet's outer edges (from `lg`) and
 * keys in the footer below that; the arrow keys browse too. The content slides in from the side it
 * came from.
 */
export function GenerationDetailDialog({ generation, onClose, items, onNavigate, onDelete, onQueued }: GenerationDetailDialogProps) {
  const last = useLastDefined(generation);
  const [direction, setDirection] = useState<BrowseDirection | null>(null);
  // "Edited from" in a viewer with no list to browse (History): the original takes the sheet in place of the current one.
  const [replacement, setReplacement] = useState<{ forId: string; generation: Generation } | null>(null);
  const shown = replacement && last && replacement.forId === last.id ? replacement.generation : last;
  const openInPlace = (target: Generation) => { if (last) setReplacement({ forId: last.id, generation: target }); };
  const close = () => { setDirection(null); setReplacement(null); onClose(); };
  const index = shown && items ? items.findIndex((item) => item.id === shown.id) : -1;
  const prev = items && index > 0 ? items[index - 1] : null;
  const next = items && index >= 0 && index < items.length - 1 ? items[index + 1] : null;
  const position = items && index >= 0 && items.length > 1 ? { index, total: items.length } : undefined;

  const browse = (target: Generation | null, to: BrowseDirection) => {
    if (!onNavigate || !target) return;
    setDirection(to);
    onNavigate(target);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!onNavigate || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "ArrowLeft" && prev) { event.preventDefault(); browse(prev, "prev"); }
    if (event.key === "ArrowRight" && next) { event.preventDefault(); browse(next, "next"); }
  };

  return (
    <Dialog open={!!generation} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent bare className="sm:max-w-3xl" showCloseButton={false} onKeyDown={onKeyDown}>
        {shown && (
          <GenerationDetail
            key={shown.id}
            generation={shown}
            direction={direction}
            position={position}
            onPrev={onNavigate && prev ? () => browse(prev, "prev") : undefined}
            onNext={onNavigate && next ? () => browse(next, "next") : undefined}
            onOpen={onNavigate ?? openInPlace}
            onClose={close}
            onDelete={onDelete}
            onQueued={onQueued}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface GenerationDetailProps {
  generation: Generation;
  /** Which way the viewer just browsed, for the slide-in; null when it was opened from a tile. */
  direction?: BrowseDirection | null;
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  /** Shows another generation in the viewer (the image an edit started from). */
  onOpen: (generation: Generation) => void;
  onClose: () => void;
  onDelete?: (generation: Generation) => Promise<void>;
  onQueued?: () => void;
}

function GenerationDetail({ generation, direction, position, onPrev, onNext, onOpen, onClose, onDelete, onQueued }: GenerationDetailProps) {
  const router = useRouter();
  const { raw, label } = useModelLabel(generation);
  const { providers, isImageModelUsable, selectedImageModel, imageModelById } = useModels();
  const isImage = generation.type === GenerationType.IMAGE;
  const done = generation.status === JobStatus.COMPLETED;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasImage = isImage && done && Boolean(generation.imageUrl);
  const sourceId = typeof generation.parameters?.sourceGenerationId === "string" ? generation.parameters.sourceGenerationId : null;

  // Editing: a prompt applied to this image on a model that takes images in.
  const editModels = providers.flatMap((provider) => provider.imageModels).filter((model) => model.capabilities?.edit && isImageModelUsable(model));
  const canEdit = hasImage && editModels.length > 0;
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editModelChoice, setEditModelChoice] = useState<string | null>(null);
  const [queuing, setQueuing] = useState(false);
  const [openingSource, setOpeningSource] = useState(false);
  const editModel = editModelChoice ?? (selectedImageModel && editModels.some((model) => model.id === selectedImageModel) ? selectedImageModel : editModels[0]?.id ?? null);
  const editModelInfo = imageModelById(editModel);
  const editPrice = editModelInfo?.pricePerImageUsd !== null && editModelInfo?.pricePerImageUsd !== undefined ? `$${Number(editModelInfo.pricePerImageUsd.toFixed(4))} per image` : "priced per token";

  // The image this one was edited from, for the link under the prompt.
  const [source, setSource] = useState<Generation | null>(null);
  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    getGeneration(sourceId).then((found) => { if (!cancelled) setSource(found); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [sourceId]);

  const remove = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try { await onDelete(generation); }
    finally { setDeleting(false); setConfirming(false); }
  };

  const queueEdit = async () => {
    const prompt = editPrompt.trim();
    if (!prompt || !editModel) return;
    setQueuing(true);
    try {
      await createGeneration({ prompt, type: GenerationType.IMAGE, parameters: { model: editModel, sourceGenerationId: generation.id } });
      toast.success("Edit queued", { description: "It runs on the queue and lands in the Gallery and History when it finishes." });
      onQueued?.();
      onClose();
    } catch (err) {
      toastApiError(err, "Could not queue the edit", { model: editModel });
    } finally {
      setQueuing(false);
    }
  };

  const askAgent = () => {
    if (!generation.imageUrl) return;
    setChatHandoff({ generationId: generation.id, imageUrl: generation.imageUrl, prompt: generation.prompt });
    router.push("/chat");
  };

  const openSource = async () => {
    if (!sourceId) return;
    if (source) { onOpen(source); return; }
    setOpeningSource(true);
    try { onOpen(await getGeneration(sourceId)); }
    catch { toast.error("The original image is no longer available"); }
    finally { setOpeningSource(false); }
  };

  return (
    <>
      <div className="glass glass-solid relative flex flex-col rounded-[28px] p-7">
        <DialogClose render={<button type="button" className="btn btn-ghost btn-icon btn-sm absolute top-4 right-4" aria-label="Close" />}>
          <XIcon />
        </DialogClose>
        <DialogHeader>
          <DialogTitle>
            {isImage ? <ImageIcon /> : <Type />}
            Generation
            <Badge variant="secondary">{isImage ? "Image" : "Text"}</Badge>
            {position && <span className="num-tab ml-1 text-sm font-semibold text-dim" data-testid="viewer-position">{position.index + 1} of {position.total}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className={cn("viewer-scroll mt-4 flex flex-col overflow-y-auto pr-1", editing ? "max-h-none gap-0 overflow-visible" : "max-h-[70vh] gap-5")}>
          {hasImage && generation.imageUrl && (
            <div className={cn("grid transition-[grid-template-rows] duration-[380ms] [transition-timing-function:var(--ease-expo)]", editing ? "grid-rows-[minmax(0,34vh)]" : "grid-rows-[minmax(0,56vh)]")}>
              <div className="min-h-0 overflow-hidden">
                <div className="viewer-frame relative flex h-full items-center justify-center overflow-hidden rounded-[22px] bg-ground-2" data-dir={direction ?? undefined}>
                  <GeneratedImage src={generation.imageUrl} alt={generation.prompt} width={1024} height={1024} sizes="(max-width: 768px) 100vw, 800px" className="mx-auto h-auto max-h-full w-auto max-w-full object-contain" priority />
                </div>
              </div>
            </div>
          )}
          {!isImage && done && generation.textResult && (
            <div className="viewer-frame glass-inner max-h-[40vh] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-[15px] leading-6" data-dir={direction ?? undefined}>{generation.textResult}</div>
          )}

          <div className={cn("grid transition-[grid-template-rows,opacity] duration-[380ms] [transition-timing-function:var(--ease-expo)]", editing ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")} inert={editing || undefined}>
            <div className="min-h-0 overflow-hidden">
              <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
                <dt className="text-sm font-semibold text-dim">Prompt</dt>
                <dd className="max-h-32 overflow-y-auto whitespace-pre-wrap">{generation.prompt}</dd>
                {sourceId && (
                  <>
                    <dt className="pt-1 text-sm font-semibold text-dim">Edited from</dt>
                    <dd>
                      <button
                        type="button"
                        className="-ml-1.5 flex max-w-full items-center gap-2.5 rounded-xl py-1 pr-3 pl-1.5 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-60"
                        onClick={() => void openSource()}
                        disabled={openingSource}
                        title="Open the original image"
                        data-testid="open-source-image"
                      >
                        {source?.imageUrl ? (
                          <GeneratedImage src={source.imageUrl} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-[8px] object-cover" />
                        ) : (
                          <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-white/8 text-dim"><ImageIcon className="size-4" /></span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{source?.prompt ?? "Original image"}</span>
                          <span className="block text-xs text-dim">{openingSource ? "Opening…" : "Open the original"}</span>
                        </span>
                      </button>
                    </dd>
                  </>
                )}
                {generation.enhancedPrompt && (
                  <>
                    <dt className="text-sm font-semibold text-dim">Enhanced</dt>
                    <dd className="max-h-32 overflow-y-auto whitespace-pre-wrap text-ink-2">{generation.enhancedPrompt}</dd>
                  </>
                )}
                <dt className="text-sm font-semibold text-dim">Status</dt>
                <dd className="flex flex-wrap items-center gap-3"><StatusBadge status={generation.status} /><PriorityBadge priority={generation.priority} /></dd>
                <dt className="text-sm font-semibold text-dim">Model</dt>
                <dd><span className="tag" title={raw} data-testid="generation-model">{label}</span></dd>
                <dt className="text-sm font-semibold text-dim">Created</dt>
                <dd className="text-ink-2">{formatStamp(generation.createdAt)}</dd>
                <dt className="text-sm font-semibold text-dim">Id</dt>
                <dd className="data text-dim">{generation.id}</dd>
                {generation.status === JobStatus.FAILED && generation.error && (
                  <>
                    <dt className="text-sm font-semibold text-err">Error</dt>
                    <dd className="text-err">{generation.error}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>
        </div>

        {(position || onDelete || hasImage) && (
          <div className={cn("grid transition-[grid-template-rows,opacity] duration-[380ms] [transition-timing-function:var(--ease-expo)]", editing ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")} inert={editing || undefined}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                {confirming ? (
                  <>
                    <p className="text-sm text-ink-2">Delete this {isImage ? "image" : "generation"} for good? The stored file goes too.</p>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={deleting}>Keep</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={deleting} data-testid="confirm-delete-generation">
                        {deleting ? <Spin /> : <Trash2 />} Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {position && (
                        <span className="flex items-center gap-2 lg:hidden">
                          <button type="button" className="btn btn-glass btn-icon btn-sm btn-round" onClick={onPrev} disabled={!onPrev} aria-label="Previous"><ChevronLeft /></button>
                          <button type="button" className="btn btn-glass btn-icon btn-sm btn-round" onClick={onNext} disabled={!onNext} aria-label="Next"><ChevronRight /></button>
                        </span>
                      )}
                      {position && <span className="hidden text-xs text-dim sm:inline"><kbd className="key">←</kbd> <kbd className="key">→</kbd> to browse</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit && (
                        <button type="button" className="btn btn-glass btn-sm" onClick={() => setEditing(true)} title="Apply a change to this image (image-to-image)" data-testid="edit-generation"><Wand2 /> Edit</button>
                      )}
                      {hasImage && (
                        <button type="button" className="btn btn-glass btn-sm" onClick={askAgent} title="Open the chat with this image attached" data-testid="ask-about-generation"><MessageSquare /> Ask the agent</button>
                      )}
                      {onDelete && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)} data-testid="delete-generation"><Trash2 /> Delete</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {position && (
          <>
            <button type="button" className="viewer-nav" data-side="prev" onClick={onPrev} disabled={!onPrev} aria-label="Previous" data-testid="viewer-prev"><ChevronLeft /></button>
            <button type="button" className="viewer-nav" data-side="next" onClick={onNext} disabled={!onNext} aria-label="Next" data-testid="viewer-next"><ChevronRight /></button>
          </>
        )}
      </div>

      {editing && (
        <Reveal>
          <form className="glass glass-solid flex flex-col gap-3 rounded-[24px] p-5" onSubmit={(e) => { e.preventDefault(); void queueEdit(); }} data-testid="edit-form">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label htmlFor="edit-prompt" className="text-base font-bold tracking-tight">Edit this image</label>
              <span className="text-xs text-dim">{editModelInfo?.label ?? "Editing model"} · {editPrice} · the result is a new image next to this one</span>
            </div>
            <Textarea id="edit-prompt" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={2} placeholder="What should change? e.g. make it night, add rain on the cobblestones" className="min-h-[76px] rounded-[18px]" autoFocus data-testid="edit-prompt" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ModelPicker kind="image" requireEdit value={editModel} onChange={setEditModelChoice} size="sm" />
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={queuing}>Cancel</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={queuing || !editPrompt.trim() || !editModel} data-testid="queue-edit">
                  {queuing ? <Spin /> : <Wand2 />} Queue edit
                </button>
              </div>
            </div>
          </form>
        </Reveal>
      )}
    </>
  );
}
