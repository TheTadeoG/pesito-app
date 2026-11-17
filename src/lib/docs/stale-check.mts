// Avisa qué guías pueden estar desactualizadas: cambió (en git) algún archivo que describen después de su `updatedAt`.
// Uso: bash src/lib/docs/run-stale.sh  (sale con error si hay alguna, para usarlo antes de cerrar un cambio)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { docArticles } from "./index.ts";
import { watchByCategory, watchBySlug } from "./watch.ts";

const root = process.env.DOCS_REPO_ROOT ?? process.cwd();
const stale: { slug: string; updatedAt: string; changed: string; file: string }[] = [];
const missing = new Set<string>();

function lastChange(path: string): { date: string; file: string } | null {
  if (!existsSync(`${root}/${path}`)) {
    missing.add(path);
    return null;
  }
  const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", path], { cwd: root, encoding: "utf8" }).trim();
  return out ? { date: out, file: path } : null;
}

for (const a of docArticles) {
  const paths = [...(watchByCategory[a.category] ?? []), ...(watchBySlug[a.slug] ?? [])];
  let worst: { date: string; file: string } | null = null;
  for (const p of paths) {
    const c = lastChange(p);
    if (c && (!worst || c.date > worst.date)) worst = c;
  }
  if (worst && worst.date > a.updatedAt) stale.push({ slug: a.slug, updatedAt: a.updatedAt, changed: worst.date, file: worst.file });
}

if (missing.size) console.log(`Rutas vigiladas que ya no existen (actualizá src/lib/docs/watch.ts): ${[...missing].join(", ")}`);
if (stale.length === 0 && missing.size === 0) {
  console.log(`Guías al día (${docArticles.length}).`);
} else {
  for (const s of stale) console.log(`Revisar: ${s.slug} (guía ${s.updatedAt}; ${s.file} cambió el ${s.changed})`);
  if (stale.length) console.log(`\n${stale.length} guía(s) para revisar. Si ya está bien, subí su updatedAt.`);
  process.exit(1);
}
