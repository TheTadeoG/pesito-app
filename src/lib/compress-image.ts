// Achica la foto de un producto en el navegador antes de subirla: una foto de
// celular pesa 3 a 5 MB y se muestra a ~100 px. En WebP, máximo 800 px de lado,
// queda en ~50 a 150 KB: menos almacenamiento y menos transferencia cada vez
// que se ve (la imagen se baja en el POS, en Productos y en Compras).
// Si algo falla (navegador sin soporte, imagen rara) devuelve el archivo tal cual.

const MAX_SIDE = 800;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  // SVG y GIF (puede estar animado) se suben como vienen.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    // Fondo blanco: un PNG con transparencia no queda negro al pasar a WebP/JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
    if (!blob || !blob.type.startsWith("image/") || blob.size >= file.size) return file;
    const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
    const base = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${base}.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
}
