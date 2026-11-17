import type { DocCategory } from "@/lib/docs/types";

export const docCategories: DocCategory[] = [
  { id: "empezar", title: "Empezar", description: "Tu cuenta, tu negocio, tu equipo y tu plan." },
  { id: "vender", title: "Vender y cobrar", description: "El punto de venta: cobrar, fiado, descuentos, combos y comprobantes." },
  { id: "caja", title: "Caja", description: "Abrir, mover plata y cerrar la caja del día." },
  { id: "productos", title: "Productos", description: "Cargar, cambiar precios, talles y colores, combos, Excel y etiquetas." },
  { id: "stock", title: "Stock", description: "Ajustes, movimientos, alertas, inventario físico y sucursales." },
  { id: "compras", title: "Compras y proveedores", description: "Registrar compras, deudas con proveedores y vencimientos." },
  { id: "clientes", title: "Clientes y fiado", description: "Cargar clientes, cobrar deudas y estados de cuenta." },
  { id: "reportes", title: "Reportes y control", description: "Ganancias, ventas, control por persona y seguimiento en vivo." },
  { id: "comprobantes", title: "Facturas y tickets", description: "Factura electrónica, comprobante X e impresora térmica." },
  { id: "cuenta", title: "Cuenta y seguridad", description: "Contraseña, avisos, datos y baja de la cuenta." },
];
