/** Parte un texto con **negritas** en trozos ({ text, bold }) para mostrarlo sin HTML suelto. */
export function inlineParts(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((p) => p.text !== "");
}

/** El mismo texto sin los asteriscos (para datos estructurados y resúmenes). */
export function plainText(text: string): string {
  return text.replace(/\*\*/g, "");
}
