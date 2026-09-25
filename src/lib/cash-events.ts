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
