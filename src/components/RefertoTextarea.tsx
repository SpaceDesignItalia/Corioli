import { Textarea, type TextareaProps } from "@nextui-org/react";
import { useCallback, useEffect, useRef } from "react";

const REFERTO_TEXTAREA_CLASSES = {
  base: "!h-auto",
  input: "!text-base !leading-relaxed font-normal !overflow-hidden resize-none min-h-0",
  inputWrapper:
    "!h-auto min-h-0 items-start group-hover:border-primary transition-colors bg-white",
  mainWrapper: "h-auto",
} as const;

function syncTextareaHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.overflow = "hidden";
  el.style.resize = "none";
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** Textarea del referto: cresce con il contenuto, senza scrollbar interna. */
export function RefertoTextarea({
  value,
  minRows = 2,
  classNames,
  onValueChange,
  ...props
}: TextareaProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const getTextarea = useCallback(
    () => rootRef.current?.querySelector("textarea") ?? null,
    [],
  );

  const syncHeight = useCallback(() => {
    syncTextareaHeight(getTextarea());
  }, [getTextarea]);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  const mergeSlot = (slot: keyof typeof REFERTO_TEXTAREA_CLASSES) =>
    [REFERTO_TEXTAREA_CLASSES[slot], classNames?.[slot]].filter(Boolean).join(" ");

  const mergedClassNames = {
    ...REFERTO_TEXTAREA_CLASSES,
    ...classNames,
    base: mergeSlot("base"),
    mainWrapper: mergeSlot("mainWrapper"),
    input: mergeSlot("input"),
    inputWrapper: mergeSlot("inputWrapper"),
  };

  return (
    <div ref={rootRef} className="w-full">
      <Textarea
        {...props}
        value={value}
        minRows={minRows}
        onValueChange={(v) => {
          onValueChange?.(v);
          requestAnimationFrame(syncHeight);
        }}
        classNames={mergedClassNames}
      />
    </div>
  );
}
