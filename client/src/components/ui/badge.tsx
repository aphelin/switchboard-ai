import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** Small tinted pill. */
const badgeVariants = cva("tag", {
  variants: {
    variant: {
      default: "tag-info",
      secondary: "tag-dim",
      destructive: "tag-err",
      outline: "",
      success: "tag-ok",
      warning: "tag-warn",
      ask: "tag-ask",
      accent: "tag-accent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
