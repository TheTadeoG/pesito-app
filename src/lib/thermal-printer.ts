"use client";

import { useEffect, useSyncExternalStore } from "react";
import { COLUMNS, EscposBuilder, type PaperWidth } from "@/lib/escpos";

// Impresión directa en una impresora térmica desde el navegador (Chrome o Edge): la persona la conecta una vez y
// después Pesito le manda el ticket sin abrir el diálogo de impresión. Tres formas de conectar: USB, puerto serie
// (incluye las que se emparejan por Bluetooth clásico y aparecen como puerto COM) y Bluetooth de baja energía. Si algo
// falla, quien llama vuelve a la impresión normal del navegador (window.print), que siempre anda.

export type Transport = "serial" | "usb" | "bluetooth";

export interface PrinterSettings {
  transport: Transport | null;
  paper: PaperWidth;
  /** Corta el papel al terminar. */
  cut: boolean;
  /** Abre el cajón de dinero al imprimir una venta. */
  drawer: boolean;
  /** Acentos y ñ (si salen caracteres raros, se apaga). */
  accents: boolean;
  /** Imprime solo al cobrar, sin tocar nada. */
  auto: boolean;
  /** Velocidad del puerto serie. */
  baud: number;
  usbIds?: { vendorId: number; productId: number };
  name?: string;
}

const KEY = "pesito-printer";
const DEFAULTS: PrinterSettings = { transport: null, paper: 80, cut: true, drawer: false, accents: true, auto: false, baud: 9600 };

export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PrinterSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function savePrinterSettings(next: PrinterSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sin almacenamiento: vale sólo en esta sesión
  }
  emit();
}

// --- Tipos mínimos de las APIs del navegador (no vienen en lib.dom) ---

interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: { getWriter(): { write(d: Uint8Array): Promise<void>; releaseLock(): void } } | null;
}
interface UsbEndpoint { endpointNumber: number; direction: string; type: string }
interface UsbDeviceLike {
  vendorId: number;
  productId: number;
  productName?: string;
  opened: boolean;
  configuration: { interfaces: { interfaceNumber: number; alternate: { interfaceClass: number; endpoints: UsbEndpoint[] } }[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(ep: number, data: Uint8Array): Promise<{ status: string }>;
}
interface BleCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithoutResponse?(d: Uint8Array): Promise<void>;
  writeValue(d: Uint8Array): Promise<void>;
}
interface BleDevice { name?: string; gatt?: { connect(): Promise<{ getPrimaryServices(): Promise<{ getCharacteristics(): Promise<BleCharacteristic[]> }[]>; disconnect(): void }> } }
interface Nav {
  serial?: { requestPort(): Promise<SerialPortLike>; getPorts(): Promise<SerialPortLike[]> };
  usb?: { requestDevice(o: { filters: unknown[] }): Promise<UsbDeviceLike>; getDevices(): Promise<UsbDeviceLike[]> };
  bluetooth?: { requestDevice(o: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BleDevice> };
}
const nav = (): Nav => navigator as unknown as Nav;

export function printerSupport(): Record<Transport, boolean> {
  if (typeof navigator === "undefined") return { serial: false, usb: false, bluetooth: false };
  return { serial: Boolean(nav().serial), usb: Boolean(nav().usb), bluetooth: Boolean(nav().bluetooth) };
}

// --- Estado de la conexión (lo lee la pantalla de configuración) ---

type Status = "idle" | "connecting" | "ready" | "error";
interface PrinterState {
  status: Status;
  label: string;
  error: string | null;
}

let state: PrinterState = { status: "idle", label: "", error: null };
let connection: { send(bytes: Uint8Array): Promise<void>; close(): Promise<void> } | null = null;
let settingsSnapshot: PrinterSettings | null = null;
const listeners = new Set<() => void>();

function setState(next: PrinterState) {
  state = next;
  emit();
}
function emit() {
  settingsSnapshot = null;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const SERVER_STATE: PrinterState = { status: "idle", label: "", error: null };
const SERVER_SETTINGS: PrinterSettings = DEFAULTS;

/** Estado y ajustes de la impresora. Al montarse intenta reconectar sola la que ya se autorizó (USB y serie). */
export function usePrinter(): { state: PrinterState; settings: PrinterSettings } {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  const settings = useSyncExternalStore(
    subscribe,
    () => (settingsSnapshot ??= loadPrinterSettings()),
    () => SERVER_SETTINGS
  );
  useEffect(() => {
    void reconnectPrinter();
  }, []);
  return { state: s, settings };
}

export function printerReady(): boolean {
  return state.status === "ready" && connection !== null;
}

// --- Conexiones ---

const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openSerial(port: SerialPortLike, baud: number) {
  await port.open({ baudRate: baud });
  return {
    async send(bytes: Uint8Array) {
      if (!port.writable) throw new Error("El puerto no está abierto.");
      const writer = port.writable.getWriter();
      try {
        for (let i = 0; i < bytes.length; i += 512) await writer.write(bytes.slice(i, i + 512));
      } finally {
        writer.releaseLock();
      }
    },
    close: () => port.close(),
  };
}

async function openUsb(device: UsbDeviceLike) {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const iface =
    device.configuration?.interfaces.find((i) => i.alternate.interfaceClass === 7 && i.alternate.endpoints.some((e) => e.direction === "out")) ??
    device.configuration?.interfaces.find((i) => i.alternate.endpoints.some((e) => e.direction === "out" && e.type === "bulk"));
  const endpoint = iface?.alternate.endpoints.find((e) => e.direction === "out");
  if (!iface || !endpoint) throw new Error("No encontramos por dónde mandarle datos a la impresora.");
  await device.claimInterface(iface.interfaceNumber);
  return {
    async send(bytes: Uint8Array) {
      for (let i = 0; i < bytes.length; i += 4096) await device.transferOut(endpoint.endpointNumber, bytes.slice(i, i + 4096));
    },
    close: () => device.close(),
  };
}

async function openBluetooth(device: BleDevice) {
  const server = await device.gatt?.connect();
  if (!server) throw new Error("No pudimos conectar por Bluetooth.");
  let characteristic: BleCharacteristic | null = null;
  for (const service of await server.getPrimaryServices()) {
    for (const c of await service.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) characteristic = characteristic ?? c;
    }
  }
  if (!characteristic) throw new Error("Esta impresora Bluetooth no acepta datos desde el navegador.");
  const target = characteristic;
  return {
    async send(bytes: Uint8Array) {
      for (let i = 0; i < bytes.length; i += 100) {
        const chunk = bytes.slice(i, i + 100);
        if (target.properties.writeWithoutResponse && target.writeValueWithoutResponse) await target.writeValueWithoutResponse(chunk);
        else await target.writeValue(chunk);
        await sleep(25);
      }
    },
    async close() {
      server.disconnect();
    },
  };
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/NotFoundError|No device selected|cancel/i.test(msg)) return "No elegiste ninguna impresora.";
  if (/claim|SecurityError|Access denied|busy/i.test(msg)) return "No pudimos usar la impresora por USB. En Windows, ese modo necesita un driver especial: probá por puerto serie o Bluetooth, o usá la impresión normal.";
  if (/Failed to open|InvalidStateError|already open/i.test(msg)) return "El puerto está ocupado o no responde. Cerrá otros programas que usen la impresora y probá de nuevo.";
  return msg || "No pudimos conectar la impresora.";
}

/** Abre el selector del navegador, conecta y recuerda la elección. Hay que llamarla desde un toque (botón). */
export async function connectPrinter(transport: Transport): Promise<boolean> {
  setState({ status: "connecting", label: "", error: null });
  try {
    await connection?.close().catch(() => {});
    connection = null;
    const current = loadPrinterSettings();
    let label = "";
    const patch: Partial<PrinterSettings> = { transport };
    if (transport === "serial") {
      const port = await nav().serial!.requestPort();
      connection = await openSerial(port, current.baud);
      label = "Impresora por puerto serie";
    } else if (transport === "usb") {
      const device = await nav().usb!.requestDevice({ filters: [] });
      connection = await openUsb(device);
      label = device.productName ?? "Impresora USB";
      patch.usbIds = { vendorId: device.vendorId, productId: device.productId };
    } else {
      const device = await nav().bluetooth!.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
      connection = await openBluetooth(device);
      label = device.name ?? "Impresora Bluetooth";
    }
    patch.name = label;
    savePrinterSettings({ ...current, ...patch });
    setState({ status: "ready", label, error: null });
    return true;
  } catch (e) {
    connection = null;
    setState({ status: "error", label: "", error: friendlyError(e) });
    return false;
  }
}

let reconnecting: Promise<boolean> | null = null;

/** Reconecta sin preguntar la impresora ya autorizada (USB y serie). Bluetooth pide tocar «Conectar» de nuevo. */
export function reconnectPrinter(): Promise<boolean> {
  if (printerReady()) return Promise.resolve(true);
  reconnecting ??= (async () => {
    const s = loadPrinterSettings();
    try {
      if (s.transport === "serial" && nav().serial) {
        const port = (await nav().serial!.getPorts())[0];
        if (!port) return false;
        connection = await openSerial(port, s.baud);
      } else if (s.transport === "usb" && nav().usb && s.usbIds) {
        const ids = s.usbIds;
        const device = (await nav().usb!.getDevices()).find((d) => d.vendorId === ids.vendorId && d.productId === ids.productId);
        if (!device) return false;
        connection = await openUsb(device);
      } else {
        return false;
      }
      setState({ status: "ready", label: s.name ?? "Impresora", error: null });
      return true;
    } catch {
      connection = null;
      return false;
    } finally {
      reconnecting = null;
    }
  })();
  return reconnecting;
}

export async function disconnectPrinter(): Promise<void> {
  await connection?.close().catch(() => {});
  connection = null;
  const s = loadPrinterSettings();
  savePrinterSettings({ ...s, transport: null, usbIds: undefined, name: undefined });
  setState({ status: "idle", label: "", error: null });
}

/** Manda bytes a la impresora; `true` si salieron. No tira error: si falla, avisa con `false` para volver al diálogo normal. */
export async function sendToPrinter(bytes: Uint8Array): Promise<boolean> {
  if (!printerReady() && !(await reconnectPrinter())) return false;
  try {
    await connection!.send(bytes);
    return true;
  } catch (e) {
    connection = null;
    setState({ status: "error", label: "", error: friendlyError(e) });
    return false;
  }
}

/** Opciones de armado según lo configurado. */
export function builderFor(s: PrinterSettings): EscposBuilder {
  return new EscposBuilder({ columns: COLUMNS[s.paper], accents: s.accents });
}

/** Página de prueba: para ver que sale bien (acentos, ancho y corte) antes de usarla en el mostrador. */
export async function printTestPage(): Promise<boolean> {
  const s = loadPrinterSettings();
  const b = builderFor(s).init().align("center").bold(true).setSize("big").line("PESITO").setSize("normal").bold(false);
  b.line("Prueba de impresión").align("left").rule();
  b.line("Acentos: áéíóú ÁÉÍÓÚ ñ Ñ ¿? ¡!");
  b.row("Ancho del papel", `${s.paper} mm`);
  b.row("Café con leche x 2", "$ 4.800");
  b.row("TOTAL", "$ 4.800").rule();
  b.align("center").line("Si ves esto bien, ya está lista.");
  if (s.drawer) b.openDrawer();
  if (s.cut) b.cut();
  else b.feed(4);
  return sendToPrinter(b.build());
}
