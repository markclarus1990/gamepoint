"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

/**
 * AdminNumberInput
 * - String-based controlled input to avoid leading-zero / sticky-zero bug.
 * - Empty string renders as empty field (placeholder visible), not "0".
 * - Prevents cursor-at-start typing "5" → "50" by starting empty instead of 0.
 * - Sanitizes leading zeros on change: "05" → "5", "007" → "7", keeps "0" and "0." intact.
 */
export function AdminNumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  className,
  id,
  autoFocus,
  inputMode,
}: Props) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      id={id}
      autoFocus={autoFocus}
      placeholder={placeholder}
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        let v = e.target.value;
        // Allow empty (user cleared field) — crucial to avoid sticky zero
        if (v === "") {
          onChange("");
          return;
        }
        // Strip leading zeros like "05" → "5", "00" → "0", but keep "0." for decimals
        // Only sanitize if value looks like integer with leading zero; don't break "-"
        if (v.length > 1 && v[0] === "0" && v[1] !== "." && !v.startsWith("-")) {
          const sanitized = v.replace(/^0+(?=\d)/, "");
          v = sanitized === "" ? "0" : sanitized;
        }
        // Also handle "-0" edge
        if (v === "-0") v = "0";
        onChange(v);
      }}
      className={
        className ??
        "w-full px-3.5 py-2.5 bg-[#1e293b] border border-white/5 rounded-xl text-sm placeholder-zinc-500 outline-none focus:border-purple-500/60"
      }
    />
  );
}

export default AdminNumberInput;
