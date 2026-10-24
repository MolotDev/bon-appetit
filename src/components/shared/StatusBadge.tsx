import { dictionary } from "@/constants/dictionary";
import type { OrderStatus } from "@/types";
import { cn } from "@/utils/cn";

const badgeClass: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-950",
  COOKING: "bg-orange-100 text-orange-950",
  IN_DELIVERY: "bg-sky-100 text-sky-950",
  COMPLETED: "bg-emerald-100 text-emerald-950",
  CANCELLED: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium leading-tight",
        badgeClass[status],
      )}
    >
      {dictionary.status[status]}
    </span>
  );
}
