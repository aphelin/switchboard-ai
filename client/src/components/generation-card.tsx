"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Ban, ImageIcon, Type } from "lucide-react";
import { retryGeneration, cancelGeneration } from "@/lib/api";
import { GenerationType, JobStatus } from "@/lib/constants";
import type { Generation } from "@/lib/types";
import { toast } from "sonner";

interface GenerationCardProps {
  generation: Generation;
  onUpdate?: () => void;
  showActions?: boolean;
}

export function GenerationCard({
  generation,
  onUpdate,
  showActions = false,
}: GenerationCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await retryGeneration(generation.id);
      toast.success("Generation retried");
      onUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await cancelGeneration(generation.id);
      toast.success("Generation cancelled");
      onUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(false);
    }
  };

  const isImage = generation.type === GenerationType.IMAGE;

  return (
    <>
      <Card
        className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        role="button"
        tabIndex={0}
        onClick={() => setDialogOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDialogOpen(true);
          }
        }}
      >
        {isImage &&
        generation.status === JobStatus.COMPLETED &&
        generation.imageUrl ? (
          <div className="relative aspect-square overflow-hidden bg-muted">
            <Image
              src={generation.imageUrl}
              alt={generation.prompt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <p className="absolute bottom-2 left-2 right-2 truncate text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              {generation.prompt}
            </p>
          </div>
        ) : (
          <CardContent className="flex h-[200px] flex-col gap-2 overflow-hidden p-4">
            <div className="mb-2 flex items-start gap-2">
              {isImage ? (
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <Type className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <p className="line-clamp-3 text-sm">{generation.prompt}</p>
            </div>

            {generation.status === JobStatus.COMPLETED &&
              generation.textResult && (
                <p className="line-clamp-4 rounded bg-muted p-2 text-xs text-muted-foreground">
                  {generation.textResult}
                </p>
              )}

            {generation.status === JobStatus.FAILED && generation.error && (
              <p className="line-clamp-2 text-xs text-destructive">
                {generation.error}
              </p>
            )}
          </CardContent>
        )}

        <div className="flex items-center justify-between border-t p-2 px-3">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={generation.status} />
            <PriorityBadge priority={generation.priority} />
          </div>
          {showActions && (
            <div className="flex gap-1">
              {(generation.status === JobStatus.FAILED ||
                generation.status === JobStatus.CANCELLED) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleRetry}
                  disabled={actionLoading}
                  title="Retry"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              {(generation.status === JobStatus.PENDING ||
                generation.status === JobStatus.GENERATING) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCancel}
                  disabled={actionLoading}
                  title="Cancel"
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isImage ? (
                <ImageIcon className="h-5 w-5" />
              ) : (
                <Type className="h-5 w-5" />
              )}
              Generation Details
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {isImage &&
              generation.status === JobStatus.COMPLETED &&
              generation.imageUrl && (
                <div className="relative overflow-hidden rounded-lg">
                  <Image
                    src={generation.imageUrl}
                    alt={generation.prompt}
                    width={1024}
                    height={1024}
                    sizes="(max-width: 768px) 100vw, 672px"
                    className="h-auto w-full"
                    priority
                  />
                </div>
              )}

            {!isImage &&
              generation.status === JobStatus.COMPLETED &&
              generation.textResult && (
                <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
                  {generation.textResult}
                </div>
              )}

            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Prompt
                </span>
                <p className="max-h-[120px] overflow-y-auto text-sm">{generation.prompt}</p>
              </div>

              {generation.enhancedPrompt && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Enhanced Prompt
                  </span>
                  <p className="max-h-[120px] overflow-y-auto text-sm">{generation.enhancedPrompt}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <StatusBadge status={generation.status} />
                <PriorityBadge priority={generation.priority} />
                <span>{generation.type}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                  {generation.parameters?.model
                    ? String(generation.parameters.model)
                    : isImage
                      ? 'flux'
                      : 'openai'}
                </span>
                <span>{new Date(generation.createdAt).toLocaleString()}</span>
              </div>

              {generation.status === JobStatus.FAILED && generation.error && (
                <p className="text-sm text-destructive">{generation.error}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
