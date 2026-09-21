import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <CardContent className="flex flex-col items-center gap-3 p-0">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Icon className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
