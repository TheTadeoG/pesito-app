"use client";

import { cn } from "@/lib/utils";
import { useCountUp } from "@/components/marketing/features-live";
import {
  ActionButton,
  Card,
  Line,
  Num,
  Pill,
  ars,
  cols,
  type SceneProps,
} from "@/components/marketing/hero-panel-ui";

// Escenas que sólo se cargan si alguien toca su ítem del menú.

const CAJAS = [
  { who: "Caja de Marta", rows: [[20000, 3], [10000, 2], [5000, 2], [2000, 2], [1000, 1]], coins: 1500, expected: 96500 },
  { who: "Caja de Lucas", rows: [[20000, 1], [10000, 1], [5000, 1], [2000, 2], [1000, 1]], coins: 700, expected: 41200 },
] as const;

export function CajaScene({ ph, variant, btnRef, tg, active }: SceneProps) {
  const caja = CAJAS[variant % CAJAS.length];
  const total = caja.rows.reduce((s, [d, n]) => s + d * n, 0) + caja.coins;
  const counted = ph >= 1 || !active;
  const contado = useCountUp(counted ? total : 0, 1100);
  const diff = total - caja.expected;
  const hit = active && ph === 4;
  return (
    <div className={cols}>
      <Card title={`Conteo de billetes · ${caja.who}`}>
        <ul>
          {caja.rows.map(([d, n], i) => (
            <li
              key={d}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 border-b border-border py-1.5 tabular-nums"
            >
              <span>{ars(d)}</span>
              <span
                style={{ transitionDelay: `${i * 180}ms` }}
                className={cn("min-w-6 text-right text-muted-foreground transition-colors", counted && "font-bold text-foreground")}
              >
                x{n}
              </span>
              <span className="min-w-16 text-right font-semibold">{ars(d * n)}</span>
            </li>
          ))}
          <li className="grid grid-cols-[1fr_auto] items-center py-1.5 tabular-nums">
            <span>Monedas</span>
            <span className="min-w-16 text-right font-semibold">{ars(caja.coins)}</span>
          </li>
        </ul>
        <ActionButton btnRef={btnRef} ph={ph} label="Cerrar caja" done="Caja cerrada" />
      </Card>
      <div className="flex flex-col gap-2.5">
        <Card title="Esperado" tgRef={tg(0)} hit={hit}>
          <Num>{ars(caja.expected)}</Num>
          <div className="text-[11px] text-muted-foreground">Lo que dice el sistema</div>
        </Card>
        <Card title="Contado" tgRef={tg(1)} hit={hit}>
          <Num>{ars(contado)}</Num>
          <div className="text-[11px] text-muted-foreground">Lo que hay en el cajón</div>
        </Card>
        <Card
          title="Diferencia"
          tgRef={tg(2)}
          hit={hit}
          right={
            <Pill tone={diff === 0 ? "ok" : "warn"} hidden={ph < 4}>
              {diff === 0 ? "Sin diferencias" : `Faltan ${ars(-diff)}`}
            </Pill>
          }
        >
          <Num>{ph >= 4 ? `${diff < 0 ? "-" : ""}${ars(Math.abs(diff))}` : "-"}</Num>
        </Card>
      </div>
    </div>
  );
}

function Bubble({ me, show, delay = 0, children }: { me?: boolean; show: boolean; delay?: number; children: React.ReactNode }) {
  return (
    <div
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "mb-1.5 max-w-[88%] rounded-[10px] px-2.5 py-[7px] text-xs leading-snug transition-[opacity,transform] duration-300",
        me ? "ml-auto rounded-tr-sm bg-[#dcf8c6] text-[#0b3d1c] dark:bg-[#134a32] dark:text-[#d7f5e5]" : "rounded-tl-sm bg-muted",
        !show && "translate-y-1.5 opacity-0"
      )}
    >
      {children}
    </div>
  );
}

const ORDER_LINES = [
  ["Aceite girasol 900 ml", "Vendés unas 9 por día", "x12"],
  ["Arroz largo fino 1 kg", "Vendés unas 18 por día", "x24"],
  ["Leche entera 1 L", "Vendés unas 27 por día", "x36"],
] as const;

export function ProveedoresScene({ ph, btnRef, tg, active }: SceneProps) {
  const hit = active && ph === 4;
  return (
    <div className={cols}>
      <Card title="Pedido armado por Pesito" right={<Pill tone="soft">Distribuidora Norte</Pill>}>
        {ORDER_LINES.map(([n, s, q]) => (
          <Line key={n} title={n} sub={s} qty={q} />
        ))}
        <ActionButton btnRef={btnRef} ph={ph} label="Enviar por WhatsApp" done="Pedido enviado" />
      </Card>
      <div className="flex flex-col gap-2.5">
        <Card title="WhatsApp" tgRef={tg(0)} hit={hit} right={<Pill>en línea</Pill>}>
          <Bubble me show={ph >= 3}>
            Hola! Te paso el pedido de hoy: aceite x12, arroz x24, leche x36.
            <small className="mt-0.5 block text-right text-[10px] opacity-60">18:42 ✓✓</small>
          </Bubble>
          <Bubble show={ph >= 4} delay={500}>
            Perfecto, mañana te lo llevamos.
            <small className="mt-0.5 block text-right text-[10px] opacity-60">18:44</small>
          </Bubble>
        </Card>
        <Card title="Estado del pedido" tgRef={tg(1)} hit={hit} right={<Pill tone="soft" hidden={ph < 4}>En camino</Pill>}>
          <Num className="text-lg">{ph >= 4 ? "Llega mañana" : "Sin enviar"}</Num>
        </Card>
      </div>
    </div>
  );
}
