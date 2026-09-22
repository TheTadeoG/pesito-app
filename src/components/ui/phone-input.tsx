"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { phoneCountries, defaultPhoneCountry, type PhoneCountry } from "@/lib/phone-countries";

export function PhoneInput({
  id,
  name,
  required,
  defaultNumber,
}: {
  id?: string;
  name: string;
  required?: boolean;
  defaultNumber?: string;
}) {
  const [country, setCountry] = useState<PhoneCountry>(defaultPhoneCountry);
  const [number, setNumber] = useState(defaultNumber ?? "");

  const combined = number.trim() ? `${country.dialCode} ${number.trim()}` : "";

  return (
    <div className="flex gap-2">
      <select
        value={country.code}
        onChange={(e) => {
          const next = phoneCountries.find((c) => c.code === e.target.value);
          if (next) setCountry(next);
        }}
        aria-label="Código de país"
        className="h-10 w-28 shrink-0 rounded-xl border border-border bg-card px-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {phoneCountries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dialCode}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="11 2345 6789"
        autoComplete="tel-national"
        className="flex-1"
        required={required}
      />
      <input type="hidden" name={name} value={combined} />
    </div>
  );
}
