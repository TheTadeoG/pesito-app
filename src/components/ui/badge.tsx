import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "accent";

const toneClasses: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  accent: "bg-accent text-accent-foreground",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
