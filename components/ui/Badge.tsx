import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "coral" | "brand";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded-full font-medium",
        variant === "default" && "bg-stone text-muted-slate",
        variant === "coral" && "bg-coral/10 text-coral border border-soft-coral",
        variant === "brand" && "bg-pale-green text-deep-green border border-deep-green/20",
        className
      )}
    >
      {children}
    </span>
  );
}
