import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5 space-y-3">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-7 w-16 rounded" />
          <Skeleton className="h-2.5 w-full rounded" />
        </div>
      ))}
    </div>
  );
}
