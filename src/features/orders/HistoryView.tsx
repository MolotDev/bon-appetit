import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dictionary } from "@/constants/dictionary";
import { checkUserOrderDeadline, listLocations, listOwnOrders, updateOrder } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  MEAL_TYPES,
  dishFromRelation,
  type Location,
  type OrderWithItems,
} from "@/types";
import { formatDateUk, isUserOrderDeadlineOpen } from "@/utils/date";

export function HistoryView() {
  const profile = useAuthStore((state) => state.profile);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function load() {
    if (!profile) {
      return;
    }
    setStatus("loading");
    try {
      const [rows, locationRows] = await Promise.all([listOwnOrders(profile.id), listLocations()]);
      setOrders(rows);
      setLocations(locationRows);
      setStatus(rows.length === 0 ? "empty" : "success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, [profile?.id]);

  function locationName(id: string): string {
    return locations.find((location) => location.id === id)?.name ?? id;
  }

  function canCancel(order: OrderWithItems): boolean {
    return (
      isUserOrderDeadlineOpen(order.date) &&
      order.status !== "CANCELLED" &&
      order.status !== "COMPLETED"
    );
  }

  async function onCancel(order: OrderWithItems) {
    if (!canCancel(order)) {
      toast.error(dictionary.order.deadlineClosed);
      return;
    }
    if (!window.confirm(dictionary.history.confirmCancel)) {
      return;
    }
    setCancellingId(order.id);
    try {
      const allowed = await checkUserOrderDeadline(order.date);
      if (!allowed) {
        toast.error(dictionary.order.deadlineClosed);
        await load();
        return;
      }
      await updateOrder(order.id, { status: "CANCELLED" });
      toast.success(dictionary.order.cancelled);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{dictionary.screens.history}</h1>
      <ScreenState
        status={status}
        emptyMessage={dictionary.history.empty}
        errorMessage={errorMessage}
        onRetry={() => void load()}
      >
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
                <CardTitle className="text-base">{formatDateUk(order.date)}</CardTitle>
                <StatusBadge status={order.status} />
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-2 text-sm">
                <p>
                  {dictionary.history.location}: {locationName(order.target_location_id)}
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  {MEAL_TYPES.map((mealType) => {
                    const item = (order.order_items ?? []).find(
                      (entry) => entry.daily_menu?.meal_type === mealType,
                    );
                    const dish = dishFromRelation(item?.daily_menu?.dishes);
                    if (!dish) {
                      return null;
                    }
                    return (
                      <li key={mealType}>
                        {dictionary.mealType[mealType]}: {dish.title}
                      </li>
                    );
                  })}
                </ul>
                {canCancel(order) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    disabled={cancellingId === order.id}
                    onClick={() => void onCancel(order)}
                  >
                    {dictionary.order.cancelOrder}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScreenState>
    </section>
  );
}
