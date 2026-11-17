# Imágenes de las guías de /ayuda

Las imágenes de `public/ayuda/` son capturas de los componentes REALES del panel con datos de ejemplo (así son iguales a la
pantalla de verdad). Cada una tiene lo que hay que tocar resaltado en verde.

Regenerarlas (después de cambiar una pantalla): `node scripts/docs-shots/shots.mjs` (copia las pantallas de prueba de
`scripts/docs-shots/pages/` a `src/app/blog/zz-shots/`, levanta `next dev` con claves de Supabase de mentira y
`NEXT_PUBLIC_DOCS_SHOTS=1`, saca las capturas con Playwright y borra las pantallas de prueba).

Las capturas y la guía a la que pertenecen se declaran en `scripts/docs-shots/shots.mjs`; la guía las usa con `image` en el paso.
