"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** Buttons. The primary is solid white; accent is solid coral for the action that spends money. */
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "btn-primary",
      accent: "btn-accent",
      outline: "btn-glass",
      secondary: "",
      ghost: "btn-ghost",
      destructive: "btn-danger",
      link: "btn-link",
    },
    size: {
      default: "",
      xs: "btn-xs",
      sm: "btn-sm",
      lg: "btn-lg",
      icon: "btn-icon",
      "icon-xs": "btn-icon btn-xs",
      "icon-sm": "btn-icon btn-sm",
      "icon-lg": "btn-icon btn-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
