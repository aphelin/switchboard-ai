"use client";

import { useState } from "react";
import { ImageIcon, Type, Sparkles, SlidersHorizontal, ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Orb } from "@/components/tui/logo";
import { Spin } from "@/components/tui/spin";
import { createGeneration } from "@/lib/api";
import { toastApiError } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { GenerationType, JobPriority } from "@/lib/constants";
import type { CreateGenerationPayload } from "@/lib/types";
import { ModelPicker } from "@/components/models/model-picker";
import { useModels } from "@/hooks/use-models";
import { toast } from "sonner";

const PRIORITY_ITEMS: Record<JobPriority, string> = {
  [JobPriority.HIGH]: "High priority",
  [JobPriority.NORMAL]: "Normal priority",
  [JobPriority.LOW]: "Low priority",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface PromptFormProps {
  onCreated?: () => void;
}

/** The prompt card: the orb, a greeting, and the "describe it" pill. `/` focuses it from anywhere. */
export function PromptForm({ onCreated }: PromptFormProps) {
  const { data: session } = authClient.useSession();
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<GenerationType>(GenerationType.IMAGE);
  const [enhance, setEnhance] = useState(false);
  const [priority, setPriority] = useState<JobPriority>(JobPriority.NORMAL);
  const [loading, setLoading] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const [seed, setSeed] = useState("");
  const { selectedModel, setSelectedModel, selectedImageModel, setSelectedImageModel } = useModels();

  const isImage = type === GenerationType.IMAGE;
  // The LLM is used for text generations and for prompt enhancement only.
  const usesLlm = !isImage || enhance;
  const llmModel = usesLlm ? (selectedModel ?? undefined) : undefined;
  const firstName = session?.user.name?.trim().split(/\s+/)[0];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const payload: CreateGenerationPayload = {
        prompt: prompt.trim(),
        type,
        enhance,
        priority,
        ...(llmModel && { llmModel }),
      };

      if (isImage) {
        const parsedWidth = Number(width);
        const parsedHeight = Number(height);
        const parsedSeed = Number(seed);
        const parameters = {
          ...(selectedImageModel && { model: selectedImageModel }),
          ...(showParams && {
            ...(!Number.isNaN(parsedWidth) && width && { width: parsedWidth }),
            ...(!Number.isNaN(parsedHeight) && height && { height: parsedHeight }),
            ...(!Number.isNaN(parsedSeed) && seed && { seed: parsedSeed }),
          }),
        };
        // Nothing resolved (catalog not loaded): let the server pick its default.
        if (Object.keys(parameters).length > 0) payload.parameters = parameters;
      }

      await createGeneration(payload);
      toast.success("Queued", { description: "Your job is in the queue and will appear on the right as it runs." });
      setPrompt("");
      onCreated?.();
    } catch (err) {
      // For images the image model is the likelier culprit; the helper still
      // falls back to the provider named in the message (e.g. the enhancer's).
      toastApiError(err, "Failed to create generation", { model: isImage ? selectedImageModel : llmModel });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass relative overflow-hidden p-6 sm:p-8" data-slot="prompt-card">
      <div className="flex flex-col items-center text-center">
        <Orb size={56} breathe={loading} />
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          {greeting()}{firstName ? `, ${firstName}` : ""}.
          <br />
          <span className="text-ink-2">What should we make?</span>
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
        <div className="relative">
          <Textarea
            data-prompt
            aria-label={isImage ? "Image prompt" : "Text prompt"}
            placeholder={isImage ? "Describe the image: subject, light, lens, mood…" : "What should the model write?"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={4}
            className="min-h-[132px] rounded-[28px] bg-transparent pr-16 pb-14 text-base"
          />
          <button
            type="submit"
            className="btn btn-accent btn-icon absolute right-3 bottom-3 size-12"
            disabled={loading || !prompt.trim()}
            aria-label="Generate"
            title="Generate (Ctrl+Enter)"
          >
            {loading ? <Spin /> : <ArrowUp className="size-5" />}
          </button>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            <button
              type="button"
              className="chip chip-sm"
              data-active={isImage ? "" : undefined}
              aria-pressed={isImage}
              onClick={() => setType(GenerationType.IMAGE)}
            >
              <ImageIcon />
              Image
            </button>
            <button
              type="button"
              className="chip chip-sm"
              data-active={!isImage ? "" : undefined}
              aria-pressed={!isImage}
              onClick={() => setType(GenerationType.TEXT)}
            >
              <Type />
              Text
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isImage ? (
            <ModelPicker id="image-model-select" kind="image" value={selectedImageModel} onChange={setSelectedImageModel} size="sm" />
          ) : (
            <ModelPicker id="llm-model-select" value={selectedModel} onChange={setSelectedModel} size="sm" />
          )}
          <Select value={priority} onValueChange={(v) => setPriority(v as JobPriority)} items={PRIORITY_ITEMS}>
            <SelectTrigger id="priority-select" size="sm" className="w-auto" aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={JobPriority.HIGH} label="High priority">High priority</SelectItem>
              <SelectItem value={JobPriority.NORMAL} label="Normal priority">Normal priority</SelectItem>
              <SelectItem value={JobPriority.LOW} label="Low priority">Low priority</SelectItem>
            </SelectContent>
          </Select>
          {isImage && (
            <>
              <button
                type="button"
                className="chip chip-sm"
                data-active={enhance ? "" : undefined}
                aria-pressed={enhance}
                onClick={() => setEnhance((v) => !v)}
                title="Rewrite the prompt with an LLM before generating"
              >
                {/* The icon inherits the chip's colour: the active chip is white, where a mint icon would vanish. */}
                <Sparkles />
                Enhance prompt
              </button>
              <button
                type="button"
                className="chip chip-sm"
                data-active={showParams ? "" : undefined}
                aria-expanded={showParams}
                onClick={() => setShowParams((v) => !v)}
              >
                <SlidersHorizontal />
                Size &amp; seed
              </button>
            </>
          )}
        </div>

        {isImage && enhance && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span className="px-1">Enhance with</span>
            <ModelPicker id="llm-model-select" value={selectedModel} onChange={setSelectedModel} size="sm" />
          </div>
        )}

        {isImage && showParams && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
              <span className="px-1">Width</span>
              <Input id="width-input" type="number" value={width} onChange={(e) => setWidth(e.target.value)} min={256} max={2048} step={64} className="field-sm h-10" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-2">
              <span className="px-1">Height</span>
              <Input id="height-input" type="number" value={height} onChange={(e) => setHeight(e.target.value)} min={256} max={2048} step={64} className="field-sm h-10" />
            </label>
            <label className="col-span-2 flex flex-col gap-1.5 text-sm font-semibold text-ink-2 sm:col-span-1">
              <span className="px-1">Seed</span>
              <Input id="seed-input" type="number" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Random" className="field-sm h-10" />
            </label>
          </div>
        )}

        <p className="text-center text-xs text-dim">
          Queued with priority · runs on a worker · status streams back live · <kbd className="key">Ctrl</kbd> <kbd className="key">⏎</kbd> to send
        </p>
      </form>
    </section>
  );
}
