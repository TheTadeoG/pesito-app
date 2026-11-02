// Esquemas animados de lo que hay que hacer en ARCA, uno por paso. No son capturas de ARCA (para entrar hay que usar
// la clave fiscal de cada persona): muestran la idea del paso, con lo que hay que tocar marcado y en movimiento.
// Las animaciones están en globals.css (.arca-*) y se apagan con «reducir movimiento».

const C = {
  card: "var(--card, #fff)",
  border: "var(--border, #e5e7eb)",
  muted: "var(--muted, #f3f4f6)",
  fg: "var(--foreground, #111827)",
  sub: "var(--muted-foreground, #6b7280)",
  primary: "var(--primary, #059669)",
  accent: "var(--accent, #d1fae5)",
};

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 320 170" role="img" aria-label={label} className="mx-auto w-full max-w-md rounded-xl border border-border bg-muted/40">
      <rect x="10" y="10" width="300" height="150" rx="10" fill={C.card} stroke={C.border} />
      <rect x="10" y="10" width="300" height="22" rx="10" fill={C.muted} />
      <rect x="10" y="22" width="300" height="10" fill={C.muted} />
      <circle cx="24" cy="21" r="3" fill="#f87171" />
      <circle cx="35" cy="21" r="3" fill="#fbbf24" />
      <circle cx="46" cy="21" r="3" fill="#34d399" />
      <rect x="62" y="15" width="150" height="12" rx="6" fill={C.card} stroke={C.border} />
      <text x="72" y="24" fontSize="7" fill={C.sub}>arca.gob.ar</text>
      {children}
    </svg>
  );
}

