// Eventos de medición (Google Analytics y Clarity). Si el script todavía no
// cargó, el evento queda en la cola de Google y se envía cuando carga. Sin ID
// configurado no pasa nada. Nunca mandar datos personales en los parámetros.
type Params = Record<string, unknown>;

interface TrackWindow extends Window {
  dataLayer?: unknown[];
  clarity?: (...args: unknown[]) => void;
}

export function trackEvent(name: string, params: Params = {}): void {
  if (typeof window === "undefined") return;
  const w = window as TrackWindow;
  try {
    w.dataLayer = w.dataLayer || [];
    // gtag empuja el objeto "arguments", no un array.
    const gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    } as (...args: unknown[]) => void;
    gtag("event", name, params);
    w.clarity?.("event", name);
  } catch {
    // La medición nunca debe romper la pantalla.
  }
}
