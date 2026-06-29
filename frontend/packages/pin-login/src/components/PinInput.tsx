import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import type { PinInputProps } from "../types";

export function PinInput({
  length = 4,
  value,
  onChange,
  onComplete,
  disabled = false,
  idPrefix = "pin",
  shake = false,
  groupLabel,
  digitLabel = (n) => `Digit ${n}`,
  className = "",
}: PinInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, "").slice(0, length).split("");

  const handleInput = (index: number, raw: string) => {
    const val = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = val;
    const joined = next.join("").replace(/\s/g, "");
    onChange(joined);
    if (joined.length === length && onComplete) {
      onComplete(joined);
    }
    if (val && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1)
      refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, length);
    onChange(pasted);
    const nextIndex = Math.min(pasted.length, length - 1);
    refs.current[nextIndex]?.focus();
    if (pasted.length === length && onComplete) {
      onComplete(pasted);
    }
  };

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  return (
    <div
      className={`pin-group${shake ? " shake" : ""}${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={groupLabel}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="password"
          suppressHydrationWarning
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          className="pin-box"
          id={`${idPrefix}-${i}`}
          value={digits[i] || ""}
          disabled={disabled}
          autoComplete="off"
          aria-label={digitLabel(i + 1)}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

export function clearPinFocus(idPrefix = "pin"): void {
  document.getElementById(`${idPrefix}-0`)?.focus();
}
