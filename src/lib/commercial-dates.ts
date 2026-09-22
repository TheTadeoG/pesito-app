// Fechas comerciales relevantes para un kiosco/almacén argentino, para poder
// avisar con anticipación y armar una promo (vidriera, combos, stock extra).
// Las de Hot Sale y CyberMonday son orientativas: el organizador (CACE) anuncia
// la fecha exacta de cada edición pocos meses antes, así que acá se usa una
// fecha aproximada típica de años anteriores.

export interface CommercialDate {
  id: string;
  name: string;
  suggestion: string;
  approximate?: boolean;
}

interface FixedDate extends CommercialDate {
  month: number; // 1-12
  day: number;
}

interface NthWeekdayDate extends CommercialDate {
  month: number; // 1-12
  weekday: number; // 0 = domingo
  nth: number; // 1ro, 2do, 3er...
}

const FIXED_DATES: FixedDate[] = [
  { id: "reyes", name: "Día de Reyes", month: 1, day: 6, suggestion: "Golosinas y juguetes chicos." },
  {
    id: "mujer",
    name: "Día de la Mujer",
    month: 3,
    day: 8,
    suggestion: "Combos de regalo, perfumería y golosinas.",
  },
  {
    id: "hotsale",
    name: "Hot Sale",
    month: 5,
    day: 12,
    suggestion: "Descuentos puntuales para atraer gente esta semana.",
    approximate: true,
  },
  {
    id: "independencia",
    name: "Día de la Independencia",
    month: 7,
    day: 9,
    suggestion: "Es feriado: stock de bebidas y picada para reuniones.",
  },
  {
    id: "enamorados",
    name: "Día de los Enamorados",
    month: 7,
    day: 14,
    suggestion: "Golosinas, bebidas y regalos para parejas.",
  },
  { id: "amigo", name: "Día del Amigo", month: 7, day: 20, suggestion: "Snacks y bebidas para juntadas." },
  {
    id: "primavera",
    name: "Día de la Primavera / Estudiante",
    month: 9,
    day: 21,
    suggestion: "Bebidas, snacks y helados para el picnic.",
  },
  {
    id: "cybermonday",
    name: "CyberMonday",
    month: 11,
    day: 3,
    suggestion: "Promos online/vidriera si vendés por redes.",
    approximate: true,
  },
  {
    id: "navidad",
    name: "Navidad",
    month: 12,
    day: 25,
    suggestion: "Sidra, pan dulce, turrones: stock con anticipación.",
  },
  {
    id: "añonuevo",
    name: "Año Nuevo",
    month: 1,
    day: 1,
    suggestion: "Hielo, bebidas y cotillón para el 31.",
  },
];

const NTH_WEEKDAY_DATES: NthWeekdayDate[] = [
  {
    id: "dia-padre",
    name: "Día del Padre",
    month: 6,
    weekday: 0,
    nth: 3,
    suggestion: "Regalos, bebidas y asado.",
  },
  {
    id: "dia-nino",
    name: "Día del Niño",
    month: 8,
    weekday: 0,
    nth: 3,
    suggestion: "Golosinas y juguetes bien visibles en el mostrador.",
  },
  {
    id: "dia-madre",
    name: "Día de la Madre",
    month: 10,
    weekday: 0,
    nth: 3,
    suggestion: "Combos de regalo y perfumería.",
  },
];

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return new Date(year, month - 1, day);
}

function nextOccurrence(getDate: (year: number) => Date, from: Date): Date {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let candidate = getDate(today.getFullYear());
  if (candidate < today) {
    candidate = getDate(today.getFullYear() + 1);
  }
  return candidate;
}

export interface UpcomingCommercialDate extends CommercialDate {
  date: Date;
  daysUntil: number;
}

/** Próximas fechas comerciales dentro de los próximos `withinDays` días. */
export function getUpcomingCommercialDates(from: Date, withinDays: number): UpcomingCommercialDate[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  const all: UpcomingCommercialDate[] = [
    ...FIXED_DATES.map((d) => {
      const date = nextOccurrence((year) => new Date(year, d.month - 1, d.day), today);
      const daysUntil = Math.round((date.getTime() - today.getTime()) / 86400000);
      return { ...d, date, daysUntil };
    }),
    ...NTH_WEEKDAY_DATES.map((d) => {
      const date = nextOccurrence((year) => nthWeekdayOfMonth(year, d.month, d.weekday, d.nth), today);
      const daysUntil = Math.round((date.getTime() - today.getTime()) / 86400000);
      return { ...d, date, daysUntil };
    }),
  ];

  return all
    .filter((d) => d.daysUntil >= 0 && d.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
