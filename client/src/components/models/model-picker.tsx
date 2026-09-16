"use client";

import { Settings2 } from "lucide-react";
import { useModels } from "@/hooks/use-models";
import type { CatalogImageModel, CatalogModel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Sentinel item value: opens the providers dialog instead of selecting. */
const MANAGE_VALUE = "__manage_providers__";

interface ModelPickerProps {
  value: string | null;
  onChange: (id: string) => void;
  kind?: "text" | "image";
  requireTools?: boolean;
  /** Image models only: list just the ones that can edit an existing image. */
  requireEdit?: boolean;
  id?: string;
  size?: "sm" | "default";
  className?: string;
}

interface PickerOption { id: string; label: string; description: string; detail: string; usable: boolean; }

function formatPrice(value: number): string { return `$${Number(value.toFixed(3))}`; }

function modelDetail(model: CatalogModel): string {
  if (model.provider === "platform") return `${model.tier} · included`;
  if (!model.pricing) return model.tier;
  return `${model.tier} · ${formatPrice(model.pricing.input)} / ${formatPrice(model.pricing.output)} per 1M`;
}

function imageModelDetail(model: CatalogImageModel): string {
  const price = model.pricePerImageUsd === null ? null : `$${Number(model.pricePerImageUsd.toFixed(4))} / image`;
  if (model.provider === "platform") return price ? `included · ${price}` : "included";
  return price ?? "priced per token";
}

/** Model list box grouped by provider; models without a key are disabled. */
export function ModelPicker({ value, onChange, kind = "text", requireTools = false, requireEdit = false, id, size = "default", className }: ModelPickerProps) {
  const { providers, loading, byokEnabled, modelById, imageModelById, isModelUsable, isImageModelUsable, openProviderDialog } = useModels();
  const isImage = kind === "image";

  const groups = providers
    .map((provider) => ({
      provider,
      options: isImage
        ? provider.imageModels.filter((model) => !requireEdit || model.capabilities?.edit).map<PickerOption>((model) => ({ id: model.id, label: model.label, description: model.description, detail: imageModelDetail(model), usable: isImageModelUsable(model) }))
        : provider.models.filter((model) => !requireTools || model.capabilities.tools).map<PickerOption>((model) => ({ id: model.id, label: model.label, description: model.description, detail: modelDetail(model), usable: isModelUsable(model, { requireTools }) })),
    }))
    .filter((group) => group.options.length > 0);

  const labelOf = (selected: string | null) => (isImage ? imageModelById(selected) : modelById(selected))?.label;

  if (groups.length === 0) {
    return (
      <Select disabled value={null}>
        <SelectTrigger id={id} size={size} className={cn("max-w-[30ch]", className)} data-testid="model-picker" data-kind={kind}>
          <SelectValue placeholder={loading ? "Loading models…" : "Server default"} />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={(next) => { if (next === MANAGE_VALUE) { openProviderDialog(); return; } if (typeof next === "string") onChange(next); }}>
      <SelectTrigger id={id} size={size} className={cn("max-w-[30ch]", className)} aria-label={isImage ? "Image model" : "Model"} data-testid="model-picker" data-kind={kind}>
        <SelectValue placeholder="Choose a model">
          {(selected: string | null) => <span className="truncate">{labelOf(selected) ?? "Choose a model"}</span>}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="w-[26rem] max-w-[calc(100vw-2.5rem)]" data-testid="model-picker-content">
        {groups.map(({ provider, options }) => {
          const locked = provider.requiresKey && (!provider.connected || !byokEnabled);
          return (
            <SelectGroup key={provider.id}>
              <SelectLabel>
                <span>{provider.label}</span>
                {locked && <span className="tag tag-warn">{byokEnabled ? "Add key" : "Unavailable"}</span>}
              </SelectLabel>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id} label={option.label} disabled={!option.usable} title={option.description} data-testid={`model-option-${option.id}`}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{option.label}</span>
                    <span className="truncate text-xs text-dim">{option.detail}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
        <SelectSeparator />
        <SelectGroup>
          <SelectItem value={MANAGE_VALUE} label="Manage AI providers" data-testid="model-picker-manage">
            <Settings2 className="text-dim" />
            Manage AI providers
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
