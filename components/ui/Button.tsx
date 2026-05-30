import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "font-medium rounded-pill disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
        variant === "primary" && "bg-near-black text-white hover:bg-ink",
        variant === "secondary" && "bg-stone text-ink hover:bg-hairline",
        variant === "outline" && "border border-hairline text-ink hover:border-ink bg-canvas",
        variant === "ghost" && "text-muted-slate hover:text-ink",
        size === "sm" && "text-xs px-4 py-1.5",
        size === "md" && "text-sm px-5 py-2.5",
        size === "lg" && "text-sm px-7 py-3",
        className
      )}
    >
      {children}
    </button>
  );
}
