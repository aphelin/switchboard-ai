import { useState } from "react";

/** The latest non-null value seen, so a closing dialog keeps its content while it fades. */
export function useLastDefined<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null);
  if (value != null && value !== last) setLast(value);
  return value ?? last;
}
