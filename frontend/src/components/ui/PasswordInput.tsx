"use client";

import { useState, type ChangeEvent, type CSSProperties } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

type PasswordInputProps = {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  icon?: boolean;
  className?: string;
  inputClassName: string;
  inputStyle?: CSSProperties;
};

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  icon = false,
  className = "",
  inputClassName,
  inputStyle,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {icon && (
        <Lock
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-faint)" }}
        />
      )}
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={inputClassName}
        style={{ paddingRight: "2.25rem", ...inputStyle }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
        style={{ color: "var(--text-faint)" }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
