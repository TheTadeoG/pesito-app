// Billetes y monedas de peso argentino en circulación, de mayor a menor.
// Sin las monedas de 1, 2 y 5, un vuelto que no fuera múltiplo de 10 (ej.
// $1.237) dejaba un resto sin desglosar en la sugerencia.
export const DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export interface BilleteCount {
  value: number;
  count: number;
}

/** Desglose sugerido (greedy) de `amount` en billetes argentinos. */
export function suggestBilletes(amount: number): BilleteCount[] {
  let remaining = Math.round(amount);
  const result: BilleteCount[] = [];

  for (const value of DENOMINATIONS) {
    if (remaining < value) continue;
    const count = Math.floor(remaining / value);
    if (count > 0) {
      result.push({ value, count });
      remaining -= count * value;
    }
  }

  return result;
}
