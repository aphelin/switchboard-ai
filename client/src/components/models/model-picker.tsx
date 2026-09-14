"use client";

import { Settings2 } from "lucide-react";
import { useModels } from "@/hooks/use-models";
import type { CatalogModel } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Sentinel item value: opens the providers dialog instead of selecting. */
const MANAGE_VALUE = "__manage_providers__";

interface ModelPickerProps {
  value: string | null;
  onChange: (id: string) => void;
  /** Hide models that cannot call tools (the chat agent needs them). */
  requireTools?: boolean;
  id?: string;
  size?: "sm" | "default";
  className?: string;
}

function formatPrice(value: number): string {
  return `$${Number(value.toFixed(3))}`;
}

function modelDetail(model: CatalogModel): string {
  if (model.provider === "platform") return `${model.tier} · included`;
  if (!model.pricing) return model.tier;
  return `${model.tier} · ${formatPrice(model.pricing.input)} / ${formatPrice(model.pricing.output)} per 1M`;
}

/** Compact model select grouped by provider; models without a key are disabled. */
export function ModelPicker({
  value,
  onChange,
  requireTools = false,
  id,
  size = "default",
  className,
}: ModelPickerProps) {
  const { providers, loading, byokEnabled, modelById, isModelUsable, openProviderDialog } =
    useModels();

  const groups = providers
    .map((provider) => ({
      provider,
      models: provider.models.filter((model) => !requireTools || model.capabilities.tools),
    }))
    .filter((group) => group.models.length > 0);

  if (groups.length === 0) {
    return (
      <Select disabled value={null}>
        <SelectTrigger id={id} size={size} className={className} data-testid="model-picker">
          <SelectValue placeholder={loading ? "Loading models…" : "Server default"} />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === MANAGE_VALUE) {
          openProviderDialog();
          return;
        }
        if (typeof next === "string") onChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={cn("max-w-[220px]", className)}
        aria-label="Model"
        data-testid="model-picker"
      >
        <SelectValue placeholder="Choose a model">
          {(selected: string | null) => (
            <span className="truncate">{modelById(selected)?.label ?? "Choose a model"}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)]"
        data-testid="model-picker-content"
      >
        {groups.map(({ provider, models }) => {
          const locked = provider.requiresKey && (!provider.connected || !byokEnabled);
          return (
            <SelectGroup key={provider.id}>
              <SelectLabel className="flex items-center justify-between gap-2">
                <span>{provider.label}</span>
                {locked && (
                  <span className="text-[10px] tracking-wide text-muted-foreground/80 uppercase">
                    {byokEnabled ? "add key" : "unavailable"}
                  </span>
                )}
              </SelectLabel>
              {models.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  label={model.label}
                  disabled={!isModelUsable(model, { requireTools })}
                  title={model.description}
                  data-testid={`model-option-${model.id}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{model.label}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {modelDetail(model)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
        <SelectSeparator />
        <SelectGroup>
          <SelectItem
            value={MANAGE_VALUE}
            label="Manage AI providers"
            data-testid="model-picker-manage"
          >
            <Settings2 className="text-muted-foreground" />
            Manage AI providers…
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
