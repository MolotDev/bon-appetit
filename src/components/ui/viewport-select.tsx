import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

type ViewportSelectOption = {
  value: string;
  label: string;
};

type ViewportSelectProps = {
  id?: string;
  value: string;
  options: ViewportSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  onChange: (value: string) => void;
};

type MenuBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function menuBoxForTrigger(trigger: HTMLElement): MenuBox {
  const rect = trigger.getBoundingClientRect();
  const gutter = 8;
  const spaceBelow = window.innerHeight - rect.bottom - gutter;
  const spaceAbove = rect.top - gutter;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(96, Math.min(240, openUp ? spaceAbove : spaceBelow));
  const width = Math.min(rect.width, window.innerWidth - gutter * 2);
  const left = Math.min(Math.max(gutter, rect.left), window.innerWidth - width - gutter);
  const top = openUp ? rect.top - maxHeight - 4 : rect.bottom + 4;

  return { top, left, width, maxHeight };
}

export function ViewportSelect({
  id,
  value,
  options,
  placeholder,
  disabled = false,
  className,
  ariaLabel,
  onChange,
}: ViewportSelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);

  const selected = options.find((option) => option.value === value);

  function updateBox() {
    if (!triggerRef.current) {
      return;
    }
    setBox(menuBoxForTrigger(triggerRef.current));
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    updateBox();
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && box
        ? createPortal(
            <ul
              ref={menuRef}
              role="listbox"
              aria-labelledby={triggerId}
              className="fixed z-[70] overflow-y-auto rounded-md border bg-card py-1 shadow-lg"
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                maxHeight: box.maxHeight,
              }}
            >
              {options.map((option) => {
                const isActive = option.value === value;
                return (
                  <li key={option.value || "empty"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={cn(
                        "flex min-h-10 w-full items-center px-3 text-left text-sm",
                        isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                      )}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
