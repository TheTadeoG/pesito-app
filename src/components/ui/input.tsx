import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
