import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
