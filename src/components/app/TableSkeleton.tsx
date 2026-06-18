import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass overflow-hidden rounded-2xl shadow-card">
      <div className="space-y-0">
        <div className="flex gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-border/50 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-3.5 flex-1 rounded" style={{ opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
