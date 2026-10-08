"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PhoneCountrySelect } from "@/components/ui/phone-country-select";
import { defaultPhoneCountry, type PhoneCountry } from "@/lib/phone-countries";

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
      <PhoneCountrySelect value={country} onChange={setCountry} />
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
