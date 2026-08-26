"use client";

type Country = { code: string; label: string; flag: string; digits: number };

const COUNTRIES: Country[] = [
  { code: "+971", label: "UAE", flag: "🇦🇪", digits: 9 },
  { code: "+92", label: "Pakistan", flag: "🇵🇰", digits: 10 },
];

function parseValue(value: string) {
  for (const c of COUNTRIES) {
    if (value.startsWith(c.code)) return { country: c, local: value.slice(c.code.length) };
  }
  return { country: COUNTRIES[0], local: "" };
}

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  focusColor?: string;
};

/** Country-code + local-number phone input, restricted to UAE (+971) and Pakistan (+92),
 * each with its own digit-length limit. Emits a full "+971XXXXXXXXX"-style value that
 * matches the backend's validator exactly once the local part is complete. */
export function PhoneInput({ value, onChange, focusColor = "var(--indigo)" }: PhoneInputProps) {
  const { country, local } = parseValue(value);

  function setCountry(code: string) {
    const next = COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
    const trimmedLocal = local.slice(0, next.digits);
    onChange(trimmedLocal ? `${next.code}${trimmedLocal}` : "");
  }

  function setLocal(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, country.digits);
    onChange(digits ? `${country.code}${digits}` : "");
  }

  const incomplete = local.length > 0 && local.length < country.digits;

  return (
    <div>
      <div className="flex gap-2">
        <select
          value={country.code}
          onChange={(e) => setCountry(e.target.value)}
          className="w-[110px] rounded-lg border px-2 py-2 text-sm outline-none"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={`${country.digits}-digit number`}
          inputMode="numeric"
          maxLength={country.digits}
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface-2)",
            borderColor: incomplete ? "var(--danger)" : "var(--border)",
            color: "var(--text)",
          }}
          onFocus={(e) => {
            if (!incomplete) e.currentTarget.style.borderColor = focusColor;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = incomplete ? "var(--danger)" : "var(--border)";
          }}
        />
      </div>
      <p className="mt-1 text-xs" style={{ color: incomplete ? "var(--danger)" : "var(--text-faint)" }}>
        {incomplete
          ? `Enter all ${country.digits} digits for ${country.label} (${local.length}/${country.digits})`
          : `${country.label}: ${country.digits} digits after ${country.code}`}
      </p>
    </div>
  );
}
