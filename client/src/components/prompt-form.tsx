"use client";

import { useState } from "react";
import { Send, Wand2, ImageIcon, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createGeneration } from "@/lib/api";
import { GenerationType } from "@/lib/constants";
import type { CreateGenerationPayload } from "@/lib/types";
import { toast } from "sonner";

interface PromptFormProps {
  onCreated?: () => void;
}

export function PromptForm({ onCreated }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<GenerationType>(GenerationType.IMAGE);
  const [enhance, setEnhance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const [model, setModel] = useState("");
  const [seed, setSeed] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const payload: CreateGenerationPayload = {
        prompt: prompt.trim(),
        type,
        enhance,
      };

      if (type === GenerationType.IMAGE && showParams) {
        payload.parameters = {
          ...(model && { model }),
          ...(width && { width: parseInt(width, 10) }),
          ...(height && { height: parseInt(height, 10) }),
          ...(seed && { seed: parseInt(seed, 10) }),
        };
      }

      await createGeneration(payload);
      toast.success("Generation queued successfully");
      setPrompt("");
      onCreated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create generation",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wand2 className="h-5 w-5" />
          Create Generation
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === GenerationType.IMAGE ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setType(GenerationType.IMAGE)}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </Button>
            <Button
              type="button"
              variant={type === GenerationType.TEXT ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setType(GenerationType.TEXT)}
            >
              <Type className="h-4 w-4" />
              Text
            </Button>
          </div>

          <Textarea
            placeholder={
              type === GenerationType.IMAGE
                ? "Describe the image you want to generate..."
                : "Enter your text generation prompt..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            className="min-h-[140px] resize-y"
          />

          {type === GenerationType.IMAGE && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enhance}
                    onChange={(e) => setEnhance(e.target.checked)}
                    className="rounded border-input"
                  />
                  Enhance prompt with AI
                </label>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowParams(!showParams)}
                className="text-xs text-muted-foreground"
              >
                {showParams ? "Hide" : "Show"} advanced parameters
              </Button>

              {showParams && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Width
                    </label>
                    <Input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      min={256}
                      max={2048}
                      step={64}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Height
                    </label>
                    <Input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      min={256}
                      max={2048}
                      step={64}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Model
                    </label>
                    <Select
                      value={model}
                      onValueChange={(v) => setModel(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Default (Flux)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flux">Flux Schnell</SelectItem>
                        <SelectItem value="flux-2-dev">Flux 2 Dev</SelectItem>
                        <SelectItem value="gptimage">
                          GPT Image 1 Mini
                        </SelectItem>
                        <SelectItem value="imagen-4">Imagen 4</SelectItem>
                        <SelectItem value="grok-imagine">
                          Grok Imagine
                        </SelectItem>
                        <SelectItem value="zimage">Z-Image Turbo</SelectItem>
                        <SelectItem value="dirtberry">Dirtberry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Seed (optional)
                    </label>
                    <Input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      placeholder="Random"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {loading ? "Submitting..." : "Generate"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
