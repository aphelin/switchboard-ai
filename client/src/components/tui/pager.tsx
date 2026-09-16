import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PagerProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  className?: string;
}

export function Pager({ page, totalPages, onPage, className }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className={cn("flex items-center justify-center gap-3 pt-4", className)} aria-label="Pagination">
      <button type="button" className="btn btn-glass btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft />
        Previous
      </button>
      <span className="text-sm font-medium text-dim">
        Page <span className="text-ink">{page}</span> of {totalPages}
      </span>
      <button type="button" className="btn btn-glass btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
        <ChevronRight />
      </button>
    </nav>
  );
}
