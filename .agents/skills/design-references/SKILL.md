---
name: design-references
description: Ideas de diseño a partir de la colección awesome-design-md (VoltAgent) — 74 DESIGN.md con el lenguaje visual de marcas conocidas (Stripe, Linear, Notion, Apple, Revolut, Wise, Airbnb, Supabase, etc.). Usar cuando el usuario pide ideas o inspiración visual, "que se vea como X", "más moderno/premium/amigable", o un rediseño de una pantalla o de la landing de Pesito.
---

# Referencias de diseño (awesome-design-md)

Colección: https://github.com/VoltAgent/awesome-design-md — cada marca tiene un `DESIGN.md` (paleta con roles, tipografía, componentes, espaciado, sombras, qué hacer y qué no).

## Cómo usarla

1. Elegí 1 a 3 referencias de la lista de abajo según lo que se pide (o la que el usuario nombró).
2. Bajá sólo esas, en el momento (no se guardan en el repo):

   ```bash
   curl -s https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<carpeta>/DESIGN.md
   ```

   `<carpeta>` es el nombre entre paréntesis de la lista. Si una no existe, la lista completa está en
   `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/README.md`.
3. Tomá **ideas**, no la identidad: layout, densidad, jerarquía tipográfica, espaciado, estados de componentes, cómo muestran números/plata, qué evitan.
4. Aplicalas con los tokens de Pesito (colores y radios en `src/app/globals.css`, fuentes Geist/Fredoka de `src/app/layout.tsx`, componentes de `src/components/ui`). Mantener claro y oscuro.

## Reglas

- **No copiar la marca de otro**: ni logos, ni nombres, ni su paleta completa, ni fuentes propietarias (Sohne, SF Pro, etc.). Si el usuario pide explícitamente "los colores de X", avisale que conviene inspirarse sin copiar la identidad y proponé una versión con la paleta de Pesito.
- Contame qué referencia usaste y qué tomaste de cada una (1–2 líneas), así el usuario puede pedir "más como Wise" o "menos Stripe".
- Para la web pública se puede combinar con la skill `design-taste-frontend`; para el panel (tablas, POS, reportes) priorizá claridad y densidad sobre efectos.

## Cuáles le quedan mejor a Pesito

Pesito es un sistema de gestión para kioscos y almacenes (plata, stock, cajas):

- **Plata y números claros**: Stripe (`stripe`), Wise (`wise`), Revolut (`revolut`), Mastercard (`mastercard`), Coinbase (`coinbase`).
- **Panel denso y prolijo**: Linear (`linear.app`), Sentry (`sentry`), PostHog (`posthog`), Supabase (`supabase`), Cal.com (`cal`), Vercel (`vercel`).
- **Amigable / cálido para comercios chicos**: Notion (`notion`), Airbnb (`airbnb`), Intercom (`intercom`), Zapier (`zapier`), Mintlify (`mintlify`), Starbucks (`starbucks`).
- **Landing de producto**: Framer (`framer`), Webflow (`webflow`), Shopify (`shopify`), Lovable (`lovable`), Raycast (`raycast`).

## Lista completa (carpeta entre paréntesis)

- **IA**: Claude (`claude`), Cohere (`cohere`), ElevenLabs (`elevenlabs`), Minimax (`minimax`), Mistral (`mistral.ai`), Ollama (`ollama`), OpenCode (`opencode.ai`), Replicate (`replicate`), Runway (`runwayml`), Together AI (`together.ai`), VoltAgent (`voltagent`), xAI (`x.ai`).
- **Herramientas de desarrollo**: Cursor (`cursor`), Expo (`expo`), Lovable (`lovable`), Raycast (`raycast`), Superhuman (`superhuman`), Vercel (`vercel`), Warp (`warp`).
- **Backend / datos**: ClickHouse (`clickhouse`), Composio (`composio`), HashiCorp (`hashicorp`), MongoDB (`mongodb`), PostHog (`posthog`), Sanity (`sanity`), Sentry (`sentry`), Supabase (`supabase`).
- **Productividad / SaaS**: Cal.com (`cal`), Intercom (`intercom`), Linear (`linear.app`), Mintlify (`mintlify`), Notion (`notion`), Resend (`resend`), Zapier (`zapier`).
- **Diseño / creativas**: Airtable (`airtable`), Clay (`clay`), Figma (`figma`), Framer (`framer`), Miro (`miro`), Webflow (`webflow`).
- **Fintech / cripto**: Binance (`binance`), Coinbase (`coinbase`), Kraken (`kraken`), Mastercard (`mastercard`), Revolut (`revolut`), Stripe (`stripe`), Wise (`wise`).
- **E-commerce / retail**: Airbnb (`airbnb`), Meta (`meta`), Nike (`nike`), Shopify (`shopify`), Starbucks (`starbucks`).
- **Medios / consumo**: Apple (`apple`), HP (`hp`), IBM (`ibm`), NVIDIA (`nvidia`), Pinterest (`pinterest`), PlayStation (`playstation`), SpaceX (`spacex`), Spotify (`spotify`), The Verge (`theverge`), Uber (`uber`), Vodafone (`vodafone`), WIRED (`wired`).
- **Autos**: BMW (`bmw`), BMW M (`bmw-m`), Bugatti (`bugatti`), Ferrari (`ferrari`), Lamborghini (`lamborghini`), Renault (`renault`), Tesla (`tesla`).
- **Retro**: Dell 1996 (`dell-1996`), Nintendo 2001 (`nintendo-2001`).
