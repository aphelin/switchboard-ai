"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

/** Non-modal by default: the modal scroll lock toggles `overflow` on the document on every open and close, which repaints the whole page. */
function Select<Value, Multiple extends boolean | undefined = false>({ modal = false, ...props }: SelectPrimitive.Root.Props<Value, Multiple>) {
  return <SelectPrimitive.Root modal={modal} {...props} />
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1", className)} {...props} />
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" className={cn("flex min-w-0 flex-1 truncate text-left", className)} {...props} />
}

/** A pill trigger with a chevron. */
function SelectTrigger({ className, size = "default", children, ...props }: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit min-w-0 items-center justify-between gap-2 rounded-full border border-white/12 bg-white/6 px-4 text-[15px] font-semibold whitespace-nowrap text-ink shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] outline-none transition-[background-color,border-color,box-shadow] select-none hover:bg-white/12 hover:border-white/20 focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_rgba(134,236,191,0.28)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-err data-placeholder:text-dim data-[size=default]:h-11 data-[size=sm]:h-9 data-[size=sm]:px-3 data-[size=sm]:text-sm data-popup-open:bg-white/12 data-popup-open:border-white/30 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon className="pointer-events-none size-4 text-dim" />} />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className, children, side = "bottom", sideOffset = 6, align = "start", alignOffset = 0, alignItemWithTrigger = false, ...props
}: SelectPrimitive.Popup.Props & Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset} alignItemWithTrigger={alignItemWithTrigger} className="isolate z-50">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "popup popup-enter relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-52 overflow-x-hidden overflow-y-auto p-2",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return <SelectPrimitive.GroupLabel data-slot="select-label" className={cn("flex items-center justify-between px-3 pt-2 pb-1 text-xs font-bold text-dim", className)} {...props} />
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full min-h-10 cursor-pointer items-center gap-2 rounded-xl py-1.5 pr-9 pl-3 text-[15px] outline-hidden select-none data-highlighted:bg-white data-highlighted:text-ground data-highlighted:**:text-ground focus:bg-white focus:text-ground focus:**:text-ground data-disabled:pointer-events-none data-disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 items-center gap-2">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={<span className="pointer-events-none absolute right-3 flex size-4 items-center justify-center" />}>
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("pointer-events-none my-1.5 h-px bg-line", className)} {...props} />
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow data-slot="select-scroll-up-button" className={cn("top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg]:size-4", className)} {...props}>
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow data-slot="select-scroll-down-button" className={cn("bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg]:size-4", className)} {...props}>
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue }
