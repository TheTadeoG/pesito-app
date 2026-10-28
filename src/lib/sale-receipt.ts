import type { SaleReceipt } from "@/app/(dashboard)/pos/sale-done-dialog";
import type { SaleDetail } from "@/lib/actions/sales";

/** Arma el ticket para reimprimir una venta del historial. */
export function receiptFromSale(sale: SaleDetail, orgName: string, paymentLabels: Record<string, string>): SaleReceipt {
  const payments =
    sale.payments.length > 0
      ? sale.payments.map((p) => ({ label: paymentLabels[p.method] ?? p.method, amount: p.amount }))
      : [{ label: paymentLabels[sale.payment_method] ?? sale.payment_method, amount: sale.total }];
  return {
    orgName,
    soldAt: sale.created_at,
    lines: sale.items.map((i) => ({ name: i.product_name, quantity: i.quantity, unitPrice: i.unit_price, subtotal: i.subtotal })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    surcharge: sale.surcharge,
    total: sale.total,
    payments,
    cashReceived: null,
    customerName: sale.customerName === "Consumidor Final" ? null : sale.customerName,
    copy: true,
    voided: sale.status === "anulada",
  };
}