function Pulse({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect className="arca-pulse" x={x} y={y} width={w} height={h} rx="7" fill="none" stroke={C.primary} strokeWidth="2.5" />;
}

/** «Abrí el servicio X»: un buscador donde se escribe el nombre y aparece el resultado. */
export function SceneSearch({ query }: { query: string }) {
  return (
    <Frame label={`Buscar el servicio ${query}`}>
      <text x="26" y="52" fontSize="8" fontWeight="600" fill={C.fg}>Mis servicios</text>
      <rect x="26" y="60" width="268" height="20" rx="6" fill={C.card} stroke={C.border} />
      <text x="34" y="73" fontSize="8" fill={C.fg} className="arca-type">{query}</text>
      <rect x="26" y="88" width="268" height="22" rx="6" fill={C.accent} className="arca-appear" />
      <text x="34" y="102" fontSize="8" fontWeight="600" fill={C.fg} className="arca-appear">{query}</text>
      <Pulse x={24} y={86} w={272} h={26} />
      <rect x="26" y="118" width="268" height="18" rx="6" fill={C.muted} />
      <rect x="26" y="142" width="268" height="12" rx="6" fill={C.muted} />
    </Frame>
  );
}

/** Alta del punto de venta. */
export function ScenePuntoVenta({ system = "Factura Electrónica – Monotributo – Web Services" }: { system?: string }) {
  return (
    <Frame label="Alta de punto de venta">
      <text x="26" y="52" fontSize="8" fontWeight="600" fill={C.fg}>Alta de Punto de Venta</text>
      <text x="26" y="68" fontSize="7" fill={C.sub}>Número</text>
      <rect x="70" y="60" width="40" height="12" rx="4" fill={C.card} stroke={C.border} />
      <text x="76" y="69" fontSize="8" fill={C.fg} className="arca-type">3</text>
      <text x="26" y="92" fontSize="7" fill={C.sub}>Sistema</text>
      <rect x="70" y="84" width="224" height="14" rx="4" fill={C.accent} stroke={C.primary} />
      <text x="76" y="94" fontSize="7" fill={C.fg}>{system}</text>
      <Pulse x={68} y={82} w={228} h={18} />
      <rect x="236" y="128" width="58" height="18" rx="6" fill={C.primary} />
      <text x="248" y="140" fontSize="8" fill="#fff">Aceptar</text>
    </Frame>
  );
}

/** Agregar alias y subir el archivo de la solicitud. */
export function SceneUpload() {
  return (
    <Frame label="Agregar alias y subir el archivo .csr">
      <text x="26" y="52" fontSize="7" fill={C.sub}>Alias</text>
      <rect x="26" y="56" width="120" height="14" rx="4" fill={C.card} stroke={C.border} />
      <text x="32" y="66" fontSize="8" fontWeight="600" fill={C.fg} className="arca-type">pesito</text>
      <text x="26" y="88" fontSize="7" fill={C.sub}>Solicitud de certificado</text>
      <rect x="26" y="92" width="268" height="34" rx="6" fill="none" stroke={C.border} strokeDasharray="4 3" />
      <g className="arca-fly">
        <rect x="40" y="100" width="64" height="18" rx="4" fill={C.accent} stroke={C.primary} />
        <text x="46" y="112" fontSize="8" fontWeight="600" fill={C.fg}>pesito.csr</text>
      </g>
      <text x="190" y="113" fontSize="14" fill={C.primary} className="arca-appear">✓</text>
      <rect x="236" y="134" width="58" height="16" rx="6" fill={C.primary} />
      <text x="247" y="145" fontSize="8" fill="#fff">Aceptar</text>
    </Frame>
  );
}

/** Descargar el certificado: primero «Ver» en la lista y, a la derecha, aparece «Descargar». */
export function SceneDownload() {
  return (
    <Frame label="Tocar Ver junto al alias y, a la derecha, Descargar">
      <text x="26" y="50" fontSize="8" fontWeight="600" fill={C.fg}>Certificados</text>
      <rect x="26" y="58" width="150" height="24" rx="6" fill={C.muted} />
      <text x="34" y="74" fontSize="8" fill={C.fg}>pesito</text>
      <rect x="132" y="62" width="36" height="16" rx="6" fill={C.card} stroke={C.primary} />
      <text x="142" y="73" fontSize="8" fontWeight="600" fill={C.fg}>Ver</text>
      <Pulse x={130} y={60} w={40} h={20} />
      <rect x="26" y="88" width="150" height="24" rx="6" fill={C.muted} />
      <rect x="26" y="118" width="150" height="24" rx="6" fill={C.muted} />
      <g className="arca-appear">
        <rect x="190" y="50" width="104" height="104" rx="8" fill={C.card} stroke={C.border} />
        <text x="200" y="66" fontSize="7" fill={C.sub}>Certificado pesito</text>
        <rect x="200" y="74" width="84" height="16" rx="6" fill={C.primary} />
        <text x="214" y="85" fontSize="8" fill="#fff">Descargar</text>
        <rect x="198" y="72" width="88" height="20" rx="7" fill="none" stroke={C.primary} strokeWidth="2.5" className="arca-pulse" />
      </g>
      <g className="arca-drop">
        <rect x="204" y="112" width="76" height="28" rx="5" fill={C.accent} stroke={C.primary} />
        <text x="216" y="130" fontSize="9" fontWeight="600" fill={C.fg}>pesito.crt</text>
      </g>
    </Frame>
  );
}

/** Nueva relación: el servicio y el alias como representante. */
export function SceneRelation() {
  return (
    <Frame label="Nueva relación con Facturación Electrónica y el alias pesito">
      <text x="26" y="50" fontSize="8" fontWeight="600" fill={C.fg}>Nueva relación</text>
      <text x="26" y="68" fontSize="7" fill={C.sub}>Servicio</text>
      <rect x="26" y="72" width="268" height="16" rx="5" fill={C.accent} stroke={C.border} />
      <text x="34" y="83" fontSize="8" fill={C.fg}>Web Services › Facturación Electrónica</text>
      <text x="26" y="102" fontSize="7" fill={C.sub}>Representante</text>
      <rect x="26" y="106" width="268" height="16" rx="5" fill={C.accent} stroke={C.primary} />
      <text x="34" y="117" fontSize="8" fontWeight="600" fill={C.fg}>pesito</text>
      <Pulse x={24} y={104} w={272} h={20} />
      <rect x="226" y="134" width="68" height="16" rx="6" fill={C.primary} />
      <text x="240" y="145" fontSize="8" fill="#fff">Confirmar</text>
    </Frame>
  );
}

/** Arrastrar el .crt a Pesito. */
export function SceneDrop() {
  return (
    <Frame label="Arrastrar el archivo .crt a la zona de carga">
      <text x="26" y="52" fontSize="8" fontWeight="600" fill={C.fg}>Pesito · Facturación</text>
      <rect x="26" y="60" width="268" height="80" rx="10" fill="none" stroke={C.primary} strokeWidth="2" strokeDasharray="6 4" />
      <text x="160" y="134" fontSize="8" textAnchor="middle" fill={C.sub}>Arrastrá acá el archivo .crt</text>
      <g className="arca-drag">
        <rect x="132" y="70" width="56" height="22" rx="4" fill={C.accent} stroke={C.primary} />
        <text x="140" y="85" fontSize="9" fontWeight="600" fill={C.fg}>pesito.crt</text>
      </g>
    </Frame>
  );
}
