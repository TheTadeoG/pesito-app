// Comandos ESC/POS para impresoras térmicas (la mayoría de las de 58 y 80 mm). Puro: arma los bytes sin tocar nada, así
// se prueba sin impresora (escpos.test.mts). El envío a la impresora está en thermal-printer.ts.

export type PaperWidth = 58 | 80;

/** Caracteres por línea con la letra normal: 58 mm = 32, 80 mm = 48. */
export const COLUMNS: Record<PaperWidth, number> = { 58: 32, 80: 48 };

export interface EscposOptions {
  columns: number;
  /** Con acentos y ñ (página de códigos 858); sin esto se escriben sin acentos, que sale bien en cualquier impresora. */
  accents: boolean;
}

// Página de códigos 858 (CP850 con el euro): lo que necesita el español.
const CP858: Record<string, number> = {
  "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "ü": 0x81, "Ü": 0x9a,
  "Á": 0xb5, "É": 0x90, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9, "¿": 0xa8, "¡": 0xad, "ª": 0xa6, "º": 0xa7, "°": 0xf8,
  "€": 0xd5, "ç": 0x87, "Ç": 0x80, "à": 0x85, "è": 0x8a, "ä": 0x84, "ö": 0x94,
};

const ASCII_FALLBACK: Record<string, string> = { "¿": "?", "¡": "!", "ª": "a", "º": "o", "°": "o", "€": "EUR", "ñ": "n", "Ñ": "N" };

/** Texto → bytes de la impresora. Lo que no se puede escribir sale como «?». */
export function encodeText(text: string, accents: boolean): number[] {
  const out: number[] = [];
  const clean = text
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...");
  for (const ch of clean) {
    const code = ch.codePointAt(0)!;
    if (code === 10) {
      out.push(10);
    } else if (code >= 32 && code < 127) {
      out.push(code);
    } else if (accents && CP858[ch] !== undefined) {
      out.push(CP858[ch]);
    } else {
      const plain = ASCII_FALLBACK[ch] ?? ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      for (const p of plain) {
        const c = p.codePointAt(0)!;
        out.push(c >= 32 && c < 127 ? c : 0x3f);
      }
    }
  }
  return out;
}

/** Parte un texto en renglones de hasta `width` caracteres, cortando en espacios cuando se puede. */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > width) {
        if (current) {
          lines.push(current);
          current = "";
        }
        lines.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!current) current = w;
      else if (current.length + 1 + w.length <= width) current += ` ${w}`;
      else {
        lines.push(current);
        current = w;
      }
    }
    lines.push(current);
  }
  return lines;
}

export type TextSize = "normal" | "tall" | "big";

export class EscposBuilder {
  private bytes: number[] = [];
  private size: TextSize = "normal";
  private readonly opts: EscposOptions;
  constructor(opts: EscposOptions) {
    this.opts = opts;
  }

  /** Caracteres por línea con el tamaño de letra actual (el doble de ancho entra la mitad). */
  private get width(): number {
    return this.size === "big" ? Math.floor(this.opts.columns / 2) : this.opts.columns;
  }

  private push(...b: number[]): this {
    this.bytes.push(...b);
    return this;
  }

  /** Reinicia la impresora y elige la página de códigos. */
  init(): this {
    this.push(0x1b, 0x40);
    if (this.opts.accents) this.push(0x1b, 0x74, 19); // ESC t 19 = CP858
    return this;
  }

  align(a: "left" | "center" | "right"): this {
    return this.push(0x1b, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
  }

  bold(on: boolean): this {
    return this.push(0x1b, 0x45, on ? 1 : 0);
  }

  setSize(size: TextSize): this {
    this.size = size;
    return this.push(0x1d, 0x21, size === "normal" ? 0x00 : size === "tall" ? 0x01 : 0x11);
  }

  /** Escribe texto (sin salto de línea al final). */
  text(t: string): this {
    this.bytes.push(...encodeText(t, this.opts.accents));
    return this;
  }

  /** Un renglón (o varios si no entra) con el tamaño actual. */
  line(t = ""): this {
    for (const l of wrapText(t, this.width)) this.text(l).push(10);
    return this;
  }

  /** Línea de guiones de lado a lado. */
  rule(): this {
    return this.text("-".repeat(this.width)).push(10);
  }

  /** Izquierda y derecha en el mismo renglón (cantidad y precio, total…). Si la izquierda no entra, sigue abajo. */
  row(left: string, right: string): this {
    const w = this.width;
    const space = w - right.length - 1;
    const parts = wrapText(left, Math.max(1, space));
    parts.forEach((p, i) => {
      if (i < parts.length - 1) this.text(p).push(10);
      else this.text(p.padEnd(Math.max(1, w - right.length), " ").slice(0, Math.max(1, w - right.length)) + right).push(10);
    });
    return this;
  }

  feed(lines: number): this {
    return this.push(0x1b, 0x64, Math.min(Math.max(lines, 0), 255));
  }

  /** Código QR (la factura lo lleva). Modelo 2, corrección L. */
  qr(data: string, moduleSize = 5): this {
    const d = encodeText(data, false);
    const len = d.length + 3;
    this.align("center");
    this.push(0x1d, 0x28, 0x6b, 4, 0, 49, 65, 50, 0); // modelo 2
    this.push(0x1d, 0x28, 0x6b, 3, 0, 49, 67, Math.min(Math.max(moduleSize, 1), 16)); // tamaño del módulo
    this.push(0x1d, 0x28, 0x6b, 3, 0, 49, 69, 48); // corrección de errores L
    this.push(0x1d, 0x28, 0x6b, len & 0xff, len >> 8, 49, 80, 48, ...d); // guardar los datos
    this.push(0x1d, 0x28, 0x6b, 3, 0, 49, 81, 48); // imprimir
    this.push(10);
    return this.align("left");
  }

  /** Avanza el papel y corta (las que no tienen cuchilla lo ignoran; por eso se avanza igual). */
  cut(): this {
    this.feed(4);
    return this.push(0x1d, 0x56, 66, 0);
  }

  /** Abre el cajón de dinero conectado a la impresora. */
  openDrawer(): this {
    return this.push(0x1b, 0x70, 0, 25, 250);
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}
