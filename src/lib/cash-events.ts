// Aviso en el navegador de que entró (o salió) efectivo de la caja abierta,
// para que la tarjeta "Vender" del menú lateral actualice su "$ X en caja"
// sin volver a renderizar la página desde el servidor (ver checkoutSale).
const CASH_DELTA_EVENT = "pesito:cash-delta";

export function emitCashDelta(amount: number) {
  if (amount === 0) return;
  window.dispatchEvent(new CustomEvent<number>(CASH_DELTA_EVENT, { detail: amount }));
}

export function onCashDelta(listener: (amount: number) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<number>).detail);
  window.addEventListener(CASH_DELTA_EVENT, handler);
  return () => window.removeEventListener(CASH_DELTA_EVENT, handler);
}

// Momento de la última venta cobrada en el POS. El caché del navegador
// (staleTimes en next.config.ts) guarda cada página hasta 30 s, así que al
// volver enseguida a Caja/Reportes/Productos se verían sin esa venta.
// RefreshAfterSale la usa para refrescar la primera página fuera del POS.
let lastSaleAt: number | null = null;
const STALE_SECONDS = 30;

export function markSaleCompleted() {
  lastSaleAt = Date.now();
}

/** true (una sola vez) si hubo una venta que el caché todavía puede no mostrar. */
export function consumePendingSale(): boolean {
  const pending = lastSaleAt !== null && Date.now() - lastSaleAt < STALE_SECONDS * 1000;
  lastSaleAt = null;
  return pending;
}
