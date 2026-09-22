import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "onColor"
  | "gold"
  | "violet";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm shadow-primary/20",
  secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  outline: "border border-border bg-card text-foreground hover:bg-muted",
  danger: "bg-danger text-white hover:opacity-90",
  // For use on a solid-color (e.g. bg-primary) section: a white pill with
  // colored text, since overriding primary's bg/text via className is not
  // reliable (Tailwind's cascade order isn't guaranteed to favor it).
  onColor: "bg-white text-primary hover:bg-white/90",
  // Acentos de plan (Pro/IA en la landing y en Configuración > Suscripción),
  // para que los planes más altos se sientan distintos entre sí y no todos
  // el mismo verde — variantes propias en vez de intentar pisar `primary`
  // por className, que no es confiable con clsx (sin tailwind-merge).
  gold: "bg-amber-500 text-amber-950 hover:bg-amber-400 shadow-sm shadow-amber-500/25",
  violet: "bg-violet-500 text-white hover:bg-violet-400 shadow-sm shadow-violet-500/25",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
  icon: "h-10 w-10 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
