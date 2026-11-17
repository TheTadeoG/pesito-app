import type { DocMock, DocMockEl } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

// Ilustración esquemática de una pantalla para las guías de /ayuda. Sin imports del panel: es contenido de la web pública.

const HOT = "ring-2 ring-primary ring-offset-2 ring-offset-card";

function El({ el }: { el: DocMockEl }) {
  switch (el.t) {
    case "btn":
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold",
            el.tone === "outline" && "border border-border bg-card text-foreground",
            el.tone === "danger" && "bg-danger-bg text-danger",
            (!el.tone || el.tone === "primary") && "bg-primary text-primary-foreground",
            el.hot && HOT
          )}
        >
          {el.text}
        </span>
      );
    case "input":
      return (
        <span className={cn("flex min-w-0 flex-1 items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground", el.hot && HOT)}>
          {el.text}
        </span>
      );
    case "text":
      return (
        <span className={cn("text-xs", el.strong ? "font-semibold text-foreground" : el.muted ? "text-muted-foreground" : "text-foreground", el.hot && cn("rounded-md px-1.5 py-0.5", HOT))}>
          {el.text}
        </span>
      );
    case "chip":
      return (
        <span className={cn("inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-accent-foreground", el.hot && HOT)}>
          {el.text}
        </span>
      );
    case "item":
      return (
        <span className={cn("flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-1.5 text-xs", el.hot && HOT)}>
          <span className="min-w-0 truncate font-medium text-foreground">{el.text}</span>
          <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
            {el.detail && <span>{el.detail}</span>}
            {el.price && <span className="font-semibold text-foreground">{el.price}</span>}
          </span>
        </span>
      );
    case "total":
      return (
        <span className={cn("flex flex-1 items-center justify-between border-t-2 border-foreground pt-2 text-sm font-bold text-foreground", el.hot && cn("rounded-md px-2", HOT))}>
          <span>{el.text}</span>
          <span>{el.price}</span>
        </span>
      );
    case "tabs":
      return (
        <span className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs font-semibold">
          {el.items.map((t, i) => (
            <span
              key={t}
              className={cn(
                "rounded-md px-2.5 py-1",
                el.active === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                el.hot === i && HOT
              )}
            >
              {t}
            </span>
          ))}
        </span>
      );
  }
}

export function DocMockView({ mock }: { mock: DocMock }) {
  const hasHot = mock.rows.some((row) => row.some((el) => ("hot" in el && el.hot === true) || (el.t === "tabs" && el.hot !== undefined)));
  return (
    <figure className="mt-3">
      <div role="img" aria-label={mock.caption} className="overflow-hidden rounded-card border border-border bg-muted/40">
        <div aria-hidden className="flex items-center gap-1.5 border-b border-border bg-card px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="ml-2 text-[11px] font-semibold text-muted-foreground">{mock.title}</span>
        </div>
        <div aria-hidden className="space-y-2.5 p-4">
          {mock.rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {row.map((el, j) => (
                <El key={j} el={el} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-1.5 text-xs text-muted-foreground">{`Ilustración esquemática: ${mock.caption}.${hasHot ? " Lo resaltado en verde es lo que hay que tocar." : ""}`}</figcaption>
    </figure>
  );
}
