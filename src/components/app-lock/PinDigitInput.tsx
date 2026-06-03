import { useCallback, useId, useRef, useState } from "react";

const PIN_MIN = 4;
const PIN_MAX = 4;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Numero fisso di caselle (= lunghezza PIN dell'utente) */
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onSubmit?: () => void;
  /** Chiamato quando sono state inserite tutte le cifre (solo con `length` impostato) */
  onComplete?: (value: string) => void;
  showHint?: boolean;
  "aria-label"?: string;
};

export default function PinDigitInput({
  value,
  onChange,
  length,
  autoFocus = false,
  disabled = false,
  invalid = false,
  onSubmit,
  onComplete,
  showHint = length == null,
  "aria-label": ariaLabel = "PIN",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, "");
  const inputMax = length ?? PIN_MAX;
  const trimmed = digits.slice(0, inputMax);
  const boxCount =
    length ??
    Math.min(PIN_MAX, Math.max(PIN_MIN, trimmed.length || PIN_MIN));
  const activeIndex = Math.min(trimmed.length, boxCount - 1);

  const focusInput = useCallback(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const setDigits = useCallback(
    (raw: string) => {
      const next = raw.replace(/\D/g, "").slice(0, inputMax);
      onChange(next);
      if (length != null && next.length === length) {
        onComplete?.(next);
      }
    },
    [onChange, inputMax, length, onComplete],
  );

  return (
    <div className="w-full">
      <p id={labelId} className="sr-only">
        {ariaLabel}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-invalid={invalid}
        onClick={focusInput}
        className={[
          "w-full rounded-xl p-1 transition-colors cursor-text",
          invalid ? "animate-pin-shake" : "",
          disabled ? "opacity-60 pointer-events-none" : "",
        ].join(" ")}
      >
        <div className="flex justify-center gap-2 sm:gap-2.5">
          {Array.from({ length: boxCount }, (_, i) => {
            const filled = i < trimmed.length;
            const active = focused && !disabled && i === activeIndex;
            return (
              <div
                key={i}
                className={[
                  "h-12 w-10 sm:h-[3.25rem] sm:w-11 rounded-lg border-2 flex items-center justify-center transition-all duration-150",
                  filled
                    ? "border-primary bg-primary-50"
                    : "border-default-300 bg-content1",
                  active && !filled ? "border-primary shadow-sm" : "",
                  invalid && filled ? "border-danger bg-danger-50" : "",
                  invalid && !filled ? "border-danger/40" : "",
                ].join(" ")}
                aria-hidden
              >
                {filled ? (
                  <span
                    className={[
                      "block rounded-full",
                      invalid ? "h-2.5 w-2.5 bg-danger" : "h-2.5 w-2.5 bg-foreground",
                    ].join(" ")}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={length != null ? "current-password" : "new-password"}
        autoFocus={autoFocus}
        disabled={disabled}
        value={trimmed}
        maxLength={inputMax}
        aria-label={ariaLabel}
        className="sr-only"
        onChange={(e) => setDigits(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
      />
      {showHint ? (
        <p className="mt-3 text-center text-xs text-default-400">4 cifre</p>
      ) : null}
    </div>
  );
}
