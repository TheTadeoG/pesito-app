"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OpenCajaPrompt() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur();
      router.push("/caja");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Lock className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">
          Abrí tu caja para empezar a vender
        </h2>
        <p className="text-sm text-muted-foreground">
          Necesitás abrir la caja del día antes de poder cobrar ventas.
        </p>
        <Button className="mt-2" onClick={() => router.push("/caja")}>
          Abrir Mi Caja (Enter)
        </Button>
      </CardContent>
    </Card>
  );
}
