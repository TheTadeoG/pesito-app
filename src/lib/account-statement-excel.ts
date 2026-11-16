import { getAccountStatement } from "@/lib/actions/account-statement";
import { formatDate } from "@/lib/utils";

type Cell = { value: string | number | Date; fontWeight?: "bold"; backgroundColor?: string; format?: string; align?: "left" | "right" };

/**
 * Baja a Excel el estado de cuenta de un cliente o proveedor: sus datos arriba y los movimientos de más viejo a más nuevo,
 * con el saldo corriendo hasta el saldo actual. Devuelve un mensaje si no se pudo.
 */
export async function downloadAccountStatement(kind: "cliente" | "proveedor", id: string): Promise<string | null> {
  const st = await getAccountStatement(kind, id);
  if (st.error || !st.movements) return st.error ?? "No pudimos armar el estado de cuenta.";

  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const money = (value: number, extra: Partial<Cell> = {}): Cell => ({ value, format: "0.00", ...extra });
  const sorted = [...st.movements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let saldo = 0;
  const lines: Cell[][] = sorted.map((m) => {
    saldo = Math.round((saldo + m.cargo - m.pago) * 100) / 100;
    return [
      { value: new Date(m.date), format: "dd/mm/yyyy hh:mm" },
      { value: m.label },
      m.cargo > 0 ? money(m.cargo) : { value: "" },
      m.pago > 0 ? money(m.pago) : { value: "" },
      money(saldo),
    ];
  });

  const who = kind === "cliente" ? "Cliente" : "Proveedor";
  const owes = kind === "cliente" ? "Te debe" : "Le debés";
  const today = formatDate(new Date());
  const head = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#e5e7eb" });
  const info = (label: string, value: string | number | Date, extra: Partial<Cell> = {}): Cell[] => [{ value: label, fontWeight: "bold" }, { value, ...extra }];
  const rows: Cell[][] = [
    [{ value: "Estado de cuenta", fontWeight: "bold" }],
    info(who, `${st.name}${st.code ? ` (${st.code})` : ""}`),
    ...(st.contact ? [info("Contacto", st.contact)] : []),
    info("Fecha del estado", today),
    info(`Saldo actual (${owes})`, st.balance ?? saldo, { format: "0.00", fontWeight: "bold" }),
    [],
    [head("Fecha"), head("Operación"), head("Cargo"), head("Pago"), head("Saldo")],
    ...lines,
    ...(lines.length > 0 ? [[{ value: "" }, { value: "Saldo actual", fontWeight: "bold" as const }, { value: "" }, { value: "" }, money(saldo, { fontWeight: "bold" })] as Cell[]] : []),
  ];
  const safe = (st.name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  await writeXlsxFile(rows as never, {
    columns: [{ width: 22 }, { width: 46 }, { width: 14 }, { width: 14 }, { width: 14 }],
  }).toFile(`estado-de-cuenta-${safe || kind}.xlsx`);
  return null;
}
