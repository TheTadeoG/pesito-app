import Link from "next/link";
import { periodOptions, reportesHref, type ReportPeriod } from "@/lib/report-periods";
import { cn } from "@/lib/utils";

export function PeriodSelector({
  period,
  sellerId,
}: {
  period: ReportPeriod;
  sellerId: string | null;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-1">
      {periodOptions.map((option) => (
        <Link
          key={option.value}
          href={reportesHref(option.value, sellerId)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            period === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
