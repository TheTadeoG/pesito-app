"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCustomer, type CustomerFormInput } from "@/app/(dashboard)/clientes/actions";
import { invoiceTypes, type InvoiceType } from "@/lib/invoice-labels";
import { PhoneCountrySelect } from "@/components/ui/phone-country-select";
import {
  splitPhoneCountry,
  type PhoneCountry,
} from "@/lib/phone-countries";
import { arcaLookupAvailable, lookupArcaTaxpayer, type TaxpayerInfo } from "@/lib/actions/padron";
import type { Customer } from "@/lib/types";

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

export function CustomerForm({ open, onClose, customer }: CustomerFormProps) {
  const isEdit = Boolean(customer);
  const [name, setName] = useState(customer?.name ?? "");
  const [razonSocial, setRazonSocial] = useState(customer?.razon_social ?? "");
  const initialPhone = splitPhoneCountry(customer?.phone ?? "");
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(initialPhone.country);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  const [email, setEmail] = useState(customer?.email ?? "");
  const [document, setDocument] = useState(customer?.document ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  // Domicilio y condición fiscal (se completan solos al buscar el CUIT en ARCA).
  const [address, setAddress] = useState(customer?.address ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [postalCode, setPostalCode] = useState(customer?.postal_code ?? "");
  const [province, setProvince] = useState(customer?.province ?? "");
  const [taxCondition, setTaxCondition] = useState<CustomerFormInput["taxCondition"]>(customer?.tax_condition ?? "");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    customer?.invoice_type ?? "consumidor_final"
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Buscar en ARCA (Padrón): sólo si la facturación está lista.
  const [canLookup, setCanLookup] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [found, setFound] = useState<TaxpayerInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void arcaLookupAvailable().then((ok) => {
      if (!cancelled) setCanLookup(ok);
    }, () => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function lookup() {
    setLooking(true);
    setLookupError(null);
    setFound(null);
    const res = await lookupArcaTaxpayer(document);
    setLooking(false);
    if (res.error || !res.taxpayer) {
      setLookupError(res.error ?? "No pudimos buscar en ARCA.");
      return;
    }
    const t = res.taxpayer;
    setFound(t);
    setDocument(t.taxId);
    // El nombre se completa sólo si estaba vacío; el domicilio y la condición fiscal vienen de ARCA, que es la fuente.
    if (t.name) {
      setRazonSocial((cur) => cur || t.name!);
      setName((cur) => cur || t.name!);
    }
    if (t.street) setAddress(t.street);
    if (t.city) setCity(t.city);
    if (t.postalCode) setPostalCode(t.postalCode);
    if (t.province) setProvince(t.province);
    if (t.conditionCode) setTaxCondition(t.conditionCode);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const input: CustomerFormInput = {
      id: customer?.id,
      name,
      razonSocial,
      phone: phoneNumber.trim() ? `${phoneCountry.dialCode} ${phoneNumber.trim()}` : "",
      email,
      document,
      address,
      city,
      postalCode,
      province,
      taxCondition,
      notes,
      invoiceType,
    };

    const result = await saveCustomer(input);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      description={isEdit ? customer?.name : "Sumá un cliente para llevar su cuenta."}
    >
      <form data-tour="customer-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="c-name" required>
            Nombre
          </Label>
          <Input
            id="c-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Juan Pérez"
            required
          />
        </div>

        <div>
          <Label htmlFor="c-razon-social">Razón social</Label>
          <Input
            id="c-razon-social"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            placeholder="Ej: Almacén San Martín S.R.L."
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sólo si factura con una razón social distinta a este nombre.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-phone">Teléfono</Label>
            <div className="flex gap-1.5">
              <PhoneCountrySelect value={phoneCountry} onChange={setPhoneCountry} />
              <Input
                id="c-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Ej: 11 2345-6789"
                className="min-w-0 flex-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="c-doc">DNI / CUIT</Label>
            <Input
              id="c-doc"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="Ej: 20-12345678-9"
            />
          </div>
        </div>

        {canLookup && (
          <div className="space-y-2 rounded-xl border border-border px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Con el CUIT, CUIL o DNI, completamos el nombre con los datos de ARCA.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void lookup()} disabled={looking || document.replace(/\D/g, "").length < 7}>
                {looking ? "Buscando…" : "Buscar en ARCA"}
              </Button>
            </div>
            {lookupError && <p className="rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger">{lookupError}</p>}
            {found && (
              <div className="space-y-0.5 text-sm">
                <p className="font-medium text-foreground">{found.name ?? "Sin nombre en ARCA"}</p>
                <p className="text-xs text-muted-foreground">
                  {[`CUIT ${found.taxId}`, found.condition, found.active === false ? "sin inscripciones activas" : null].filter(Boolean).join(" · ")}
                </p>
                {found.address && <p className="text-xs text-muted-foreground">{found.address}</p>}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="c-address">Domicilio</Label>
            <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle y número" />
          </div>
          <div>
            <Label htmlFor="c-city">Localidad</Label>
            <Input id="c-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-postal">Código postal</Label>
            <Input id="c-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Ej: C1425" />
          </div>
          <div>
            <Label htmlFor="c-province">Provincia</Label>
            <Input id="c-province" value={province} onChange={(e) => setProvince(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-tax">Condición frente al IVA</Label>
            <select
              id="c-tax"
              value={taxCondition}
              onChange={(e) => setTaxCondition(e.target.value as CustomerFormInput["taxCondition"])}
              className="h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Sin dato</option>
              <option value="consumidor_final">Consumidor final</option>
              <option value="monotributo">Monotributo</option>
              <option value="responsable_inscripto">Responsable inscripto</option>
              <option value="exento">IVA exento</option>
              <option value="no_alcanzado">IVA no alcanzado</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input
            id="c-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ej: juan.perez@gmail.com"
          />
        </div>

        <div>
          <Label htmlFor="c-invoice-type">Comprobante que necesita</Label>
          <select
            id="c-invoice-type"
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
            className="h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {invoiceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            &quot;Consumidor Final&quot; usa el ticket automático según el medio de pago. Elegí
            Factura A/B/C solo si este cliente siempre necesita ese comprobante.
          </p>
        </div>

        <div>
          <Label htmlFor="c-notes">Notas</Label>
          <Input
            id="c-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Paga los viernes"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" data-tour="customer-save" disabled={pending}>
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
