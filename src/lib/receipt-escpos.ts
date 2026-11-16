import type { SaleReceipt } from "@/app/(dashboard)/pos/sale-done-dialog";
import { INTERNAL_VOUCHER_LEGEND, internalTicketTitle } from "@/lib/internal-voucher";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { builderFor, sendToPrinter, loadPrinterSettings, printerReady, reconnectPrinter } from "@/lib/thermal-printer";

/**
 * Imprime el ticket de una venta (comprobante interno X) directo en la impresora térmica conectada. Devuelve `true`
 * si salió; `false` si no hay impresora conectada o falló: quien llama usa entonces la impresión normal del navegador.
 */
export async function printReceiptDirect(receipt: SaleReceipt): Promise<boolean> {
  const settings = loadPrinterSettings();
  if (!settings.transport) return false;
  if (!printerReady() && !(await reconnectPrinter())) return false;

  const b = builderFor(settings).init().align("center");
  if (receipt.voided) b.bold(true).setSize("tall").line("VENTA ANULADA").setSize("normal").bold(false);
  if (receipt.orgName) b.bold(true).setSize("big").line(receipt.orgName).setSize("normal").bold(false);
  b.bold(true).line(internalTicketTitle(receipt.internalNumber)).bold(false);
  if (receipt.copy) b.bold(true).line("COPIA").bold(false);
  b.line(formatDateTime(receipt.soldAt));
  if (receipt.customerName) b.line(`Cliente: ${receipt.customerName}`);
  b.align("left").rule();

  for (const line of receipt.lines) {
    b.line(line.name);
    b.row(`${line.quantity}${line.unit ?? ""} x ${formatCurrency(line.unitPrice)}`, formatCurrency(line.subtotal));
  }
  b.rule();

  if (receipt.discount > 0 || receipt.surcharge > 0) b.row("Subtotal", formatCurrency(receipt.subtotal));
  if (receipt.discount > 0) b.row("Descuento", `-${formatCurrency(receipt.discount)}`);
  if (receipt.surcharge > 0) b.row("Recargo", formatCurrency(receipt.surcharge));
  b.bold(true).setSize("tall").row("TOTAL", formatCurrency(receipt.total)).setSize("normal").bold(false);
  for (const p of receipt.payments) b.row(p.label, formatCurrency(p.amount));
  const change = receipt.cashReceived !== null ? Math.max(0, receipt.cashReceived - receipt.total) : 0;
  if (receipt.cashReceived !== null && change > 0) {
    b.row("Recibido", formatCurrency(receipt.cashReceived));
    b.row("Vuelto", formatCurrency(change));
  }
  b.rule().align("center").line("¡Gracias por su compra!").line(INTERNAL_VOUCHER_LEGEND);

  // El cajón se abre sólo en una venta nueva (no al reimprimir una copia).
  if (settings.drawer && !receipt.copy && !receipt.voided) b.openDrawer();
  if (settings.cut) b.cut();
  else b.feed(4);
  return sendToPrinter(b.build());
}
