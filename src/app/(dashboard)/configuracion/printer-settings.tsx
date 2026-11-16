"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  connectPrinter,
  disconnectPrinter,
  printTestPage,
  printerSupport,
  savePrinterSettings,
  usePrinter,
  type PrinterSettings,
  type Transport,
} from "@/lib/thermal-printer";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}
    >
      <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

const OPTIONS: { id: Transport; title: string; text: string }[] = [
  { id: "usb", title: "Por cable USB", text: "La más simple si la impresora se conecta por USB." },
  { id: "serial", title: "Por puerto serie o Bluetooth emparejado", text: "Si Windows la muestra como un puerto COM." },
  { id: "bluetooth", title: "Por Bluetooth (BLE)", text: "Para impresoras chicas de 58 mm que se usan con el celular." },
];

// Impresión directa en una impresora térmica de esta computadora: se conecta una vez y los tickets salen sin el diálogo.
export function PrinterSettingsCard() {
  const { state, settings } = usePrinter();
  const [support, setSupport] = useState<Record<Transport, boolean> | null>(null);
  useEffect(() => {
    // El servidor no sabe qué APIs tiene el navegador: se mira recién al montar, así no hay desajuste.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(printerSupport());
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const noBrowserSupport = support !== null && !support.usb && !support.serial && !support.bluetooth;
  const update = (patch: Partial<PrinterSettings>) => savePrinterSettings({ ...settings, ...patch });
  const connected = state.status === "ready";

  async function test() {
    setTesting(true);
    setMessage(null);
    const ok = await printTestPage();
    setTesting(false);
    setMessage(ok ? "Mandamos la página de prueba. Fijate que se vean bien los acentos y que corte el papel." : "No pudimos imprimir. Revisá que la impresora esté prendida y con papel.");
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        Función en prueba. Sirve con la mayoría de las impresoras térmicas de 58 y 80 mm (ESC/POS), desde Chrome o Edge. Se configura en cada computadora. Si algo no anda, la impresión normal sigue funcionando igual.
      </p>

      {support === null ? null : noBrowserSupport ? (
        <p className="rounded-xl bg-warning-bg px-3.5 py-3 text-sm text-foreground">Este navegador no permite conectar impresoras. Usá Chrome o Edge en la computadora.</p>
      ) : connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-bg px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            {`Conectada: ${state.label || "impresora"}`}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void test()} disabled={testing}>
              <Printer className="h-4 w-4" />
              {testing ? "Imprimiendo…" : "Imprimir una prueba"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void disconnectPrinter()}>
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{settings.transport ? "Volvé a conectarla (se desconectó)" : "Conectá tu impresora"}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.filter((o) => support?.[o.id]).map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={state.status === "connecting"}
                onClick={() => void connectPrinter(o.id)}
                className="rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60"
              >
                <span className="block text-sm font-semibold text-foreground">{o.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{o.text}</span>
              </button>
            ))}
          </div>
          {state.status === "connecting" && <p className="text-xs text-muted-foreground">Elegí tu impresora en la ventana que se abrió…</p>}
        </div>
      )}
      {state.error && <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{state.error}</p>}
      {message && <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-foreground">{message}</p>}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-foreground">Ancho del papel</p>
            <p className="text-xs text-muted-foreground">El rollo de tu impresora.</p>
          </div>
          <div className="w-32">
            <Select value={settings.paper} onChange={(e) => update({ paper: Number(e.target.value) === 58 ? 58 : 80 })} aria-label="Ancho del papel">
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </Select>
          </div>
        </div>
        {[
          { key: "auto" as const, title: "Imprimir al cobrar", text: "Al terminar una venta, el ticket sale solo." },
          { key: "cut" as const, title: "Cortar el papel", text: "Si tu impresora tiene cortador." },
          { key: "drawer" as const, title: "Abrir el cajón de dinero", text: "Si el cajón está conectado a la impresora." },
          { key: "accents" as const, title: "Acentos y ñ", text: "Si salen símbolos raros, apagalo." },
        ].map((o) => (
          <div key={o.key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-foreground">{o.title}</p>
              <p className="text-xs text-muted-foreground">{o.text}</p>
            </div>
            <Switch checked={settings[o.key]} label={o.title} onChange={() => update({ [o.key]: !settings[o.key] } as Partial<PrinterSettings>)} />
          </div>
        ))}
        {settings.transport === "serial" && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-foreground">Velocidad del puerto</p>
              <p className="text-xs text-muted-foreground">Casi todas usan 9600. Si sale basura, probá 115200.</p>
            </div>
            <div className="w-32">
              <Select value={settings.baud} onChange={(e) => update({ baud: Number(e.target.value) })} aria-label="Velocidad del puerto">
                {[9600, 19200, 38400, 57600, 115200].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
