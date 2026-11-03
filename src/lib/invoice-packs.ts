import type { Plan } from "@/lib/subscription";

// Facturas electrónicas por mes: los planes no incluyen facturas; se contratan con paquetes mensuales, que se cobran
// y renuevan junto con el plan. Las notas de crédito cuentan como factura. Pasado el cupo, las ventas siguen con
// comprobante X (no fiscal). Fuente única: la usan el cobro, el control al emitir y los textos públicos.

/** Paquetes que se pueden sumar: facturas por mes y precio mensual en ARS, IVA incluido. */
export const INVOICE_PACKS: { size: number; price: number }[] = [
  { size: 500, price: 9000 },
  { size: 1000, price: 17000 },
  { size: 2000, price: 32000 },
  { size: 3000, price: 45000 },
  { size: 5000, price: 65000 },
  { size: 10000, price: 100000 },
];

export const packPrice = (size: number): number => INVOICE_PACKS.find((p) => p.size === size)?.price ?? 0;
export const isValidPack = (size: number): boolean => size === 0 || INVOICE_PACKS.some((p) => p.size === size);

/** Cupo mensual: el del paquete contratado (los planes no incluyen facturas). */
export const invoiceQuota = (_plan: Plan, pack: number): number => pack;

export const formatCount = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
