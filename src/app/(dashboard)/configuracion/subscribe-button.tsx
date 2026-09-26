import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/subscription";

/** Lleva a la pantalla de pago del plan (/suscribirse). */
export function SubscribeButton({
  plan,
  variant,
  label,
}: {
  plan: Plan;
  variant: React.ComponentProps<typeof Button>["variant"];
  label: string;
}) {
  return (
    <Link href={`/suscribirse?plan=${plan}`} className="block">
      <Button variant={variant} size="sm" className="w-full">
        {label}
      </Button>
    </Link>
  );
}
