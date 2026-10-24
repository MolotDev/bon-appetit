import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dictionary } from "@/constants/dictionary";
import { cn } from "@/utils/cn";
import {
  addMonthsIso,
  formatDateShortUk,
  formatMonthYearUk,
  todayKyivIsoDate,
} from "@/utils/date";

type DatePickerProps = {
  id?: string;
  value: string;
  min?: string;
  max?: string;
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

function calendarCells(monthIso: string): Array<{ iso: string; inMonth: boolean }> {
  const [year, month] = monthIso.split("-").map(Number);
  const first = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
  const cells: Array<{ iso: string; inMonth: boolean }> = [];

  for (let index = 0; index < 42; index += 1) {
    const day = index - startOffset + 1;
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day));
    const iso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    cells.push({
      iso,
      inMonth: day >= 1 && day <= daysInMonth,
    });
  }
  return cells;
}

function menuBoxForTrigger(trigger: HTMLElement): MenuBox {
  const rect = trigger.getBoundingClientRect();
  const gutter = 8;
  const width = Math.min(Math.max(rect.width, 288), window.innerWidth - gutter * 2);
  const left = Math.min(Math.max(gutter, rect.left), window.innerWidth - width - gutter);
  const spaceBelow = window.innerHeight - rect.bottom - gutter;
  const spaceAbove = rect.top - gutter;
  const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(240, Math.min(360, openUp ? spaceAbove : spaceBelow));
  const top = openUp ? Math.max(gutter, rect.top - maxHeight - 4) : rect.bottom + 4;
  return { top, left, width, maxHeight };
}

export function DatePicker({
  id,
  value,
  min,
  max,
  disabled = false,
  className,
  ariaLabel,
  onChange,
}: DatePickerProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const [monthIso, setMonthIso] = useState(value || todayKyivIsoDate());
  const today = todayKyivIsoDate();

  const cells = useMemo(() => calendarCells(monthIso), [monthIso]);

  function updateBox() {
    if (!triggerRef.current) {
      return;
    }
    setBox(menuBoxForTrigger(triggerRef.current));
  }

  useEffect(() => {
    if (open) {
      setMonthIso(value || todayKyivIsoDate());
    }
  }, [open, value]);

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

  function isDisabled(iso: string): boolean {
    if (min && iso < min) {
      return true;
    }
    if (max && iso > max) {
      return true;
    }
    return false;
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? dictionary.common.date}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
          {value ? formatDateShortUk(value) : dictionary.common.date}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-primary" />
      </button>
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[70] overflow-auto rounded-lg border bg-card p-3 shadow-lg"
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                maxHeight: box.maxHeight,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent"
                  aria-label={dictionary.common.prevMonth}
                  onClick={() => setMonthIso((current) => addMonthsIso(current, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-medium capitalize">{formatMonthYearUk(monthIso)}</p>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent"
                  aria-label={dictionary.common.nextMonth}
                  onClick={() => setMonthIso((current) => addMonthsIso(current, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dictionary.common.weekdays.map((day) => (
                  <span
                    key={day}
                    className="flex h-8 items-center justify-center text-[11px] font-medium text-muted-foreground"
                  >
                    {day}
                  </span>
                ))}
                {cells.map((cell) => {
                  const selected = cell.iso === value;
                  const isToday = cell.iso === today;
                  const blocked = isDisabled(cell.iso);
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      disabled={blocked}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-md text-sm",
                        !cell.inMonth && "text-muted-foreground/50",
                        isToday && !selected && "ring-1 ring-primary",
                        selected && "bg-primary text-primary-foreground",
                        !selected && !blocked && "hover:bg-accent",
                        blocked && "cursor-not-allowed opacity-40",
                      )}
                      onClick={() => {
                        onChange(cell.iso);
                        setOpen(false);
                      }}
                    >
                      {Number(cell.iso.slice(8))}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
