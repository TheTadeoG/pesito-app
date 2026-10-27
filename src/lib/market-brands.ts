// Marcas que se guardan del recorrido de catálogos de los súper (sin esto se bajaría todo, con marcas
// propias y productos que casi nadie busca). Se puede cambiar con MARKET_BRANDS (marcas separadas por
// coma) o poner MARKET_BRANDS=todas para guardar todo. Los códigos de barras de los negocios se
// consultan aparte (sin filtro de marca).

export const MAIN_BRANDS = [
  // Bebidas
  "Coca-Cola", "Sprite", "Fanta", "Schweppes", "Pepsi", "7Up", "Mirinda", "Manaos", "Paso de los Toros", "Cunnington",
  "Villa del Sur", "Villavicencio", "Ser", "Cepita", "Baggio", "Levité", "Aquarius", "Powerade", "Gatorade", "Speed", "Monster", "Red Bull",
  "Quilmes", "Brahma", "Stella Artois", "Andes", "Heineken", "Imperial", "Patagonia", "Corona", "Budweiser", "Isenbeck", "Salta",
  "Fernet Branca", "Branca", "Cinzano", "Gancia", "Campari", "Aperol", "Smirnoff", "Gordon's", "Trapiche", "Norton", "Salentein",
  "Alamos", "Chandon", "Termidor", "Toro", "Latitud 33", "Santa Julia", "Cafayate", "López",
  // Almacén
  "Arcor", "Bagley", "Terrabusi", "Oreo", "Pepitos", "Cadbury", "Milka", "Georgalos", "Felfort", "Cofler", "Marolio", "La Campagnola",
  "Knorr", "Maggi", "Hellmann's", "Natura", "Cocinero", "Lucchetti", "Matarazzo", "Molinos", "Gallo", "Dos Anclas", "La Virginia",
  "Taragüí", "Playadito", "Amanda", "Cruz de Malta", "Nobleza Gaucha", "Mantecol", "Quaker", "Kellogg's", "Nestlé", "Paladini",
  "Swift", "Ledesma", "Chango", "Fargo", "Bimbo", "Lactal", "Cachafaz", "Los Nietitos", "Dulce de Leche La Serenísima", "Havanna",
  "Lays", "Pringles", "Doritos", "Cheetos", "Twistos", "Cabrales", "La Morenita", "Hereford", "Vienissima", "Ilolay",
  // Lácteos
  "Sancor", "La Serenísima", "Danone", "Ilolay", "Verónica", "Tregar", "Casancrem", "Milkaut", "La Paulina", "Activia", "Serenito",
  "Yogurísimo", "Cremon", "Vacalín", "Mendicrim", "Ser Sancor", "Shimy",
  // Limpieza
  "Ala", "Skip", "Ariel", "Drive", "Ayudín", "Cif", "Mr Músculo", "Lysoform", "Vim", "Magistral", "Querubín", "Vivere", "Comfort",
  "Downy", "Procenex", "Odex", "Raid", "Glade", "Poett", "Blem", "Mr. Músculo", "Pato", "Harpic", "Sapolio", "Espadol", "Cebralin",
  // Perfumería y bebés
  "Dove", "Sedal", "Pantene", "Head & Shoulders", "Elvive", "Rexona", "Axe", "Colgate", "Oral-B", "Gillette", "Pampers", "Huggies",
  "Always", "Higienol", "Elite", "Scott", "Plusbelle", "Johnson's", "Nivea", "Lady Soft", "Kotex", "Tampax", "Gillette", "Aquafresh",
  "Listerine", "Fructis", "Tresemmé", "Íntima", "Siempre Libre", "Babysec", "Estrella",
];

/** Minúsculas, sin tildes ni símbolos: "Coca-Cola" y "coca cola" quedan iguales. */
export function brandKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Lista de marcas en uso; `null` = guardar todo (MARKET_BRANDS=todas). */
export function brandFilter(env: string | undefined): Set<string> | null {
  const raw = env?.trim();
  if (raw && ["todas", "todo", "all"].includes(raw.toLowerCase())) return null;
  const list = raw ? raw.split(",") : MAIN_BRANDS;
  return new Set(list.map(brandKey).filter((k) => k.length >= 2));
}

/** La marca del producto es una de la lista (igual, o la lista es el comienzo: "Coca-Cola Zero" → "Coca-Cola"). */
export function brandMatches(brand: string | null | undefined, filter: Set<string> | null): boolean {
  if (!filter) return true;
  const key = brandKey(brand);
  if (key.length < 2) return false;
  if (filter.has(key)) return true;
  for (const k of filter) if (k.length >= 4 && key.startsWith(k)) return true;
  return false;
}
