// Avisa a Bing (y a los buscadores que usan IndexNow) de todas las páginas del sitemap, para que las rastreen enseguida.
// Uso: node scripts/indexnow.mjs   (después de un despliegue con páginas nuevas o cambiadas)
// La clave es pública a propósito: IndexNow la verifica leyendo public/indexnow-<clave>.txt en el sitio.
const KEY = "4c708c2fdd9bf31782a0498f499dbcbb";
const HOST = "www.pesito.com.ar";
const site = `https://${HOST}`;

const xml = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(site) && !/\.(webp|png|jpg)$/.test(u));
if (urlList.length === 0) {
  console.error("No encontré páginas en el sitemap.");
  process.exit(1);
}
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${site}/indexnow-${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${urlList.length} páginas enviadas. Respuesta: ${res.status} ${res.statusText} (200 o 202 = recibido).`);
