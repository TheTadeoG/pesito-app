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
    intro: [
      "Con una impresora térmica de tickets conectada, el ticket sale solo al terminar cada venta, sin diálogo de impresión. Es una función en prueba.",
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
    faq: [
      { q: "¿Con qué navegador funciona?", a: "Con Chrome o Edge en la computadora. Los otros navegadores no permiten conectar impresoras." },
      { q: "¿Qué tipos de conexión soporta?", a: "**Por cable USB**, **Por puerto serie o Bluetooth emparejado** y **Por Bluetooth (BLE)**, para impresoras de 58 y 80 mm." },
      { q: "¿Qué hago si salen símbolos raros?", a: "Apagá **Acentos y ñ**. En puerto serie, probá cambiar la **Velocidad del puerto** (casi todas usan 9600; si sale basura, probá 115200)." },
      { q: "¿Y si se desconecta?", a: "Aparece **Volvé a conectarla (se desconectó)**: tocalo y elegí la impresora de nuevo." },
    ],
    keywords: ["impresora termica", "ticket", "imprimir", "58mm", "80mm", "usb", "bluetooth", "cajon de dinero", "cortar papel", "impresora"],
    related: ["como-imprimir-el-ticket-de-una-venta"],
    connections: [
      { slug: "como-personalizar-el-ticket", text: "Qué muestra el ticket se elige en **Ajustes**." },
    ],
    updatedAt: UPDATED,
  },
];
