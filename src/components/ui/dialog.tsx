import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { dictionary } from "@/constants/dictionary";
import { cn } from "@/utils/cn";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  wide?: boolean;
  children: ReactNode;
};

export function Dialog({
  open,
  title,
  onClose,
  closeDisabled = false,
  wide = false,
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeDisabled, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          "relative z-10 flex max-h-[min(90dvh,40rem)] w-full flex-col overflow-hidden rounded-lg border bg-card shadow-lg",
          wide ? "max-h-[90dvh] max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id="dialog-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent",
              closeDisabled && "pointer-events-none opacity-40",
            )}
            disabled={closeDisabled}
            aria-label={dictionary.common.close}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
