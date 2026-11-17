import type { DocArticle } from "@/lib/docs/types";

const UPDATED = "2026-11-17";

export const comprobantesDocs: DocArticle[] = [
  {
    slug: "como-conectar-una-impresora-termica",
    title: "Cómo conectar una impresora térmica",
    category: "comprobantes",
    summary: "Conectá tu impresora de tickets de 58 u 80 mm para que el ticket salga solo al cobrar. Función en prueba.",
    plan: null,
    where: "**Ajustes → Negocio → Impresora**",
    before: [
      "Usar Chrome o Edge en la computadora: otros navegadores no permiten conectar impresoras.",
      "Tener la impresora prendida, con papel y conectada (USB, puerto serie o Bluetooth).",
    ],
    steps: [
      { text: "Entrá a **Ajustes** y buscá **Conectá tu impresora**." },
      { text: "Elegí cómo se conecta: **Por cable USB**, **Por puerto serie o Bluetooth emparejado** o **Por Bluetooth (BLE)**." },
      { text: "Elegí tu impresora en la ventana que se abre." },
      { text: "Elegí el **Ancho del papel** (58 u 80 mm)." },
      { text: "Tocá **Imprimir una prueba** y fijate que se vean bien los acentos y que corte el papel." },
      { text: "Activá **Imprimir al cobrar** para que el ticket salga solo al terminar cada venta." },
    ],
    tips: [
      "Es una función en prueba: si algo no sale bien, escribinos desde **Ayuda**.",
      "Si salen símbolos raros, apagá **Acentos y ñ**. Si sale basura en puerto serie, probá la **Velocidad del puerto** 115200.",
      "Si tu impresora tiene cortador o cajón, podés activar **Cortar el papel** y **Abrir el cajón de dinero**.",
      "Sin impresora térmica, el ticket se imprime con el diálogo de impresión del navegador.",
    ],
    keywords: ["impresora termica", "ticket", "imprimir", "58mm", "80mm", "usb", "bluetooth", "cajon de dinero", "cortar papel", "impresora"],
    related: ["como-imprimir-el-ticket-de-una-venta"],
    connections: [
      { slug: "como-personalizar-el-ticket", text: "Qué muestra el ticket se elige en **Ajustes**." },
    ],
    updatedAt: UPDATED,
  },
];
