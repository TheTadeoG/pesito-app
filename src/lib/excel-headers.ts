// Títulos de columna de las planillas de Pesito: los datos obligatorios van en rojo y con asterisco (el resto, en gris).
// Al volver a subir una planilla se reconocen igual: el importador ignora el asterisco y las mayúsculas.

type HeaderCell = { value: string; fontWeight: "bold"; textColor?: string; backgroundColor: string };

export function requiredHeader(title: string): HeaderCell {
  return { value: `${title} *`, fontWeight: "bold", textColor: "#b91c1c", backgroundColor: "#fee2e2" };
}

export function optionalHeader(title: string, backgroundColor = "#f3f4f6"): HeaderCell {
  return { value: title, fontWeight: "bold", backgroundColor };
}

/** Título según sea obligatorio o no. */
export function columnHeader(title: string, required?: boolean): HeaderCell {
  return required ? requiredHeader(title) : optionalHeader(title);
}
