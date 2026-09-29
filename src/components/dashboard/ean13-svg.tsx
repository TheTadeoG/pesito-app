import { ean13Modules } from "@/lib/barcode";

// Código de barras EAN-13 dibujado en SVG (sin librerías): las barras salen
// de los 95 módulos del código, con 9 módulos de margen a cada lado y los
// números debajo.
export function Ean13Svg({ code, className }: { code: string; className?: string }) {
  const modules = ean13Modules(code);
  const quiet = 9;
  const barHeight = 54;
  const guardExtra = 5;
  const width = 95 + quiet * 2;
  const height = barHeight + guardExtra + 11;

  // Las barras contiguas se juntan en un solo rectángulo.
  const bars: { x: number; w: number }[] = [];
  for (let i = 0; i < modules.length; ) {
    if (modules[i] === "1") {
      let j = i;
      while (modules[j] === "1") j++;
      bars.push({ x: i, w: j - i });
      i = j;
    } else {
      i++;
    }
  }
  // Barras de guarda (inicio, centro y fin) más largas.
  const isGuard = (x: number) => x < 3 || (x >= 45 && x < 50) || x >= 92;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Código de barras ${code}`}
      shapeRendering="crispEdges"
    >
      <rect width={width} height={height} fill="#fff" />
      {bars.map((bar) => (
        <rect
          key={bar.x}
          x={quiet + bar.x}
          y={0}
          width={bar.w}
          height={isGuard(bar.x) ? barHeight + guardExtra : barHeight}
          fill="#000"
        />
      ))}
      <g fontFamily="monospace" fontSize="10" fill="#000" textAnchor="middle">
        <text x={quiet - 4} y={height - 1}>{code[0]}</text>
        <text x={quiet + 3 + 21} y={height - 1} textLength={40} lengthAdjust="spacing">{code.slice(1, 7)}</text>
        <text x={quiet + 50 + 21} y={height - 1} textLength={40} lengthAdjust="spacing">{code.slice(7)}</text>
      </g>
    </svg>
  );
}
