import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function OutfitCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-80 border border-card-border bg-canvas animate-fade-in overflow-hidden">
      {/* Image grid */}
      <div className="grid grid-cols-2 gap-px bg-card-border">
        <Skeleton className="aspect-square" />
        <Skeleton className="aspect-square" />
        <Skeleton className="aspect-square" />
        <Skeleton className="aspect-square" />
      </div>
      {/* Content */}
      <div className="p-5 space-y-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="pt-1 space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-full mt-2" />
      </div>
    </div>
  );
}
