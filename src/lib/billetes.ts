// Billetes de peso argentino en circulación, de mayor a menor.
export const DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];

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
