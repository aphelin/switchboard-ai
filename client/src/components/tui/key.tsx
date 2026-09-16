import { cn } from "@/lib/utils";

/** A key cap. */
export function Key({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={cn("key", className)} {...props} />;
}
