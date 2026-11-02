-- Facturación automática por medio de pago (ARCA): cada negocio elige con qué medios de pago se emite la
-- factura sola al cobrar. Los que no estén en la lista se facturan a mano, con un botón en la venta.
-- Por defecto ninguno: nadie factura sin querer. La lista sólo la cambia el servidor (dueño o administrador),
-- igual que el resto de arca_settings; la pantalla la lee con arca_status().

alter table public.arca_settings
  add column if not exists auto_invoice_methods text[] not null default '{}'
    check (auto_invoice_methods <@ array['efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto', 'fiado']::text[]);
