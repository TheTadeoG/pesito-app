"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/track";

/** Manda un evento una sola vez por navegador (con `dedupeKey`), al mostrarse la pantalla. */
export function TrackEvent({
  event,
  params,
  dedupeKey,
}: {
  event: string;
  params?: Record<string, unknown>;
  dedupeKey: string;
}) {
  useEffect(() => {
    const key = `pesito-ev-${dedupeKey}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Sin almacenamiento: se manda igual.
    }
    trackEvent(event, params);
    // Una sola vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
